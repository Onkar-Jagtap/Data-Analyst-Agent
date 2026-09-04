import { DatasetProfile } from './types.js';
import { isNullOrEmpty, parseCleanNumber } from './profiler.js';

export interface CleaningResult {
  success: boolean;
  action: string;
  column?: string;
  beforeCount: number;
  afterCount: number;
  rowsAffected: number;
  summary: string;
  cleanedData: Record<string, any>[];
  cleanedRows: Record<string, any>[];
  previewDifferences: { index: number; column: string; before: any; after: any }[];
}

function _performDataCleaning(
  originalRows: Record<string, any>[],
  profile: DatasetProfile,
  action: string,
  targetColumn?: string,
  constantValue?: any
): Omit<CleaningResult, 'cleanedRows'> {
  // Deep clone to ensure original rows remain completely untouched
  const data: Record<string, any>[] = originalRows.map(r => ({ ...r }));
  const beforeCount = data.length;
  const previewDiffs: { index: number; column: string; before: any; after: any }[] = [];
  let rowsAffected = 0;
  let summary = '';

  // 1. Remove duplicate rows
  if (action === 'remove_duplicates' || action === 'deduplicate') {
    const seen = new Set<string>();
    const deduplicated: Record<string, any>[] = [];

    for (let i = 0; i < data.length; i++) {
      const serialized = JSON.stringify(data[i]);
      if (seen.has(serialized)) {
        rowsAffected++;
        if (previewDiffs.length < 10) {
          previewDiffs.push({
            index: i,
            column: 'All',
            before: 'Duplicate row',
            after: 'Removed',
          });
        }
      } else {
        seen.add(serialized);
        deduplicated.push(data[i]);
      }
    }

    summary = `Removed ${rowsAffected} duplicate records. Row count reduced from ${beforeCount} to ${deduplicated.length}.`;
    return {
      success: true,
      action,
      beforeCount,
      afterCount: deduplicated.length,
      rowsAffected,
      summary,
      cleanedData: deduplicated,
      previewDifferences: previewDiffs,
    };
  }

  // 2. Exclude null rows for column or entire row
  if (action === 'exclude_nulls') {
    const filtered: Record<string, any>[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      let hasNull = false;

      if (targetColumn) {
        hasNull = isNullOrEmpty(row[targetColumn]);
      } else {
        hasNull = Object.values(row).some(v => isNullOrEmpty(v));
      }

      if (hasNull) {
        rowsAffected++;
        if (previewDiffs.length < 10) {
          previewDiffs.push({
            index: i,
            column: targetColumn || 'Any',
            before: targetColumn ? row[targetColumn] : 'Null cell',
            after: 'Row Excluded',
          });
        }
      } else {
        filtered.push(row);
      }
    }

    summary = `Excluded ${rowsAffected} rows containing missing values in '${targetColumn || 'any column'}'.`;
    return {
      success: true,
      action,
      column: targetColumn,
      beforeCount,
      afterCount: filtered.length,
      rowsAffected,
      summary,
      cleanedData: filtered,
      previewDifferences: previewDiffs,
    };
  }

  // 3. Impute Missing Values (Mean or Median or Mode or Constant)
  if (action.startsWith('impute_') && targetColumn) {
    const colProfile = profile.columns.find(c => c.name === targetColumn);
    let fillValue: any = constantValue;

    if (action === 'impute_mean' && colProfile?.mean !== undefined) {
      fillValue = Math.round(colProfile.mean * 100) / 100;
    } else if (action === 'impute_median' && colProfile?.median !== undefined) {
      fillValue = colProfile.median;
    } else if (action === 'impute_mode' && colProfile?.mode !== undefined) {
      fillValue = colProfile.mode;
    } else if (action === 'impute_constant') {
      fillValue = constantValue !== undefined ? constantValue : 'Unknown';
    }

    for (let i = 0; i < data.length; i++) {
      if (isNullOrEmpty(data[i][targetColumn])) {
        const prev = data[i][targetColumn];
        data[i][targetColumn] = fillValue;
        rowsAffected++;
        if (previewDiffs.length < 10) {
          previewDiffs.push({
            index: i,
            column: targetColumn,
            before: prev ?? 'null',
            after: fillValue,
          });
        }
      }
    }

    summary = `Imputed ${rowsAffected} missing values in '${targetColumn}' with ${action.replace('impute_', '')} value (${fillValue}).`;
    return {
      success: true,
      action,
      column: targetColumn,
      beforeCount,
      afterCount: data.length,
      rowsAffected,
      summary,
      cleanedData: data,
      previewDifferences: previewDiffs,
    };
  }

  // 4. Coerce non-numeric strings to numbers
  if (action === 'coerce_numeric' && targetColumn) {
    for (let i = 0; i < data.length; i++) {
      const val = data[i][targetColumn];
      if (!isNullOrEmpty(val) && typeof val === 'string') {
        const parsed = parseCleanNumber(val);
        if (parsed.isNum) {
          data[i][targetColumn] = parsed.value;
          rowsAffected++;
          if (previewDiffs.length < 10) {
            previewDiffs.push({
              index: i,
              column: targetColumn,
              before: val,
              after: parsed.value,
            });
          }
        }
      }
    }

    summary = `Cleaned and normalized ${rowsAffected} numeric strings in '${targetColumn}'.`;
    return {
      success: true,
      action,
      column: targetColumn,
      beforeCount,
      afterCount: data.length,
      rowsAffected,
      summary,
      cleanedData: data,
      previewDifferences: previewDiffs,
    };
  }

  // 5. Trim Outliers via IQR
  if (action === 'trim_outliers' && targetColumn) {
    const colProfile = profile.columns.find(c => c.name === targetColumn);
    if (!colProfile || colProfile.q1 === undefined || colProfile.iqr === undefined) {
      return {
        success: false,
        action,
        column: targetColumn,
        beforeCount,
        afterCount: beforeCount,
        rowsAffected: 0,
        summary: `Cannot calculate IQR bounds for '${targetColumn}'.`,
        cleanedData: data,
        previewDifferences: [],
      };
    }

    const lowerBound = colProfile.q1 - 1.5 * colProfile.iqr;
    const upperBound = colProfile.q3! + 1.5 * colProfile.iqr;
    const retained: Record<string, any>[] = [];

    for (let i = 0; i < data.length; i++) {
      const val = parseCleanNumber(data[i][targetColumn]);
      if (val.isNum && (val.value < lowerBound || val.value > upperBound)) {
        rowsAffected++;
        if (previewDiffs.length < 10) {
          previewDiffs.push({
            index: i,
            column: targetColumn,
            before: val.value,
            after: 'Outlier Removed',
          });
        }
      } else {
        retained.push(data[i]);
      }
    }

    summary = `Trimmed ${rowsAffected} outliers exceeding [${Math.round(lowerBound)}, ${Math.round(upperBound)}] in '${targetColumn}'.`;
    return {
      success: true,
      action,
      column: targetColumn,
      beforeCount,
      afterCount: retained.length,
      rowsAffected,
      summary,
      cleanedData: retained,
      previewDifferences: previewDiffs,
    };
  }

  // 6. Trim Whitespace / Strings
  if (action === 'trim_whitespace' || action === 'trim_strings') {
    const colsToTrim: string[] = targetColumn ? [targetColumn] : profile.columns.filter(c => c.type === 'text' || c.type === 'categorical').map(c => c.name);

    for (let i = 0; i < data.length; i++) {
      for (const col of colsToTrim) {
        const val = data[i][col];
        if (typeof val === 'string') {
          const trimmed = val.trim();
          if (trimmed !== val) {
            data[i][col] = trimmed;
            rowsAffected++;
            if (previewDiffs.length < 10) {
              previewDiffs.push({
                index: i,
                column: col,
                before: val,
                after: trimmed,
              });
            }
          }
        }
      }
    }

    summary = `Trimmed whitespace across ${rowsAffected} string values in ${targetColumn || 'all text columns'}.`;
    return {
      success: true,
      action,
      column: targetColumn,
      beforeCount,
      afterCount: data.length,
      rowsAffected,
      summary,
      cleanedData: data,
      previewDifferences: previewDiffs,
    };
  }

  // 8. Mask and Redact PII (GDPR / CCPA privacy shield)
  if (action === 'mask_pii') {
    const colsToMask: string[] = [];
    if (targetColumn) {
      colsToMask.push(targetColumn);
    } else {
      const piiSummary = profile.piiSummary || [];
      for (const p of piiSummary) {
        colsToMask.push(p.column);
      }
      if (colsToMask.length === 0) {
        for (const col of profile.columns) {
          const l = col.name.toLowerCase();
          if (l.includes('email') || l.includes('phone') || l.includes('ssn') || l.includes('card') || l.includes('ip') || l.includes('name')) {
            colsToMask.push(col.name);
          }
        }
      }
    }

    if (colsToMask.length === 0) {
      return {
        success: false,
        action,
        beforeCount,
        afterCount: beforeCount,
        rowsAffected: 0,
        summary: 'No PII columns identified for masking.',
        cleanedData: data,
        previewDifferences: [],
      };
    }

    for (let i = 0; i < data.length; i++) {
      let rowChanged = false;
      for (const col of colsToMask) {
        const originalVal = data[i][col];
        if (!isNullOrEmpty(originalVal)) {
          const masked = maskPiiValue(originalVal, col);
          if (masked !== originalVal) {
            data[i][col] = masked;
            rowChanged = true;
            if (previewDiffs.length < 10) {
              previewDiffs.push({
                index: i,
                column: col,
                before: originalVal,
                after: masked,
              });
            }
          }
        }
      }
      if (rowChanged) rowsAffected++;
    }

    summary = `Redacted & masked personal data across ${colsToMask.length} column(s) [${colsToMask.join(', ')}]. ${rowsAffected} rows anonymized.`;
    return {
      success: true,
      action,
      column: targetColumn,
      beforeCount,
      afterCount: data.length,
      rowsAffected,
      summary,
      cleanedData: data,
      previewDifferences: previewDiffs,
    };
  }

  return {
    success: false,
    action,
    beforeCount,
    afterCount: beforeCount,
    rowsAffected: 0,
    summary: `Unsupported action: ${action}`,
    cleanedData: data,
    previewDifferences: [],
  };
}

function maskPiiValue(val: any, colName: string): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (str === '') return '';
  const lower = colName.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Email masking: user@domain.com -> u***@domain.com
  if (str.includes('@') && str.includes('.')) {
    const parts = str.split('@');
    const user = parts[0];
    const domain = parts[1];
    const maskedUser = user.length > 2 ? `${user[0]}***${user[user.length - 1]}` : `${user[0]}***`;
    return `${maskedUser}@${domain}`;
  }

  // Phone number: +1-555-123-4567 -> ***-***-4567
  if (lower.includes('phone') || lower.includes('mobile') || /^\+?\d{1,3}[-.\s]?\(?\d{3}\)?/.test(str)) {
    const digits = str.replace(/\D/g, '');
    const last4 = digits.slice(-4);
    return `***-***-${last4 || 'XXXX'}`;
  }

  // SSN: 123-45-6789 -> ***-**-6789
  if (lower.includes('ssn') || /^\d{3}-\d{2}-\d{4}$/.test(str)) {
    const digits = str.replace(/\D/g, '');
    return `***-**-${digits.slice(-4) || 'XXXX'}`;
  }

  // Credit card: 4111 2222 3333 4444 -> ****-****-****-4444
  if (lower.includes('card') || /^\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}$/.test(str)) {
    const digits = str.replace(/\D/g, '');
    return `****-****-****-${digits.slice(-4) || 'XXXX'}`;
  }

  // IP Address: 192.168.1.100 -> 192.168.1.xxx
  if (lower.includes('ip') && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(str)) {
    const octets = str.split('.');
    return `${octets[0]}.${octets[1]}.${octets[2]}.xxx`;
  }

  // Names: John Doe -> J. D.
  if (lower.includes('name')) {
    const parts = str.split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}. ${parts[parts.length - 1][0]}.`;
    }
    return `${str[0]}***`;
  }

  // Generic identifier fallback
  if (str.length > 6) {
    return `${str.slice(0, 3)}***${str.slice(-2)}`;
  }
  return '***';
}

export function performDataCleaning(
  originalRows: Record<string, any>[],
  profile: DatasetProfile,
  action: string,
  targetColumn?: string,
  constantValue?: any
): CleaningResult {
  const res = _performDataCleaning(originalRows, profile, action, targetColumn, constantValue);
  return {
    ...res,
    cleanedRows: res.cleanedData,
  };
}
