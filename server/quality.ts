import {
  AssertionEvaluationResult,
  BusinessAssertion,
  ColumnProfile,
  DataQualityAudit,
  DatasetProfile,
  QualityIssue,
} from './types.js';
import { isNullOrEmpty, parseCleanNumber } from './profiler.js';

export function auditDataQuality(data: Record<string, any>[], profile: DatasetProfile): DataQualityAudit {
  const issues: QualityIssue[] = [];
  const passedChecklist: string[] = [];
  const warningChecklist: string[] = [];
  const criticalChecklist: string[] = [];
  const recommendations: string[] = [];

  const rowCount = profile.rowCount;
  let healthyColumnCount = 0;
  let potentialOutliersTotal = 0;
  let typeInconsistentColumns = 0;
  let anomalyCount = 0;

  // 1. Missing Data Audit
  const columnsWithMissing: { col: ColumnProfile; count: number; pct: number }[] = [];
  for (const col of profile.columns) {
    if (col.nullCount > 0) {
      columnsWithMissing.push({ col, count: col.nullCount, pct: col.nullPercentage });
      const severity = col.nullPercentage > 40 ? 'critical' : col.nullPercentage > 10 ? 'warning' : 'info';
      issues.push({
        type: 'missing',
        severity,
        column: col.name,
        affectedCount: col.nullCount,
        percentage: col.nullPercentage,
        title: `Missing values in '${col.name}'`,
        description: `${col.nullCount.toLocaleString()} values (${col.nullPercentage}%) are null or blank in column '${col.name}'.`,
        recommendation: col.nullPercentage > 50
          ? `Consider excluding column '${col.name}' from dense calculations or imputing with default/indicator.`
          : `Filter null rows during calculations or apply imputation (mean/median/mode) based on analysis intent.`,
      });

      if (severity === 'critical') {
        criticalChecklist.push(`Column '${col.name}' has high missingness (${col.nullPercentage}%).`);
      } else {
        warningChecklist.push(`${col.nullCount} missing '${col.name}' values detected (${col.nullPercentage}%).`);
      }
    } else {
      healthyColumnCount++;
    }
  }

  if (columnsWithMissing.length === 0) {
    passedChecklist.push(`All ${profile.columnCount} columns are complete with zero missing cells.`);
  } else {
    passedChecklist.push(`${healthyColumnCount} of ${profile.columnCount} columns have 100% complete data.`);
  }

  // 2. Duplicates Audit
  if (profile.duplicateRowCount > 0) {
    const severity = profile.duplicatePercentage > 10 ? 'critical' : 'warning';
    issues.push({
      type: 'duplicate',
      severity,
      affectedCount: profile.duplicateRowCount,
      percentage: profile.duplicatePercentage,
      title: `Duplicate rows detected`,
      description: `Found ${profile.duplicateRowCount.toLocaleString()} identical rows (${profile.duplicatePercentage}% of dataset).`,
      recommendation: `Verify whether duplicate records represent repeat transactions or duplicate data loads. Consider deduplicating before metric rollups.`,
    });
    warningChecklist.push(`${profile.duplicateRowCount.toLocaleString()} duplicate rows detected (${profile.duplicatePercentage}%).`);
    recommendations.push(`Review and optionally remove ${profile.duplicateRowCount} duplicate rows to prevent double-counting in aggregations.`);
  } else {
    passedChecklist.push(`No exact duplicate rows found.`);
  }

  // 3. Outlier Audit (IQR + Z-Score)
  for (const col of profile.columns) {
    if (col.type === 'numeric' && col.outlierCountIqr && col.outlierCountIqr > 0) {
      potentialOutliersTotal += col.outlierCountIqr;
      const outlierPct = Math.round((col.outlierCountIqr / (col.totalCount - col.nullCount)) * 1000) / 10;
      issues.push({
        type: 'outlier',
        severity: outlierPct > 5 ? 'warning' : 'info',
        column: col.name,
        affectedCount: col.outlierCountIqr,
        percentage: outlierPct,
        title: `Potential outliers in '${col.name}'`,
        description: `Identified ${col.outlierCountIqr} values outside [Q1 - 1.5×IQR, Q3 + 1.5×IQR] (bounds: ${col.q1 ? Math.round(col.q1 - 1.5 * (col.iqr || 0)) : 0} to ${col.q3 ? Math.round(col.q3 + 1.5 * (col.iqr || 0)) : 0}).`,
        recommendation: `Inspect extreme values. If legitimate enterprise/bulk transactions, retain them; if data entry errors, apply winsorization or filter for targeted queries.`,
      });
      warningChecklist.push(`${col.outlierCountIqr} potential outliers in '${col.name}' via IQR.`);
    }
  }

  // 4. Type Inconsistencies & Malformed Values
  for (const col of profile.columns) {
    if (col.type === 'numeric') {
      let nonNumericStringCount = 0;
      for (const row of data) {
        const val = row[col.name];
        if (!isNullOrEmpty(val) && typeof val === 'string') {
          const parsed = parseCleanNumber(val);
          if (!parsed.isNum) {
            nonNumericStringCount++;
          }
        }
      }

      if (nonNumericStringCount > 0) {
        typeInconsistentColumns++;
        const pct = Math.round((nonNumericStringCount / rowCount) * 1000) / 10;
        issues.push({
          type: 'type_mismatch',
          severity: 'warning',
          column: col.name,
          affectedCount: nonNumericStringCount,
          percentage: pct,
          title: `Non-numeric text in numeric column '${col.name}'`,
          description: `${nonNumericStringCount} entries in numeric column '${col.name}' could not be cleanly converted to numbers (e.g., text, invalid placeholders).`,
          recommendation: `These values will be transparently excluded during math calculations. Consider normalizing string entries.`,
        });
        warningChecklist.push(`${nonNumericStringCount} non-numeric values in '${col.name}'.`);
        recommendations.push(`Standardize ${nonNumericStringCount} non-numeric string values in '${col.name}'.`);
      }
    }

    // Empty or Constant columns
    if (col.nullCount === rowCount && rowCount > 0) {
      issues.push({
        type: 'empty_column',
        severity: 'critical',
        column: col.name,
        affectedCount: rowCount,
        percentage: 100,
        title: `Empty column '${col.name}'`,
        description: `Column '${col.name}' contains 100% missing values.`,
        recommendation: `Remove column '${col.name}' as it contains no analytical variance or information.`,
      });
      criticalChecklist.push(`Column '${col.name}' is completely empty.`);
    } else if (col.uniqueCount === 1 && rowCount > 5) {
      issues.push({
        type: 'constant_column',
        severity: 'info',
        column: col.name,
        affectedCount: rowCount,
        percentage: 100,
        title: `Constant column '${col.name}'`,
        description: `Column '${col.name}' has only 1 unique value across all rows (zero variance).`,
        recommendation: `Constant columns provide no variance for statistical models or segmentation.`,
      });
      warningChecklist.push(`Column '${col.name}' has constant value across all rows.`);
    }
  }

  // 5. Potential Anomalies (Negative revenues, impossible percentages)
  for (const col of profile.columns) {
    if (col.suspiciousValuesCount && col.suspiciousValuesCount > 0) {
      anomalyCount += col.suspiciousValuesCount;
      const pct = Math.round((col.suspiciousValuesCount / rowCount) * 1000) / 10;
      issues.push({
        type: 'anomaly',
        severity: 'warning',
        column: col.name,
        affectedCount: col.suspiciousValuesCount,
        percentage: pct,
        title: `Potential anomaly in '${col.name}' (Negative values)`,
        description: `${col.suspiciousValuesCount} negative values detected. These are retained in analysis because negative revenue/sales may represent refunds, returns, or accounting adjustments.`,
        recommendation: `Verify business meaning. Filter out negatives if analyzing gross transaction volumes.`,
      });
      warningChecklist.push(`${col.suspiciousValuesCount} negative values in '${col.name}' (potential refunds or anomalies).`);
    }
  }

  if (typeInconsistentColumns === 0) {
    passedChecklist.push(`All column data types are structurally consistent.`);
  }

  // 6. Data Quality Score Calculation (0 - 100)
  // Penalties:
  // - Missing cells: max -25 pts
  const missingPenalty = Math.min(25, Math.round(profile.missingPercentage * 2.5));
  // - Duplicate rows: max -15 pts
  const duplicatePenalty = Math.min(15, Math.round(profile.duplicatePercentage * 1.5));
  // - Type issues: max -20 pts
  const typeIssuePenalty = Math.min(20, typeInconsistentColumns * 6);
  // - Extreme outliers: max -15 pts
  const totalNonEmpty = profile.columns.reduce((sum, c) => sum + (c.type === 'numeric' ? c.totalCount - c.nullCount : 0), 0);
  const outlierPct = totalNonEmpty > 0 ? (potentialOutliersTotal / totalNonEmpty) * 100 : 0;
  const outlierPenalty = Math.min(15, Math.round(outlierPct * 1.2));
  // - Empty columns: max -15 pts
  const emptyColumnsCount = profile.columns.filter(c => c.nullCount === rowCount && rowCount > 0).length;
  const emptyColumnPenalty = Math.min(15, emptyColumnsCount * 8);

  // 6. Privacy & PII Compliance Audit
  const piiFlags = profile.piiSummary || [];
  let detectedPiiCount = 0;
  let compliancePenalty = 0;
  let hipaaSensitive = false;

  for (const pii of piiFlags) {
    detectedPiiCount += pii.matchedCount;
    if (pii.category === 'ssn' || pii.category === 'credit_card') {
      compliancePenalty += 25;
      hipaaSensitive = true;
      criticalChecklist.push(`High-risk credential detected in column '${pii.column}' (${pii.category.toUpperCase()}).`);
      issues.push({
        type: 'pii_risk',
        severity: 'critical',
        column: pii.column,
        affectedCount: pii.matchedCount,
        percentage: rowCount > 0 ? Math.round((pii.matchedCount / rowCount) * 100) : 0,
        title: `High-Risk PII: ${pii.category.toUpperCase()} in '${pii.column}'`,
        description: `Column '${pii.column}' contains unmasked ${pii.category} values. High regulatory risk under PCI-DSS / HIPAA.`,
        recommendation: `Use Cleaning Assistant to mask or redact '${pii.column}' before sharing reports.`,
      });
    } else {
      compliancePenalty += 10;
      warningChecklist.push(`Direct PII identified in '${pii.column}' (${pii.category}). Masking recommended.`);
      issues.push({
        type: 'pii_risk',
        severity: 'warning',
        column: pii.column,
        affectedCount: pii.matchedCount,
        percentage: rowCount > 0 ? Math.round((pii.matchedCount / rowCount) * 100) : 0,
        title: `Direct Identifier: ${pii.category} in '${pii.column}'`,
        description: `Column '${pii.column}' contains ${pii.matchedCount} personal identifier records subject to GDPR/CCPA.`,
        recommendation: `Apply anonymization or masking in the Cleaning Assistant.`,
      });
    }
  }

  if (piiFlags.length === 0) {
    passedChecklist.push('Data Privacy Shield: No unmasked PII (emails, SSNs, credit cards, phones) detected.');
  }

  const complianceScore = Math.max(0, 100 - compliancePenalty);
  const gdprReady = complianceScore >= 80;

  const rawScore = 100 - (missingPenalty + duplicatePenalty + typeIssuePenalty + outlierPenalty + emptyColumnPenalty);
  const score = Math.max(10, Math.min(100, rawScore));

  let rating: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Critical' = 'Excellent';
  if (score >= 90) rating = 'Excellent';
  else if (score >= 75) rating = 'Good';
  else if (score >= 60) rating = 'Fair';
  else if (score >= 40) rating = 'Poor';
  else rating = 'Critical';

  // Default recommendations if empty
  if (recommendations.length === 0) {
    recommendations.push('Data quality is high. You can proceed with analytical segmentation and predictive modeling.');
  }

  return {
    datasetId: profile.id,
    score,
    overallScore: score,
    duplicateRowsCount: profile.duplicateRowCount,
    rating,
    compliance: {
      complianceScore,
      gdprReady,
      hipaaSensitive,
      detectedPiiCount,
      piiFlags,
    },
    scoreBreakdown: {
      missingPenalty,
      duplicatePenalty,
      typeIssuePenalty,
      outlierPenalty,
      emptyColumnPenalty,
    },
    metrics: {
      healthyColumnCount,
      totalColumns: profile.columnCount,
      duplicateRows: profile.duplicateRowCount,
      duplicatePercentage: profile.duplicatePercentage,
      totalMissingCells: profile.totalMissingCells,
      missingCellsPercentage: profile.missingPercentage,
      potentialOutliersTotal,
      potentialOutliersPercentage: Math.round(outlierPct * 10) / 10,
      typeInconsistentColumns,
      anomalyCount,
    },
    checklist: {
      passed: passedChecklist,
      warnings: warningChecklist,
      critical: criticalChecklist,
    },
    issues,
    recommendations,
  };
}

// Custom Business Assertion Quality Rule Engine
export function evaluateBusinessAssertions(
  data: Record<string, any>[],
  arg2: DatasetProfile | BusinessAssertion[],
  arg3?: BusinessAssertion[]
): AssertionEvaluationResult[] & { results: AssertionEvaluationResult[]; overallStatus: 'pass' | 'warn' | 'fail'; passedCount: number; failedCount: number } {
  const assertions: BusinessAssertion[] = Array.isArray(arg2) ? arg2 : (arg3 || []);
  const results: AssertionEvaluationResult[] = [];

  for (const rule of assertions) {
    const col = rule.column;
    const ruleType = (rule as any).ruleType || (rule as any).rule;
    let passedCount = 0;
    let failedCount = 0;
    const sampleViolations: { rowIndex: number; value: any; rowSummary: Record<string, any> }[] = [];

    // Pre-calculate unique set if uniqueness check
    const valueCounts = new Map<any, number>();
    if (ruleType === 'unique') {
      for (const row of data) {
        const v = row[col];
        if (!isNullOrEmpty(v)) {
          valueCounts.set(v, (valueCounts.get(v) || 0) + 1);
        }
      }
    }

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const val = row[col];
      let isPassing = true;

      if (ruleType === 'not_null') {
        isPassing = !isNullOrEmpty(val);
      } else if (ruleType === 'positive') {
        const parsed = parseCleanNumber(val);
        isPassing = parsed.isNum && parsed.value > 0;
      } else if (ruleType === 'non_negative') {
        const parsed = parseCleanNumber(val);
        isPassing = parsed.isNum && parsed.value >= 0;
      } else if (ruleType === 'min') {
        const parsed = parseCleanNumber(val);
        const threshold = (rule as any).threshold ?? rule.minValue ?? 0;
        isPassing = parsed.isNum && parsed.value >= threshold;
      } else if (ruleType === 'max') {
        const parsed = parseCleanNumber(val);
        const threshold = (rule as any).threshold ?? rule.maxValue ?? 0;
        isPassing = parsed.isNum && parsed.value <= threshold;
      } else if (ruleType === 'unique') {
        isPassing = !isNullOrEmpty(val) && (valueCounts.get(val) || 0) <= 1;
      } else if (ruleType === 'range') {
        const parsed = parseCleanNumber(val);
        if (!parsed.isNum) {
          isPassing = false;
        } else {
          const min = rule.minValue !== undefined ? rule.minValue : -Infinity;
          const max = rule.maxValue !== undefined ? rule.maxValue : Infinity;
          isPassing = parsed.value >= min && parsed.value <= max;
        }
      } else if (ruleType === 'allowed_values' && rule.allowedList) {
        const sVal = String(val ?? '').trim().toLowerCase();
        const allowed = rule.allowedList.map(item => String(item).trim().toLowerCase());
        isPassing = allowed.includes(sVal);
      } else if (rule.ruleType === 'date_comparison' && rule.secondColumn) {
        const d1 = new Date(val);
        const d2 = new Date(row[rule.secondColumn]);
        if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
          isPassing = false;
        } else {
          // Defaults to column <= secondColumn (e.g., OrderDate <= ShipDate)
          const op = rule.operator || '<=';
          if (op === '<=') isPassing = d1.getTime() <= d2.getTime();
          else if (op === '>=') isPassing = d1.getTime() >= d2.getTime();
          else if (op === '<') isPassing = d1.getTime() < d2.getTime();
          else if (op === '>') isPassing = d1.getTime() > d2.getTime();
          else if (op === '==') isPassing = d1.getTime() === d2.getTime();
        }
      } else if (rule.ruleType === 'column_comparison' && rule.secondColumn) {
        const p1 = parseCleanNumber(val);
        const p2 = parseCleanNumber(row[rule.secondColumn]);
        if (p1.isNum && p2.isNum) {
          const op = rule.operator || '>=';
          if (op === '>=') isPassing = p1.value >= p2.value;
          else if (op === '<=') isPassing = p1.value <= p2.value;
          else if (op === '>') isPassing = p1.value > p2.value;
          else if (op === '<') isPassing = p1.value < p2.value;
          else if (op === '==') isPassing = p1.value === p2.value;
          else if (op === '!=') isPassing = p1.value !== p2.value;
        } else {
          isPassing = false;
        }
      } else if (rule.ruleType === 'regex' && rule.expectedValue) {
        try {
          const reg = new RegExp(rule.expectedValue);
          isPassing = reg.test(String(val ?? ''));
        } catch {
          isPassing = true;
        }
      }

      if (isPassing) {
        passedCount++;
      } else {
        failedCount++;
        if (sampleViolations.length < 5) {
          // Extract a 3-column summary for context
          const rowSummary: Record<string, any> = {};
          const keys = Object.keys(row).slice(0, 4);
          for (const k of keys) {
            rowSummary[k] = row[k];
          }
          sampleViolations.push({
            rowIndex: i + 1,
            value: val,
            rowSummary,
          });
        }
      }
    }

    const totalEvaluated = passedCount + failedCount;
    const passRate = totalEvaluated > 0 ? Math.round((passedCount / totalEvaluated) * 1000) / 10 : 100;
    const status = passRate >= 99 ? 'passed' : passRate >= 90 ? 'warning' : 'failed';

    results.push({
      ruleId: rule.id,
      name: rule.name,
      column: col,
      passedCount,
      failedCount,
      totalEvaluated,
      passRate,
      status,
      sampleViolations,
    });
  }

  const hasFail = results.some(r => r.status === 'failed');
  const hasWarn = results.some(r => r.status === 'warning');
  const overallStatus: 'pass' | 'warn' | 'fail' = hasFail ? 'fail' : hasWarn ? 'warn' : 'pass';

  const out: any = [...results];
  out.results = results;
  out.overallStatus = overallStatus;
  out.passedCount = results.filter(r => r.status === 'passed').length;
  out.failedCount = results.filter(r => r.status === 'failed').length;

  return out;
}

