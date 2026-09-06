export interface SqlQueryResult {
  success: boolean;
  columns: string[];
  rows: Record<string, any>[];
  totalCount: number;
  executionTimeMs: number;
  error?: string;
}

interface ParsedSelectField {
  raw: string;
  expression: string;
  alias: string;
  isAggregate: boolean;
  aggFunc?: 'COUNT' | 'SUM' | 'AVG' | 'MEAN' | 'MIN' | 'MAX' | 'MEDIAN';
  aggArg?: string;
  isDistinct?: boolean;
}

function isNullOrEmpty(val: any): boolean {
  return val === null || val === undefined || val === '' || (typeof val === 'number' && isNaN(val));
}

function parseCleanNumber(val: any): { isNum: boolean; value: number } {
  if (val === null || val === undefined || val === '') {
    return { isNum: false, value: 0 };
  }
  if (typeof val === 'number') {
    return isNaN(val) ? { isNum: false, value: 0 } : { isNum: true, value: val };
  }
  const cleanStr = String(val).replace(/[$€£,%\s]/g, '').trim();
  const num = Number(cleanStr);
  if (!isNaN(num) && cleanStr !== '') {
    return { isNum: true, value: num };
  }
  return { isNum: false, value: 0 };
}

function cleanIdentifier(str: string): string {
  if (!str) return '';
  const trimmed = str.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith('`') && trimmed.endsWith('`')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseSelectFields(fieldsStr: string): ParsedSelectField[] {
  const fields: ParsedSelectField[] = [];
  const tokens: string[] = [];
  let depth = 0;
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (let i = 0; i < fieldsStr.length; i++) {
    const char = fieldsStr[i];
    if ((char === '"' || char === "'" || char === '`') && !inQuote) {
      inQuote = true;
      quoteChar = char;
      current += char;
    } else if (char === quoteChar && inQuote) {
      inQuote = false;
      quoteChar = '';
      current += char;
    } else if (!inQuote && char === '(') {
      depth++;
      current += char;
    } else if (!inQuote && char === ')') {
      depth--;
      current += char;
    } else if (!inQuote && depth === 0 && char === ',') {
      tokens.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    tokens.push(current.trim());
  }

  for (const token of tokens) {
    if (token === '*') {
      fields.push({ raw: '*', expression: '*', alias: '*', isAggregate: false });
      continue;
    }

    let expr = token;
    let alias = '';
    const asMatch = token.match(/^(.*?)\s+(?:AS\s+)?([a-zA-Z_0-9"]+)$/i);
    if (asMatch && !token.endsWith(')')) {
      expr = asMatch[1].trim();
      alias = cleanIdentifier(asMatch[2]);
    }

    const aggMatch = expr.match(/^(COUNT|SUM|AVG|MEAN|MIN|MAX|MEDIAN|ROUND)\s*\(\s*(.*?)\s*\)$/i);
    if (aggMatch) {
      let func = aggMatch[1].toUpperCase() as any;
      let arg = aggMatch[2];

      if (func === 'ROUND') {
        const roundInnerMatch = arg.match(/^(AVG|MEAN|SUM|COUNT|MIN|MAX)\s*\(\s*(.*?)\s*\)(?:\s*,\s*(\d+))?$/i);
        if (roundInnerMatch) {
          func = roundInnerMatch[1].toUpperCase() as any;
          arg = roundInnerMatch[2];
        }
      }

      if (func === 'MEAN') func = 'AVG';

      const isDistinct = /^\s*DISTINCT\s+/i.test(arg);
      if (isDistinct) {
        arg = arg.replace(/^\s*DISTINCT\s+/i, '');
      }

      const cleanArg = cleanIdentifier(arg);
      const defaultAlias = alias || `${func.toLowerCase()}_${cleanArg === '*' ? 'all' : cleanArg.replace(/[^a-zA-Z0-9_]/g, '_')}`;

      fields.push({
        raw: token,
        expression: expr,
        alias: defaultAlias,
        isAggregate: true,
        aggFunc: func,
        aggArg: cleanArg,
        isDistinct,
      });
    } else {
      const cleanCol = cleanIdentifier(expr);
      fields.push({
        raw: token,
        expression: expr,
        alias: alias || cleanCol,
        isAggregate: false,
      });
    }
  }

  return fields;
}

function evaluateWhere(row: Record<string, any>, whereStr: string): boolean {
  if (!whereStr || !whereStr.trim()) return true;
  const andClauses = whereStr.split(/\s+AND\s+/i);

  for (const clause of andClauses) {
    const trimmed = clause.trim();
    if (!trimmed) continue;

    const isNullMatch = trimmed.match(/^("?[^"\s]+"?)\s+IS\s+NULL$/i);
    if (isNullMatch) {
      const col = cleanIdentifier(isNullMatch[1]);
      if (!isNullOrEmpty(row[col])) return false;
      continue;
    }

    const isNotNullMatch = trimmed.match(/^("?[^"\s]+"?)\s+IS\s+NOT\s+NULL$/i);
    if (isNotNullMatch) {
      const col = cleanIdentifier(isNotNullMatch[1]);
      if (isNullOrEmpty(row[col])) return false;
      continue;
    }

    const compMatch = trimmed.match(/^("?[^"\s]+"?)\s*(=|!=|<>|>=|<=|>|<|LIKE|ILIKE|IN)\s*(.*?)$/i);
    if (compMatch) {
      const col = cleanIdentifier(compMatch[1]);
      const op = compMatch[2].toUpperCase();
      let rawVal = compMatch[3].trim();

      const rowVal = row[col];
      const parsedRowVal = parseCleanNumber(rowVal);

      if (op === 'IN') {
        const listMatch = rawVal.match(/^\((.*)\)$/);
        if (listMatch) {
          const items = listMatch[1].split(',').map(s => cleanIdentifier(s.trim()).toLowerCase());
          const currentStr = String(rowVal ?? '').toLowerCase();
          if (!items.includes(currentStr)) return false;
        }
        continue;
      }

      if (op === 'LIKE' || op === 'ILIKE') {
        const pattern = cleanIdentifier(rawVal).replace(/%/g, '.*').replace(/_/g, '.');
        const regex = new RegExp(`^${pattern}$`, op === 'ILIKE' ? 'i' : '');
        if (!regex.test(String(rowVal ?? ''))) return false;
        continue;
      }

      const parsedTarget = parseCleanNumber(cleanIdentifier(rawVal));

      if (parsedRowVal.isNum && parsedTarget.isNum) {
        const r = parsedRowVal.value;
        const t = parsedTarget.value;
        if (op === '=' && r !== t) return false;
        if ((op === '!=' || op === '<>') && r === t) return false;
        if (op === '>' && r <= t) return false;
        if (op === '>=' && r < t) return false;
        if (op === '<' && r >= t) return false;
        if (op === '<=' && r > t) return false;
      } else {
        const rStr = String(rowVal ?? '').toLowerCase();
        const tStr = cleanIdentifier(rawVal).toLowerCase();
        if (op === '=' && rStr !== tStr) return false;
        if ((op === '!=' || op === '<>') && rStr === tStr) return false;
        if (op === '>' && rStr <= tStr) return false;
        if (op === '>=' && rStr < tStr) return false;
        if (op === '<' && rStr >= tStr) return false;
        if (op === '<=' && rStr > tStr) return false;
      }
    }
  }

  return true;
}

function computeAgg(
  rows: Record<string, any>[],
  func: 'COUNT' | 'SUM' | 'AVG' | 'MEAN' | 'MIN' | 'MAX' | 'MEDIAN',
  col: string,
  isDistinct = false
): number {
  if (rows.length === 0) return 0;
  if (func === 'COUNT') {
    if (col === '*' || !col) return rows.length;
    let nonNull = rows.map(r => r[col]).filter(v => !isNullOrEmpty(v));
    if (isDistinct) {
      nonNull = Array.from(new Set(nonNull.map(String)));
    }
    return nonNull.length;
  }

  const numbers: number[] = [];
  for (const r of rows) {
    const val = r[col];
    const parsed = parseCleanNumber(val);
    if (parsed.isNum) {
      numbers.push(parsed.value);
    }
  }

  if (numbers.length === 0) return 0;
  const validNumbers = isDistinct ? Array.from(new Set(numbers)) : numbers;

  switch (func) {
    case 'SUM':
      return validNumbers.reduce((a, b) => a + b, 0);
    case 'AVG':
    case 'MEAN':
      return validNumbers.reduce((a, b) => a + b, 0) / validNumbers.length;
    case 'MIN':
      return Math.min(...validNumbers);
    case 'MAX':
      return Math.max(...validNumbers);
    case 'MEDIAN': {
      const sorted = [...validNumbers].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }
  }
}

export function executeSqlQuery(rawRows: Record<string, any>[], sqlQuery: string): SqlQueryResult {
  const startTime = Date.now();
  if (!rawRows || !Array.isArray(rawRows)) {
    return {
      success: false,
      columns: [],
      rows: [],
      totalCount: 0,
      executionTimeMs: 0,
      error: 'Dataset contains no rows or is invalid.',
    };
  }

  if (!sqlQuery || !sqlQuery.trim()) {
    return {
      success: false,
      columns: [],
      rows: [],
      totalCount: 0,
      executionTimeMs: 0,
      error: 'SQL Query cannot be empty.',
    };
  }

  try {
    let cleanedSql = sqlQuery
      .replace(/--.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .trim();

    if (/^\s*WITH\s+/i.test(cleanedSql)) {
      const finalSelectMatch = cleanedSql.match(/(\bSELECT\s+[\s\S]+)$/i);
      if (finalSelectMatch) {
        cleanedSql = finalSelectMatch[1].trim();
      }
    }

    if (cleanedSql.endsWith(';')) {
      cleanedSql = cleanedSql.slice(0, -1).trim();
    }

    const regex = /^\s*SELECT\s+(DISTINCT\s+)?([\s\S]+?)\s+FROM\s+([^\s;,]+)(?:\s+WHERE\s+([\s\S]+?))?(?:\s+GROUP\s+BY\s+([\s\S]+?))?(?:\s+HAVING\s+([\s\S]+?))?(?:\s+ORDER\s+BY\s+([\s\S]+?))?(?:\s+LIMIT\s+(\d+))?(?:\s+OFFSET\s+(\d+))?\s*$/i;
    const match = cleanedSql.match(regex);

    if (!match) {
      return {
        success: false,
        columns: [],
        rows: [],
        totalCount: 0,
        executionTimeMs: Date.now() - startTime,
        error: `SQL syntax not recognized. Ensure query follows: SELECT [cols] FROM dataset [WHERE ...] [GROUP BY ...] [ORDER BY ...] [LIMIT ...]`,
      };
    }

    const isDistinctSelect = Boolean(match[1]);
    const selectStr = match[2].trim();
    const whereStr = match[4] ? match[4].trim() : '';
    const groupByStr = match[5] ? match[5].trim() : '';
    const orderByStr = match[7] ? match[7].trim() : '';
    const limitNum = match[8] ? parseInt(match[8], 10) : undefined;
    const offsetNum = match[9] ? parseInt(match[9], 10) : 0;

    const selectFields = parseSelectFields(selectStr);
    const hasAggregates = selectFields.some(f => f.isAggregate);

    let filteredRows = rawRows;
    if (whereStr) {
      filteredRows = rawRows.filter(r => evaluateWhere(r, whereStr));
    }

    let resultRows: Record<string, any>[] = [];

    if (groupByStr || hasAggregates) {
      const groupColNames = groupByStr
        ? groupByStr.split(',').map(s => {
            const trimmed = s.trim();
            const ordinal = parseInt(trimmed, 10);
            if (!isNaN(ordinal) && ordinal >= 1 && ordinal <= selectFields.length) {
              return selectFields[ordinal - 1].alias;
            }
            return cleanIdentifier(trimmed);
          })
        : [];

      const groups = new Map<string, Record<string, any>[]>();
      for (const row of filteredRows) {
        const groupKey = groupColNames.map(col => String(row[col] ?? 'null')).join('|||');
        if (!groups.has(groupKey)) {
          groups.set(groupKey, []);
        }
        groups.get(groupKey)!.push(row);
      }

      for (const [, groupMembers] of groups.entries()) {
        const firstRow = groupMembers[0];
        const resultRow: Record<string, any> = {};

        for (const field of selectFields) {
          if (field.expression === '*') {
            continue;
          }
          if (field.isAggregate && field.aggFunc) {
            const val = computeAgg(groupMembers, field.aggFunc, field.aggArg || '', field.isDistinct);
            resultRow[field.alias] = Math.round(val * 100) / 100;
          } else {
            const cleanCol = cleanIdentifier(field.expression);
            resultRow[field.alias] = firstRow[cleanCol] ?? firstRow[field.alias] ?? null;
          }
        }

        resultRows.push(resultRow);
      }

      if (resultRows.length === 0 && hasAggregates && !groupByStr) {
        const defaultRow: Record<string, any> = {};
        for (const field of selectFields) {
          defaultRow[field.alias] = field.isAggregate ? 0 : null;
        }
        resultRows.push(defaultRow);
      }
    } else {
      for (const row of filteredRows) {
        const resultRow: Record<string, any> = {};
        if (selectFields.some(f => f.expression === '*')) {
          Object.assign(resultRow, row);
        } else {
          for (const field of selectFields) {
            const cleanCol = cleanIdentifier(field.expression);
            resultRow[field.alias] = row[cleanCol] ?? null;
          }
        }
        resultRows.push(resultRow);
      }
    }

    if (isDistinctSelect) {
      const seen = new Set<string>();
      const distinctRows: Record<string, any>[] = [];
      for (const r of resultRows) {
        const key = JSON.stringify(r);
        if (!seen.has(key)) {
          seen.add(key);
          distinctRows.push(r);
        }
      }
      resultRows = distinctRows;
    }

    if (orderByStr) {
      const orderClauses = orderByStr.split(',').map(s => {
        const m = s.trim().match(/^("?[^"\s]+"?|\d+)\s*(ASC|DESC)?$/i);
        if (m) {
          const colOrIdx = m[1];
          const dir = (m[2] || 'ASC').toUpperCase() as 'ASC' | 'DESC';
          const ordinal = parseInt(colOrIdx, 10);
          let targetCol = cleanIdentifier(colOrIdx);
          if (!isNaN(ordinal) && ordinal >= 1 && ordinal <= selectFields.length) {
            targetCol = selectFields[ordinal - 1].alias;
          }
          return { col: targetCol, dir };
        }
        return { col: cleanIdentifier(s.trim()), dir: 'ASC' as const };
      });

      resultRows.sort((a, b) => {
        for (const order of orderClauses) {
          const valA = a[order.col];
          const valB = b[order.col];

          const numA = parseCleanNumber(valA);
          const numB = parseCleanNumber(valB);

          let cmp = 0;
          if (numA.isNum && numB.isNum) {
            cmp = numA.value - numB.value;
          } else {
            cmp = String(valA ?? '').localeCompare(String(valB ?? ''));
          }

          if (cmp !== 0) {
            return order.dir === 'DESC' ? -cmp : cmp;
          }
        }
        return 0;
      });
    }

    const totalCount = resultRows.length;
    if (offsetNum > 0 || limitNum !== undefined) {
      const start = offsetNum || 0;
      const end = limitNum !== undefined ? start + limitNum : undefined;
      resultRows = resultRows.slice(start, end);
    }

    let columns: string[] = [];
    if (selectFields.some(f => f.expression === '*')) {
      columns = resultRows.length > 0 ? Object.keys(resultRows[0]) : rawRows.length > 0 ? Object.keys(rawRows[0]) : [];
    } else {
      columns = selectFields.map(f => f.alias);
    }

    return {
      success: true,
      columns,
      rows: resultRows,
      totalCount,
      executionTimeMs: Date.now() - startTime,
    };
  } catch (err: any) {
    return {
      success: false,
      columns: [],
      rows: [],
      totalCount: 0,
      executionTimeMs: Date.now() - startTime,
      error: `SQL Execution Error: ${err.message || String(err)}`,
    };
  }
}
