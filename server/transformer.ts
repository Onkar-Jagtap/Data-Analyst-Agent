import { ColumnProfile, DataType, DatasetProfile, TransformRequest } from './types.js';
import { isNullOrEmpty, parseCleanNumber, parseDateSafe } from './profiler.js';

export interface TransformExecutionResult {
  success: boolean;
  action: string;
  summary: string;
  rowsAffected: number;
  newColumnNames: string[];
  previewDifferences: { index: number; column: string; before: any; after: any }[];
  transformedData: Record<string, any>[];
  transformedRows: Record<string, any>[];
  manualTypeOverrides?: Record<string, DataType>;
}

// Safely evaluate simple arithmetic expression with column references like [Revenue] * [Quantity] or Revenue * Quantity
function evaluateExpressionForRow(expression: string, row: Record<string, any>, availableCols?: string[]): number | null {
  try {
    let expr = expression;

    // 1. Replace all [ColumnName] tokens with their numeric values
    const colRegex = /\[([^\]]+)\]/g;
    let match;
    const bracketTokens: string[] = [];

    while ((match = colRegex.exec(expression)) !== null) {
      bracketTokens.push(match[1]);
    }

    for (const colName of bracketTokens) {
      const val = row[colName];
      const parsed = parseCleanNumber(val);
      const numVal = parsed.isNum ? parsed.value : 0;
      expr = expr.split(`[${colName}]`).join(`(${numVal})`);
    }

    // 2. Also replace unbracketed column names that exist in row/dataset
    const cols = (availableCols || Object.keys(row)).filter(Boolean).sort((a, b) => b.length - a.length);
    for (const colName of cols) {
      if (expr.includes(colName)) {
        const val = row[colName];
        const parsed = parseCleanNumber(val);
        const numVal = parsed.isNum ? parsed.value : 0;
        const escaped = colName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`\\b${escaped}\\b`, 'g');
        expr = expr.replace(re, `(${numVal})`);
      }
    }

    // Only allow digits, operators, parens, decimal points, and spaces to prevent code injection
    if (!/^[0-9+\-*/().\s%]+$/.test(expr)) {
      return null;
    }

    // Replace % with * 0.01 if used as a modifier e.g. 5% -> 0.05
    expr = expr.replace(/([0-9.]+)\s*%/g, '($1 * 0.01)');

    // Safe mathematical evaluation via Function constructor with strict sandbox
    const result = new Function(`"use strict"; return (${expr});`)();
    if (typeof result === 'number' && !isNaN(result)) {
      if (!isFinite(result)) {
        // Safe division by zero fallback
        return 0;
      }
      return Math.round(result * 10000) / 10000;
    }
    return null;
  } catch (err) {
    return null;
  }
}

export function performTransformation(
  originalRows: Record<string, any>[],
  profile: DatasetProfile | ColumnProfile[],
  request: TransformRequest
): TransformExecutionResult {
  const data = originalRows.map(r => ({ ...r }));
  const previewDifferences: { index: number; column: string; before: any; after: any }[] = [];
  let rowsAffected = 0;
  let summary = '';
  const newColumnNames: string[] = [];
  const manualTypeOverrides: Record<string, DataType> = {};

  const rawReq = request as any;
  let action: string = rawReq.action || rawReq.type;
  if (action === 'formula') action = 'calculated_column';

  const colNames = Array.isArray(profile) ? profile.map(c => c.name) : (profile.columns || []).map(c => c.name);

  // 1. CALCULATED COLUMN
  if (action === 'calculated_column') {
    const colName = (rawReq.newColumnName || rawReq.targetColumn || 'New_Calculation').trim();
    newColumnNames.push(colName);
    const expression = rawReq.expression || rawReq.formula;

    if (request.calcMode === 'binary_op') {
      const op1 = request.operand1 || '';
      const op = request.operator || '+';
      const op2 = request.operand2 || '';
      const isConst = !!request.isOperand2Constant;
      const constNum = isConst ? parseCleanNumber(op2).value : 0;

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const v1 = row[op1];
        const v2 = isConst ? constNum : row[op2];

        let resultVal: any = null;

        if (op === 'concat') {
          resultVal = `${v1 ?? ''} ${v2 ?? ''}`.trim();
        } else {
          const num1 = parseCleanNumber(v1).value;
          const num2 = isConst ? constNum : parseCleanNumber(v2).value;

          if (op === '+') resultVal = Math.round((num1 + num2) * 10000) / 10000;
          else if (op === '-') resultVal = Math.round((num1 - num2) * 10000) / 10000;
          else if (op === '*') resultVal = Math.round((num1 * num2) * 10000) / 10000;
          else if (op === '/') resultVal = num2 !== 0 ? Math.round((num1 / num2) * 10000) / 10000 : 0;
          else if (op === '%') resultVal = num2 !== 0 ? Math.round(((num1 / num2) * 100) * 100) / 100 : 0;
        }

        row[colName] = resultVal;
        rowsAffected++;

        if (previewDifferences.length < 8) {
          previewDifferences.push({
            index: i + 1,
            column: colName,
            before: '(new)',
            after: resultVal,
          });
        }
      }

      summary = `Created calculated column '${colName}' using ${op1} ${op} ${isConst ? op2 : `[${op2}]`} across ${rowsAffected.toLocaleString()} rows.`;
      if (op !== 'concat') {
        manualTypeOverrides[colName] = 'numeric';
      }
    } else if (expression || rawReq.calcMode === 'expression') {
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const resultVal = evaluateExpressionForRow(expression!, row, colNames);
        row[colName] = resultVal;
        if (resultVal !== null) rowsAffected++;

        if (previewDifferences.length < 8) {
          previewDifferences.push({
            index: i + 1,
            column: colName,
            before: '(new)',
            after: resultVal,
          });
        }
      }

      summary = `Evaluated formula expression '${expression}' into column '${colName}'.`;
      manualTypeOverrides[colName] = 'numeric';
    } else if (request.calcMode === 'condition') {
      const condCol = request.conditionCol || '';
      const condOp = request.conditionOp || '>';
      const condVal = request.conditionVal;
      const parsedCondVal = parseCleanNumber(condVal).isNum ? parseCleanNumber(condVal).value : condVal;
      const trueVal = request.trueVal ?? 'True';
      const falseVal = request.falseVal ?? 'False';

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const val = row[condCol];
        const parsedVal = parseCleanNumber(val).isNum ? parseCleanNumber(val).value : val;

        let conditionMet = false;
        if (typeof parsedVal === 'number' && typeof parsedCondVal === 'number') {
          if (condOp === '>') conditionMet = parsedVal > parsedCondVal;
          else if (condOp === '>=') conditionMet = parsedVal >= parsedCondVal;
          else if (condOp === '<') conditionMet = parsedVal < parsedCondVal;
          else if (condOp === '<=') conditionMet = parsedVal <= parsedCondVal;
          else if (condOp === '==') conditionMet = parsedVal === parsedCondVal;
          else if (condOp === '!=') conditionMet = parsedVal !== parsedCondVal;
        } else {
          const sVal = String(val ?? '').toLowerCase();
          const sCond = String(condVal ?? '').toLowerCase();
          if (condOp === 'contains') conditionMet = sVal.includes(sCond);
          else if (condOp === '==') conditionMet = sVal === sCond;
          else if (condOp === '!=') conditionMet = sVal !== sCond;
        }

        const finalVal = conditionMet ? trueVal : falseVal;
        row[colName] = finalVal;
        rowsAffected++;

        if (previewDifferences.length < 8) {
          previewDifferences.push({
            index: i + 1,
            column: colName,
            before: '(new)',
            after: finalVal,
          });
        }
      }

      summary = `Created conditional column '${colName}' evaluating IF [${condCol}] ${condOp} ${condVal}.`;
    }
  }

  // 2. DATA TYPE CASTING OVERRIDES
  else if (request.action === 'cast_type') {
    const col = request.column!;
    const targetType = request.targetType || 'text';
    manualTypeOverrides[col] = targetType;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const prev = row[col];
      let transformed = prev;

      if (targetType === 'numeric') {
        const parsed = parseCleanNumber(prev);
        transformed = parsed.isNum ? parsed.value : null;
      } else if (targetType === 'text' || targetType === 'categorical') {
        transformed = isNullOrEmpty(prev) ? '' : String(prev).trim();
      } else if (targetType === 'datetime') {
        if (!isNullOrEmpty(prev)) {
          const d = new Date(prev);
          transformed = !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : prev;
        }
      } else if (targetType === 'boolean') {
        const s = String(prev).toLowerCase().trim();
        transformed = s === 'true' || s === '1' || s === 'yes' || s === 'y' ? true : false;
      }

      if (transformed !== prev) {
        rowsAffected++;
        row[col] = transformed;
        if (previewDifferences.length < 8) {
          previewDifferences.push({
            index: i + 1,
            column: col,
            before: prev,
            after: transformed,
          });
        }
      }
    }

    summary = `Cast column '${col}' to type '${targetType.toUpperCase()}'. (${rowsAffected.toLocaleString()} values coerced).`;
  }

  // 3. SPLIT COLUMN
  else if (action === 'split_column') {
    const col = rawReq.splitCol || rawReq.column || rawReq.sourceColumn;
    const delimiter = rawReq.delimiter || ' ';
    const count = rawReq.maxSplits || (rawReq.partNames ? rawReq.partNames.length : 2);
    const targetCol = rawReq.targetColumn;
    const partNames = rawReq.partNames || (targetCol ? [`${targetCol}_1`, `${targetCol}_2`] : Array.from({ length: count }, (_, idx) => `${col}_Part${idx + 1}`));
    newColumnNames.push(...partNames);

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const val = String(row[col] || '');
      const parts = val.split(delimiter);

      for (let p = 0; p < partNames.length; p++) {
        const partName = partNames[p];
        const partVal = parts[p] !== undefined ? parts[p].trim() : '';
        row[partName] = partVal;

        if (i < 4 && previewDifferences.length < 8) {
          previewDifferences.push({
            index: i + 1,
            column: partName,
            before: '(split)',
            after: partVal,
          });
        }
      }
      rowsAffected++;
    }

    summary = `Split column '${col}' by '${delimiter}' into ${partNames.join(', ')} across ${rowsAffected.toLocaleString()} rows.`;
  }

  // 4. FIND AND REPLACE
  else if (action === 'find_replace') {
    const col = rawReq.column || rawReq.sourceColumn || rawReq.targetColumn;
    const findText = rawReq.findText ?? rawReq.findValue ?? '';
    const replaceText = rawReq.replaceText ?? rawReq.replaceValue ?? '';

    let regex: RegExp;
    try {
      regex = rawReq.isRegex ? new RegExp(findText, 'g') : new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    } catch {
      regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    }

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const prev = row[col];
      if (prev !== null && prev !== undefined) {
        const str = String(prev);
        if (regex.test(str)) {
          const next = str.replace(regex, replaceText);
          row[col] = next;
          rowsAffected++;
          if (previewDifferences.length < 8) {
            previewDifferences.push({
              index: i + 1,
              column: col,
              before: prev,
              after: next,
            });
          }
        }
      }
    }

    summary = `Replaced '${findText}' with '${replaceText}' in column '${col}' across ${rowsAffected.toLocaleString()} cells.`;
  }

  // 5. TEXT CASE / FORMATTING
  else if (action === 'text_case') {
    const col = rawReq.column || rawReq.sourceColumn;
    const mode = rawReq.caseType || rawReq.caseMode || 'trim';

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const prev = row[col];
      if (prev !== null && prev !== undefined) {
        const str = String(prev);
        let next = str;

        if (mode === 'upper') next = str.toUpperCase();
        else if (mode === 'lower') next = str.toLowerCase();
        else if (mode === 'title') {
          next = str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
        } else if (mode === 'trim') next = str.trim();

        if (next !== str) {
          row[col] = next;
          rowsAffected++;
          if (previewDifferences.length < 8) {
            previewDifferences.push({
              index: i + 1,
              column: col,
              before: prev,
              after: next,
            });
          }
        }
      }
    }

    summary = `Applied '${mode}' text transform to column '${col}' on ${rowsAffected.toLocaleString()} cells.`;
  }

  // 6. DATE EXTRACTION
  else if (action === 'date_extract') {
    const col = rawReq.column || rawReq.sourceColumn;
    const targetCol = (rawReq.newColumnName || rawReq.targetColumn || `${col}_Extracted`).trim();
    const datePart = rawReq.datePart || 'year';
    newColumnNames.push(targetCol);

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const val = row[col];
      const d = parseDateSafe(val);
      let extracted: any = null;
      if (d) {
        if (datePart === 'year') extracted = d.getFullYear();
        else if (datePart === 'month') extracted = d.getMonth() + 1;
        else if (datePart === 'day') extracted = d.getDate();
        else if (datePart === 'quarter') extracted = Math.floor(d.getMonth() / 3) + 1;
      }
      row[targetCol] = extracted;
      if (extracted !== null) rowsAffected++;
    }

    summary = `Extracted ${datePart} from '${col}' into '${targetCol}' across ${rowsAffected} rows.`;
    manualTypeOverrides[targetCol] = 'numeric';
  }

  return {
    success: true,
    action,
    summary,
    rowsAffected,
    newColumnNames,
    previewDifferences,
    transformedData: data,
    transformedRows: data,
    manualTypeOverrides: Object.keys(manualTypeOverrides).length > 0 ? manualTypeOverrides : undefined,
  };
}
