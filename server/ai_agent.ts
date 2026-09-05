import { GoogleGenAI } from '@google/genai';
import { AnalysisPlan, ColumnProfile, DataHandlingReport, DatasetProfile } from './types.js';
import {
  resolveColumn,
  resolveMetricFromQuery,
  resolveAggregation,
  validateAndRepairPlan,
  applyFollowUpContext,
} from './query_resolver.js';

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// ----------------------------------------------------
// DETERMINISTIC INTENT PARSER (Always available fallback)
// ----------------------------------------------------
export function parseIntentDeterministic(
  question: string,
  profile: DatasetProfile,
  previousPlan?: AnalysisPlan
): AnalysisPlan {
  const q = question.toLowerCase().trim();
  const numCols = profile.columns.filter(c => c.type === 'numeric');
  const catCols = profile.columns.filter(c => c.type === 'categorical' || c.type === 'text');
  const dateCols = profile.columns.filter(c => c.type === 'datetime');

  // Check multi-turn follow-up refinements first if previousPlan exists
  if (previousPlan) {
    const isFollowUpPattern =
      q.startsWith('now ') ||
      q.startsWith('only ') ||
      q.startsWith('what about') ||
      q.includes('instead') ||
      q.includes('filter') ||
      q.includes('top ') ||
      q.includes('limit to') ||
      q.includes('first ') ||
      q.includes('this') ||
      q.includes('that');

    if (isFollowUpPattern) {
      const dummyPlan: AnalysisPlan = {
        operation: previousPlan.operation,
        metric: previousPlan.metric,
        group_by: previousPlan.group_by,
        aggregation: previousPlan.aggregation,
      };
      const contextual = applyFollowUpContext(question, dummyPlan, previousPlan, profile);
      if (contextual !== dummyPlan) {
        return contextual;
      }
    }
  }

  // 1. Safe Metric Resolution
  const metricRes = resolveMetricFromQuery(question, profile.columns, previousPlan);

  if (metricRes.status === 'ambiguous') {
    return {
      operation: 'clarification',
      metric: undefined,
      user_intent_summary:
        metricRes.clarificationMessage ||
        `Which metric would you like me to analyze: ${numCols.map(c => c.name).join(', ')}?`,
    };
  }

  if (metricRes.status === 'unknown') {
    return {
      operation: 'clarification',
      metric: undefined,
      user_intent_summary:
        metricRes.clarificationMessage ||
        `The requested metric was not found in dataset '${profile.filename}'. Available metrics: ${numCols.map(c => c.name).join(', ')}.`,
    };
  }

  if (metricRes.status === 'none') {
    return {
      operation: 'clarification',
      metric: undefined,
      user_intent_summary: 'Your dataset does not contain any numeric metric columns to analyze.',
    };
  }

  const matchedMetric = metricRes.metric;

  // 2. Dimension / Group by Resolution using resolver hierarchy
  let matchedGroup: string | undefined;

  // Check direct column matches
  for (const c of [...catCols, ...dateCols]) {
    const res = resolveColumn(c.name, profile.columns);
    const colRegex = new RegExp(`\\b${c.name.toLowerCase()}\\b`, 'i');
    if (colRegex.test(q)) {
      matchedGroup = c.name;
      break;
    }
  }

  // Check dimension synonyms
  if (!matchedGroup) {
    if (q.includes('region') || q.includes('country') || q.includes('territory') || q.includes('area') || q.includes('geography')) {
      const match = catCols.find(c => {
        const n = c.name.toLowerCase();
        return n.includes('region') || n.includes('country') || n.includes('territory') || n.includes('area');
      });
      if (match) matchedGroup = match.name;
    } else if (q.includes('product') || q.includes('item') || q.includes('sku')) {
      const match = catCols.find(c => {
        const n = c.name.toLowerCase();
        return n.includes('product') || n.includes('item') || n.includes('sku');
      });
      if (match) matchedGroup = match.name;
    } else if (q.includes('category') || q.includes('department')) {
      const match = catCols.find(c => c.name.toLowerCase().includes('category'));
      if (match) matchedGroup = match.name;
    } else if (q.includes('segment') || q.includes('customer') || q.includes('tier') || q.includes('client')) {
      const match = catCols.find(c => {
        const n = c.name.toLowerCase();
        return n.includes('segment') || n.includes('customer') || n.includes('client') || n.includes('tier');
      });
      if (match) matchedGroup = match.name;
    }
  }

  // 3. Semantic Aggregation & Direction
  const aggResult = resolveAggregation(question, matchedMetric);
  const agg = aggResult.aggregation;
  const direction = aggResult.sortDirection;

  // 4. Time series intent
  if (
    (q.includes('trend') ||
      q.includes('over time') ||
      q.includes('monthly') ||
      q.includes('yearly') ||
      q.includes('daily') ||
      q.includes('growth')) &&
    dateCols.length > 0
  ) {
    let gran: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' = 'monthly';
    if (q.includes('day') || q.includes('daily')) gran = 'daily';
    if (q.includes('week')) gran = 'weekly';
    if (q.includes('quarter')) gran = 'quarterly';
    if (q.includes('year') || q.includes('annual')) gran = 'yearly';

    return {
      operation: 'time_series',
      metric: matchedMetric,
      group_by: [dateCols[0].name],
      aggregation: agg === 'mean' ? 'mean' : 'sum',
      time_granularity: gran,
      visualization: {
        type: 'line',
        x: dateCols[0].name,
        y: matchedMetric,
        title: `${matchedMetric || 'Metric'} Trend Over Time`,
      },
      user_intent_summary: `Calculate temporal trend of ${matchedMetric} rolled up by ${dateCols[0].name} (${gran}).`,
    };
  }

  // 5. Correlation intent
  if (
    q.includes('correlat') ||
    q.includes('relationship') ||
    q.includes('versus') ||
    q.includes(' vs ') ||
    q.includes('scatter')
  ) {
    if (numCols.length < 2) {
      return {
        operation: 'clarification',
        metric: matchedMetric,
        user_intent_summary: 'Correlation analysis requires at least two numeric variables in the dataset.',
      };
    }
    // Find secondary metric mentioned in question or fallback to other numeric column
    let secMetric: string | undefined;
    for (const c of numCols) {
      if (c.name !== matchedMetric) {
        const colRegex = new RegExp(`\\b${c.name.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&').toLowerCase()}\\b`, 'i');
        if (colRegex.test(q)) {
          secMetric = c.name;
          break;
        }
      }
    }
    if (!secMetric) {
      secMetric = numCols.find(c => c.name !== matchedMetric)?.name || numCols[1]?.name;
    }
    return {
      operation: 'correlation',
      metric: matchedMetric,
      secondary_metric: secMetric,
      visualization: {
        type: 'scatter',
        x: matchedMetric,
        y: secMetric,
        title: `${matchedMetric} vs ${secMetric}`,
      },
      user_intent_summary: `Analyze correlation between ${matchedMetric} and ${secMetric}.`,
    };
  }

  // 6. Distribution / Histogram intent
  if (
    q.includes('distribution') ||
    q.includes('histogram') ||
    q.includes('spread') ||
    q.includes('variance') ||
    q.includes('box plot')
  ) {
    return {
      operation: 'aggregate',
      metric: matchedMetric,
      aggregation: 'mean',
      visualization: {
        type: 'histogram',
        x: matchedMetric,
        title: `Distribution of ${matchedMetric}`,
      },
      user_intent_summary: `Examine distribution and spread of ${matchedMetric}.`,
    };
  }

  // 7. Group Aggregation / Breakdown
  if (
    matchedGroup ||
    q.includes('by ') ||
    q.includes('which ') ||
    q.includes('who ') ||
    q.includes('top ') ||
    q.includes('highest') ||
    q.includes('lowest') ||
    q.includes('most') ||
    q.includes('least')
  ) {
    const groupCol = matchedGroup || catCols[0]?.name || profile.columns[0]?.name;
    const isRanking = q.includes('top ') || q.includes('bottom ') || q.includes('rank') || q.includes('leader');
    const topMatch = q.match(/\b(?:top|bottom|first|limit)\s+(\d+)\b/i);
    const limit = topMatch ? parseInt(topMatch[1], 10) : (q.includes('top 5') || q.includes('first 5') ? 5 : 10);

    return {
      operation: isRanking ? 'ranking' : 'group_aggregate',
      group_by: [groupCol],
      metric: matchedMetric,
      aggregation: agg,
      sort: {
        column: matchedMetric || groupCol,
        direction,
      },
      limit,
      visualization: {
        type: 'bar',
        x: groupCol,
        y: matchedMetric,
        title: isRanking
          ? `Top ${limit} ${groupCol} by ${matchedMetric || 'Value'}`
          : `${agg.toUpperCase()} of ${matchedMetric || 'Records'} by ${groupCol}`,
      },
      user_intent_summary: isRanking
        ? `Rank top ${limit} ${groupCol} by ${matchedMetric} (${agg}).`
        : `Aggregate ${matchedMetric} grouped by ${groupCol} (${agg}) sorted ${direction}ending.`,
    };
  }

  // 8. Single Metric Aggregate (e.g. "What is average order value?", "Show total revenue", "Show quantity")
  return {
    operation: 'aggregate',
    metric: matchedMetric,
    aggregation: agg,
    visualization: {
      type: 'histogram',
      x: matchedMetric,
      title: `${agg.toUpperCase()} of ${matchedMetric || 'Values'}`,
    },
    user_intent_summary: `Calculate overall ${agg.toUpperCase()} of ${matchedMetric}.`,
  };
}

// ----------------------------------------------------
// GEMINI STRUCTURED PLANNER
// ----------------------------------------------------
export async function planAnalysisWithGemini(
  question: string,
  profile: DatasetProfile,
  conversationHistory?: { question: string; answerSummary?: string; plan?: AnalysisPlan }[]
): Promise<AnalysisPlan> {
  const previousPlan = conversationHistory && conversationHistory.length > 0 ? conversationHistory[conversationHistory.length - 1].plan : undefined;
  const ai = getAiClient();
  if (!ai) {
    return parseIntentDeterministic(question, profile, previousPlan);
  }

  const columnsOverview = profile.columns.map(c => ({
    name: c.name,
    type: c.type,
    sampleValues: c.sampleValues.slice(0, 3),
    nullCount: c.nullCount,
    isIdentifier: c.isIdentifier,
  }));

  const systemInstruction = `You are the planning engine of a Data Analyst Agent.
Your job is to translate a user's natural language analytical question into a strict JSON analysis plan.
CRITICAL RULES:
1. YOU ARE NOT THE CALCULATOR. You do NOT compute or estimate answers.
2. Select an allowed operation: "group_aggregate", "aggregate", "time_series", "correlation", "distribution".
3. Map user language to exact dataset columns. If user says "sales", pick "Revenue" if that column exists.
4. Support multi-turn context: If the user is following up on a previous query (e.g., "now only for North America", "what about by Product instead", "only the top 5"), carry over the metric and operation while refining the filters or group_by dimension.
5. If the user question is ambiguous or lacks a specific numeric metric (e.g. "What is the total?", "Show performance", "Show value") when multiple numeric columns exist, do NOT choose an arbitrary column.
6. Only return valid JSON matching this schema:
{
  "operation": "group_aggregate" | "aggregate" | "time_series" | "correlation" | "distribution",
  "metric": string (must match an existing numeric column name),
  "group_by": [string] (must match existing column names),
  "filters": [{ "column": string, "operator": "==" | "!=" | ">" | "<" | ">=" | "<=", "value": any }],
  "aggregation": "sum" | "mean" | "median" | "count" | "min" | "max" | "std",
  "sort": { "column": string, "direction": "asc" | "desc" },
  "limit": number,
  "time_granularity": "daily" | "weekly" | "monthly" | "quarterly" | "yearly",
  "secondary_metric": string (for correlation),
  "visualization": {
    "type": "bar" | "line" | "scatter" | "histogram" | "pie",
    "x": string,
    "y": string,
    "title": string
  },
  "user_intent_summary": string
}`;

  let contextStr = '';
  if (conversationHistory && conversationHistory.length > 0) {
    contextStr = `Recent Conversation Context:\n${conversationHistory.slice(-3).map((h, i) => `${i + 1}. User: "${h.question}" -> Analyzed: ${h.plan?.operation} of ${h.plan?.metric} (Summary: ${h.answerSummary || 'Calculated'})`).join('\n')}\n\n`;
  }

  const prompt = `${contextStr}Dataset Schema:
${JSON.stringify(columnsOverview, null, 2)}

User Question: "${question}"

Generate the JSON execution plan. Return ONLY raw JSON without markdown code fences.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    });

    const text = response.text ? response.text.trim() : '';
    const parsed = JSON.parse(text);

    // Validate and repair plan against schema
    const validation = validateAndRepairPlan(parsed, profile, question);
    if (!validation.valid) {
      return validation.repairedPlan;
    }

    let finalPlan = validation.repairedPlan;
    if (previousPlan) {
      finalPlan = applyFollowUpContext(question, finalPlan, previousPlan, profile);
    }

    return finalPlan;
  } catch (err) {
    console.warn('Gemini planning failed or timed out; using deterministic planner fallback:', err);
    return parseIntentDeterministic(question, profile, previousPlan);
  }
}

// ----------------------------------------------------
// GEMINI EXPLANATION ENGINE
// ----------------------------------------------------
export async function explainResultWithGemini(
  question: string,
  methodDescription: string,
  computedData: any,
  summaryMetrics: { label: string; value: string; context?: string }[],
  dataHandling: DataHandlingReport
): Promise<{
  answer: string;
  businessInterpretation: string[];
}> {
  const ai = getAiClient();

  // Fallback deterministic explanation
  const deterministicFallback = () => {
    let answer = 'Analysis complete.';
    const interpretation: string[] = [];

    if (computedData?.items && computedData.items.length > 0) {
      const top = computedData.items[0];
      answer = `${top.category} ranks highest with ${summaryMetrics[0]?.context || top.value.toLocaleString()}.`;
      if (computedData.items.length >= 2) {
        const second = computedData.items[1];
        const diff = top.value - second.value;
        const pctMore = second.value !== 0 ? Math.round((diff / second.value) * 1000) / 10 : 0;
        interpretation.push(`Outperformed runner-up '${second.category}' by ${pctMore > 0 ? '+' : ''}${pctMore}%.`);
      }
      interpretation.push(`Calculated across ${dataHandling.validRowsAnalyzed.toLocaleString()} valid records.`);
    } else if (computedData?.resultValue !== undefined) {
      answer = `The calculated ${computedData.aggregation} is ${summaryMetrics[0]?.value || computedData.resultValue}.`;
      interpretation.push(`Derived from ${dataHandling.validRowsAnalyzed.toLocaleString()} valid records with bounds [${computedData.min} - ${computedData.max}].`);
    } else if (computedData?.pearsonR !== undefined) {
      answer = `A ${computedData.strength} ${computedData.direction} correlation (r = ${computedData.pearsonR}) was found.`;
      interpretation.push(`Indicates that changes in ${computedData.column1} are ${computedData.direction === 'positive' ? 'positively accompanied by' : 'inversely associated with'} ${computedData.column2}.`);
      interpretation.push(`Correlation measures linear association and does not imply causation.`);
    } else if (computedData?.periods && computedData.periods.length > 0) {
      answer = `Recorded a ${computedData.growthRate > 0 ? '+' : ''}${computedData.growthRate}% shift across ${computedData.periods.length} time periods.`;
      interpretation.push(`Tracked progression from ${computedData.periods[0].period} to ${computedData.periods[computedData.periods.length - 1].period}.`);
    }

    return { answer, businessInterpretation: interpretation };
  };

  if (!ai) {
    return deterministicFallback();
  }

  const prompt = `User Question: "${question}"
Calculation Method: ${methodDescription}
Computed Deterministic Metrics:
${JSON.stringify(summaryMetrics, null, 2)}
Computed Output Data Summary:
${JSON.stringify(computedData, null, 2).slice(0, 1500)}
Data Handling Info:
- Total rows: ${dataHandling.totalRows}
- Valid rows analyzed: ${dataHandling.validRowsAnalyzed}
- Excluded rows: ${dataHandling.excludedRows} (Missing: ${dataHandling.missingValuesExcluded}, Invalid: ${dataHandling.invalidValuesExcluded})

Provide:
1. "answer": A crisp, executive 1-sentence finding stating the exact number and insight.
2. "businessInterpretation": 2-3 concise bullet points with business takeaway.
Do NOT modify or invent numbers. Use only the computed data provided.
Return raw JSON:
{
  "answer": "string",
  "businessInterpretation": ["string", "string"]
}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: prompt,
      config: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    });

    const text = response.text ? response.text.trim() : '';
    const parsed = JSON.parse(text);
    return {
      answer: parsed.answer || deterministicFallback().answer,
      businessInterpretation: Array.isArray(parsed.businessInterpretation) ? parsed.businessInterpretation : deterministicFallback().businessInterpretation,
    };
  } catch (err) {
    console.warn('Gemini explanation failed or timed out; using deterministic explainer fallback:', err);
    return deterministicFallback();
  }
}
