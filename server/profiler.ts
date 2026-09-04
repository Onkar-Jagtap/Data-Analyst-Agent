import { ColumnProfile, DatasetProfile, DataType, PiiDetection } from './types.js';

// Helper to check if a value is effectively null or empty
export function isNullOrEmpty(val: any): boolean {
  if (val === null || val === undefined) return true;
  if (typeof val === 'number' && isNaN(val)) return true;
  if (typeof val === 'string') {
    const trimmed = val.trim().toLowerCase();
    return trimmed === '' || trimmed === 'null' || trimmed === 'none' || trimmed === 'nan' || trimmed === 'n/a' || trimmed === 'na' || trimmed === 'undefined' || trimmed === '-';
  }
  return false;
}

// Clean string numbers (e.g. "$1,250.00", "75%", "(500)")
export function parseCleanNumber(val: any): { isNum: boolean; value: number } {
  if (typeof val === 'number') {
    return isNaN(val) ? { isNum: false, value: 0 } : { isNum: true, value: val };
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed === '') return { isNum: false, value: 0 };
    // Check if it's bracketed negative e.g. (100)
    let cleaned = trimmed;
    let isNeg = false;
    if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
      isNeg = true;
      cleaned = cleaned.slice(1, -1).trim();
    }
    // Remove currency symbols, commas, percent
    cleaned = cleaned.replace(/[$€£¥₹,%]/g, '').trim();
    if (cleaned === '' || isNaN(Number(cleaned))) {
      return { isNum: false, value: 0 };
    }
    const num = Number(cleaned);
    return { isNum: true, value: isNeg ? -Math.abs(num) : num };
  }
  return { isNum: false, value: 0 };
}

// Check if string is a valid date (supports timestamps, ISO, and standard formats)
export function parseDateSafe(val: any): Date | null {
  if (val === null || val === undefined) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'number') {
    // Check if timestamp in seconds (between 2000 and 2100: 946684800 to 4102444800)
    if (val >= 946684800 && val <= 4102444800) {
      return new Date(val * 1000);
    }
    // Check if timestamp in milliseconds (between 2000 and 2100: 946684800000 to 4102444800000)
    if (val >= 946684800000 && val <= 4102444800000) {
      return new Date(val);
    }
    return null;
  }
  if (typeof val !== 'string') return null;
  const str = val.trim();
  // Avoid treating plain short numbers (e.g. 2024 or 42) as dates unless formatted
  if (/^\d{1,4}$/.test(str)) return null;

  // Check common date patterns (YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, ISO)
  if (!/\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}/.test(str) && !/T\d{2}:\d{2}/.test(str)) {
    return null;
  }
  const parsed = new Date(str);
  if (isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  if (year < 1970 || year > 2100) return null;
  return parsed;
}

// Detect potential Personally Identifiable Information (PII)
export function detectColumnPii(colName: string, sampleValues: any[]): PiiDetection | null {
  const lower = colName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const nonNulls = sampleValues.filter(v => !isNullOrEmpty(v)).map(v => String(v).trim());

  // Email check
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const emailMatches = nonNulls.filter(s => emailRegex.test(s)).length;
  if (emailMatches > 0 || lower.includes('email')) {
    return {
      column: colName,
      category: 'email',
      severity: 'high',
      matchedCount: emailMatches || nonNulls.length,
      recommendation: 'Email addresses constitute direct PII under GDPR/CCPA. Mask before reporting or sharing.',
    };
  }

  // Phone check
  const phoneRegex = /^(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/;
  const phoneMatches = nonNulls.filter(s => phoneRegex.test(s)).length;
  if (phoneMatches > 0 || lower.includes('phone') || lower.includes('mobile') || lower.includes('cellphone')) {
    return {
      column: colName,
      category: 'phone',
      severity: 'high',
      matchedCount: phoneMatches || nonNulls.length,
      recommendation: 'Telephone numbers are direct personal identifiers. Apply phone number masking.',
    };
  }

  // SSN check
  const ssnRegex = /^\d{3}-\d{2}-\d{4}$/;
  const ssnMatches = nonNulls.filter(s => ssnRegex.test(s)).length;
  if (ssnMatches > 0 || lower.includes('ssn') || lower.includes('socialsecurity')) {
    return {
      column: colName,
      category: 'ssn',
      severity: 'high',
      matchedCount: ssnMatches || nonNulls.length,
      recommendation: 'Social Security Numbers represent critical high-risk credentials. Immediate redaction required.',
    };
  }

  // Credit card check
  const ccRegex = /^(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})$/;
  const cleanCcMatches = nonNulls.filter(s => ccRegex.test(s.replace(/[-\s]/g, ''))).length;
  if (cleanCcMatches > 0 || lower.includes('cardnumber') || lower.includes('creditcard')) {
    return {
      column: colName,
      category: 'credit_card',
      severity: 'high',
      matchedCount: cleanCcMatches || nonNulls.length,
      recommendation: 'Payment card data detected (PCI-DSS violation risk). Truncate to last 4 digits or mask entirely.',
    };
  }

  // IP Address check
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const ipMatches = nonNulls.filter(s => ipRegex.test(s)).length;
  if (ipMatches > 0 || lower.includes('ipaddress') || lower.includes('clientip')) {
    return {
      column: colName,
      category: 'ip_address',
      severity: 'medium',
      matchedCount: ipMatches || nonNulls.length,
      recommendation: 'Network IP addresses are quasi-identifiers under GDPR. Anonymize client IPs.',
    };
  }

  // Personal customer or employee names
  if (lower.includes('firstname') || lower.includes('lastname') || lower.includes('fullname') || lower === 'name' || lower.includes('customername')) {
    return {
      column: colName,
      category: 'name',
      severity: 'medium',
      matchedCount: nonNulls.length,
      recommendation: 'Personal customer/employee names detected. Consider pseudonymous hashing.',
    };
  }

  return null;
}

// Infer column data type based on sample values
export function inferColumnType(values: any[], colName: string): { type: DataType; isIdentifier: boolean } {
  const nonNulls = values.filter(v => !isNullOrEmpty(v));
  if (nonNulls.length === 0) {
    return { type: 'unknown', isIdentifier: false };
  }

  const lowerName = colName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const idKeywords = ['id', 'sku', 'uuid', 'guid', 'code', 'token', 'key', 'email', 'phone', 'ssn', 'account'];
  const hasIdName = idKeywords.some(k => lowerName.endsWith(k) || lowerName.startsWith(k) || lowerName === k);

  // Check boolean
  let boolCount = 0;
  for (const v of nonNulls) {
    const s = String(v).toLowerCase().trim();
    if (s === 'true' || s === 'false' || s === 'yes' || s === 'no' || s === 't' || s === 'f') {
      boolCount++;
    }
  }
  if (boolCount / nonNulls.length > 0.85) {
    return { type: 'boolean', isIdentifier: false };
  }

  // Check numeric
  let numCount = 0;
  for (const v of nonNulls) {
    if (parseCleanNumber(v).isNum) numCount++;
  }
  const numericRatio = numCount / nonNulls.length;

  // Check date
  let dateCount = 0;
  for (const v of nonNulls) {
    if (parseDateSafe(v) !== null) dateCount++;
  }
  const dateRatio = dateCount / nonNulls.length;

  const uniqueSet = new Set(nonNulls.map(v => String(v).trim()));
  const isHighUnique = uniqueSet.size / nonNulls.length > 0.95 && nonNulls.length > 10;

  if (hasIdName && isHighUnique) {
    return { type: 'identifier', isIdentifier: true };
  }

  if (dateRatio > 0.75) {
    return { type: 'datetime', isIdentifier: false };
  }

  if (numericRatio > 0.8) {
    // If it's pure numbers but called "CustomerID" or "Postal Code"
    if (hasIdName && isHighUnique) {
      return { type: 'identifier', isIdentifier: true };
    }
    return { type: 'numeric', isIdentifier: false };
  }

  if (isHighUnique && (hasIdName || colName.toLowerCase().includes('hash'))) {
    return { type: 'identifier', isIdentifier: true };
  }

  // Categorical vs Text: low cardinality = categorical
  if (uniqueSet.size < 50 || uniqueSet.size / nonNulls.length < 0.3) {
    return { type: 'categorical', isIdentifier: false };
  }

  return { type: 'text', isIdentifier: false };
}

// Calculate statistical metrics for numeric series
export function computeNumericStats(numbers: number[]) {
  if (numbers.length === 0) {
    return {};
  }
  const n = numbers.length;
  const sorted = [...numbers].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[n - 1];
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const mean = sum / n;

  // Percentiles
  const getPercentile = (p: number) => {
    const idx = (n - 1) * p;
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    const weight = idx - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  };

  const q1 = getPercentile(0.25);
  const median = getPercentile(0.5);
  const q3 = getPercentile(0.75);
  const iqr = q3 - q1;

  // Variance & Std
  const variance = sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (n > 1 ? n - 1 : 1);
  const std = Math.sqrt(Math.max(0, variance));

  // Outliers
  const iqrLowerBound = q1 - 1.5 * iqr;
  const iqrUpperBound = q3 + 1.5 * iqr;
  let outlierCountIqr = 0;
  let outlierCountZ = 0;

  for (const num of sorted) {
    if (num < iqrLowerBound || num > iqrUpperBound) {
      outlierCountIqr++;
    }
    if (std > 0 && Math.abs((num - mean) / std) > 3) {
      outlierCountZ++;
    }
  }

  // Distribution shape
  let distributionShape: 'normal' | 'right-skewed' | 'left-skewed' | 'uniform' | 'bimodal' = 'normal';
  if (std === 0 || min === max) {
    distributionShape = 'uniform';
  } else {
    const skewnessProxy = (mean - median) / (std || 1);
    if (skewnessProxy > 0.45) distributionShape = 'right-skewed';
    else if (skewnessProxy < -0.45) distributionShape = 'left-skewed';
    else distributionShape = 'normal';
  }

  // 10 Bins Histogram
  const binCount = Math.min(10, Math.max(3, Math.floor(Math.sqrt(n))));
  const binStep = (max - min) / binCount || 1;
  const bins: { min: number; max: number; count: number; label: string }[] = [];

  for (let i = 0; i < binCount; i++) {
    const bMin = min + i * binStep;
    const bMax = i === binCount - 1 ? max + 0.0001 : min + (i + 1) * binStep;
    bins.push({
      min: Math.round(bMin * 100) / 100,
      max: Math.round(bMax * 100) / 100,
      count: 0,
      label: `${Math.round(bMin * 10) / 10} - ${Math.round(bMax * 10) / 10}`,
    });
  }

  for (const num of sorted) {
    let placed = false;
    for (const b of bins) {
      if (num >= b.min && num <= b.max) {
        b.count++;
        placed = true;
        break;
      }
    }
    if (!placed && bins.length > 0) {
      bins[bins.length - 1].count++;
    }
  }

  return {
    min: Math.round(min * 1000) / 1000,
    max: Math.round(max * 1000) / 1000,
    sum: Math.round(sum * 100) / 100,
    mean: Math.round(mean * 1000) / 1000,
    median: Math.round(median * 1000) / 1000,
    std: Math.round(std * 1000) / 1000,
    stdDev: Math.round(std * 1000) / 1000,
    variance: Math.round(variance * 1000) / 1000,
    q1: Math.round(q1 * 1000) / 1000,
    q3: Math.round(q3 * 1000) / 1000,
    iqr: Math.round(iqr * 1000) / 1000,
    outlierCountIqr,
    outlierCountZ,
    distributionShape,
    histogramBins: bins,
  };
}

export function profileDataset(data: Record<string, any>[], filename: string, datasetId: string, _optionalLimit?: number): DatasetProfile {
  const rowCount = data.length;
  if (rowCount === 0) {
    return {
      id: datasetId,
      filename,
      rowCount: 0,
      columnCount: 0,
      memoryEstimateKb: 0,
      duplicateRowCount: 0,
      duplicatePercentage: 0,
      totalMissingCells: 0,
      missingPercentage: 0,
      columns: [],
      createdAt: new Date().toISOString(),
    };
  }

  const columns = Object.keys(data[0]);
  const columnCount = columns.length;

  // Duplicate rows check
  const rowStrings = new Set<string>();
  let duplicateRowCount = 0;
  for (const row of data) {
    const serialized = JSON.stringify(row);
    if (rowStrings.has(serialized)) {
      duplicateRowCount++;
    } else {
      rowStrings.add(serialized);
    }
  }
  const duplicatePercentage = Math.round((duplicateRowCount / rowCount) * 1000) / 10;

  let totalMissingCells = 0;
  const columnProfiles: ColumnProfile[] = [];

  for (const col of columns) {
    const rawValues = data.map(r => r[col]);
    let nullCount = 0;
    const nonNullValues: any[] = [];

    for (const v of rawValues) {
      if (isNullOrEmpty(v)) {
        nullCount++;
      } else {
        nonNullValues.push(v);
      }
    }
    totalMissingCells += nullCount;

    const nullPercentage = Math.round((nullCount / rowCount) * 1000) / 10;
    const { type, isIdentifier } = inferColumnType(rawValues, col);

    // Unique count
    const uniqueValuesMap = new Map<string, number>();
    for (const v of nonNullValues) {
      const key = String(v).trim();
      uniqueValuesMap.set(key, (uniqueValuesMap.get(key) || 0) + 1);
    }
    const uniqueCount = uniqueValuesMap.size;
    const uniquePercentage = Math.round((uniqueCount / (nonNullValues.length || 1)) * 1000) / 10;

    // Sample preview values
    const sampleValues = nonNullValues.slice(0, 5);

    const profile: ColumnProfile = {
      name: col,
      type,
      totalCount: rowCount,
      nullCount,
      nullPercentage,
      uniqueCount,
      uniquePercentage,
      sampleValues,
      isIdentifier,
    };

    // Numeric column processing
    if (type === 'numeric') {
      const numbers: number[] = [];
      let suspiciousNegatives = 0;
      for (const v of nonNullValues) {
        const parsed = parseCleanNumber(v);
        if (parsed.isNum) {
          numbers.push(parsed.value);
          // Check suspicious negative values
          const lower = col.toLowerCase();
          if ((lower.includes('rev') || lower.includes('sale') || lower.includes('price') || lower.includes('qty') || lower.includes('quantity')) && parsed.value < 0) {
            suspiciousNegatives++;
          }
        }
      }

      const numStats = computeNumericStats(numbers);
      Object.assign(profile, numStats);
      profile.stats = {
        min: numStats.min,
        max: numStats.max,
        mean: numStats.mean,
        median: numStats.median,
        std: numStats.std,
        stdDev: numStats.stdDev,
        variance: numStats.variance,
        sum: numStats.sum,
        q1: numStats.q1,
        q3: numStats.q3,
        iqr: numStats.iqr,
      };

      if (suspiciousNegatives > 0) {
        profile.suspiciousValuesCount = suspiciousNegatives;
        profile.suspiciousReasons = [`Contains ${suspiciousNegatives} negative values which may represent adjustments, refunds, or anomalies.`];
      }
    }

    // Categorical & Text processing
    if (type === 'categorical' || type === 'text' || type === 'boolean') {
      const sortedCategories = Array.from(uniqueValuesMap.entries())
        .map(([category, count]) => ({
          category,
          count,
          percentage: Math.round((count / (nonNullValues.length || 1)) * 1000) / 10,
        }))
        .sort((a, b) => b.count - a.count);

      profile.topCategories = sortedCategories.slice(0, 8);
      if (sortedCategories.length > 0) {
        profile.mode = sortedCategories[0].category;
      }
    }

    // Datetime processing
    if (type === 'datetime') {
      const validDates: Date[] = [];
      for (const v of nonNullValues) {
        const d = parseDateSafe(v);
        if (d) validDates.push(d);
      }
      if (validDates.length > 0) {
        validDates.sort((a, b) => a.getTime() - b.getTime());
        profile.earliestDate = validDates[0].toISOString().split('T')[0];
        profile.latestDate = validDates[validDates.length - 1].toISOString().split('T')[0];
        const spanMs = validDates[validDates.length - 1].getTime() - validDates[0].getTime();
        profile.dateRangeDays = Math.round(spanMs / (1000 * 60 * 60 * 24));
      }
    }

    columnProfiles.push(profile);
  }

  // Scan dataset columns for PII detections
  const piiSummary: PiiDetection[] = [];
  for (const col of columnProfiles) {
    const pii = detectColumnPii(col.name, col.sampleValues);
    if (pii) {
      piiSummary.push(pii);
    }
  }

  const totalCells = rowCount * columnCount;
  const missingPercentage = totalCells > 0 ? Math.round((totalMissingCells / totalCells) * 1000) / 10 : 0;
  const memoryEstimateKb = Math.round((JSON.stringify(data).length * 2) / 1024);

  return {
    id: datasetId,
    filename,
    rowCount,
    columnCount,
    memoryEstimateKb,
    duplicateRowCount,
    duplicateRowsCount: duplicateRowCount,
    duplicatePercentage,
    totalMissingCells,
    missingPercentage,
    columns: columnProfiles,
    piiSummary,
    createdAt: new Date().toISOString(),
  };
}
