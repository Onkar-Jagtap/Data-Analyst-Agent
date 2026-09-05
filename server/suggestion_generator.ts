import { ColumnProfile, DatasetProfile } from './types.js';
import { generateWithGemini, getGeminiClient, getAiClient } from './gemini_client.js';

export type DatasetDomain =
  | 'sentiment'
  | 'voting_election'
  | 'hr_workforce'
  | 'marketing'
  | 'ecommerce_sales'
  | 'general';

export interface SemanticFieldMapping {
  domain: DatasetDomain;
  sentimentScoreCol?: ColumnProfile;
  sentimentLabelCol?: ColumnProfile;
  candidateCol?: ColumnProfile;
  partyCol?: ColumnProfile;
  stateCol?: ColumnProfile;
  voteCol?: ColumnProfile;
  deptCol?: ColumnProfile;
  salaryCol?: ColumnProfile;
  attritionCol?: ColumnProfile;
  tenureCol?: ColumnProfile;
  campaignCol?: ColumnProfile;
  spendCol?: ColumnProfile;
  clicksCol?: ColumnProfile;
  conversionsCol?: ColumnProfile;
  revenueCol?: ColumnProfile;
  profitCol?: ColumnProfile;
  quantityCol?: ColumnProfile;
  productCol?: ColumnProfile;
  customerCol?: ColumnProfile;
  dateCol?: ColumnProfile;
  numericCols: ColumnProfile[];
  categoricalCols: ColumnProfile[];
  dateCols: ColumnProfile[];
}

/**
 * Infer analytical domain and semantic field mappings from dataset profile schema.
 */
export function detectDatasetDomain(profile: DatasetProfile): SemanticFieldMapping {
  const columns = profile.columns || [];
  const numericCols = columns.filter(c => c.type === 'numeric');
  const categoricalCols = columns.filter(c => c.type === 'categorical' || c.type === 'text');
  const dateCols = columns.filter(c => c.type === 'datetime');

  // Also inspect column names that might represent dates even if typed categorical/text
  const effectiveDateCol =
    dateCols[0] ||
    columns.find(c => {
      const n = c.name.toLowerCase();
      return n === 'date' || n === 'timestamp' || n === 'day' || n === 'month' || n === 'year' || n.endsWith('_date');
    });

  // Sentiment detection
  const sentimentScoreCol = numericCols.find(c => {
    const n = c.name.toLowerCase();
    return n.includes('sentiment') || n.includes('polarity') || n.includes('satisfaction') || n === 'score';
  });

  const sentimentLabelCol = categoricalCols.find(c => {
    const n = c.name.toLowerCase();
    if (n.includes('sentiment') || n.includes('polarity')) return true;
    // Check top categories or sample values
    const categories = (c.topCategories?.map(t => String(t.category).toLowerCase()) || [])
      .concat((c.sampleValues || []).map(s => String(s).toLowerCase()));
    return (
      categories.some(v => v === 'positive' || v === 'pos') &&
      categories.some(v => v === 'negative' || v === 'neg')
    );
  });

  // Voting / Election detection
  const candidateCol = columns.find(c => {
    const n = c.name.toLowerCase();
    return n.includes('candidate') || n.includes('nominee') || n.includes('politician');
  });

  const partyCol = columns.find(c => {
    const n = c.name.toLowerCase();
    return n === 'party' || n.includes('political_party') || n === 'affiliation';
  });

  const stateCol = columns.find(c => {
    const n = c.name.toLowerCase();
    return (
      n === 'state' ||
      n === 'province' ||
      n === 'constituency' ||
      n === 'district' ||
      n === 'precinct' ||
      n === 'territory' ||
      n === 'region' ||
      n === 'geography'
    );
  });

  const voteCol = numericCols.find(c => {
    const n = c.name.toLowerCase();
    return n.includes('vote') || n.includes('ballot') || n.includes('turnout') || n === 'responses' || n === 'response_count';
  });

  // HR / Workforce detection
  const deptCol = categoricalCols.find(c => {
    const n = c.name.toLowerCase();
    return n.includes('department') || n.includes('division') || n === 'team' || n === 'dept';
  });

  const salaryCol = numericCols.find(c => {
    const n = c.name.toLowerCase();
    return n.includes('salary') || n.includes('wage') || n.includes('compensation') || n === 'pay';
  });

  const attritionCol = columns.find(c => {
    const n = c.name.toLowerCase();
    return n.includes('attrition') || n.includes('turnover') || n === 'churn' || n === 'left';
  });

  const tenureCol = numericCols.find(c => {
    const n = c.name.toLowerCase();
    return n.includes('tenure') || n.includes('years_at_company') || n.includes('experience') || n.includes('service_years');
  });

  // Marketing detection
  const campaignCol = categoricalCols.find(c => {
    const n = c.name.toLowerCase();
    return n.includes('campaign') || n.includes('ad_group') || n.includes('ad_name') || n.includes('channel');
  });

  const spendCol = numericCols.find(c => {
    const n = c.name.toLowerCase();
    return n.includes('spend') || n.includes('ad_spend') || n.includes('cost') || n.includes('budget');
  });

  const clicksCol = numericCols.find(c => {
    const n = c.name.toLowerCase();
    return n.includes('click') || n.includes('cpc') || n.includes('impression');
  });

  const conversionsCol = numericCols.find(c => {
    const n = c.name.toLowerCase();
    return n.includes('conversion') || n.includes('lead') || n.includes('acquisition') || n.includes('signup');
  });

  // E-commerce / Sales detection (STRICT: only if actual sales/revenue/profit columns exist)
  const revenueCol = numericCols.find(c => {
    const n = c.name.toLowerCase();
    return n.includes('revenue') || n.includes('sales') || n.includes('turnover') || n.includes('gross_sales');
  });

  const profitCol = numericCols.find(c => {
    const n = c.name.toLowerCase();
    return n.includes('profit') || n.includes('margin') || n.includes('earnings') || n.includes('net_income');
  });

  const quantityCol = numericCols.find(c => {
    const n = c.name.toLowerCase();
    return n.includes('quantity') || n === 'qty' || n.includes('units') || n.includes('volume');
  });

  const productCol = categoricalCols.find(c => {
    const n = c.name.toLowerCase();
    return n.includes('product') || n === 'item' || n === 'sku' || n.includes('item_name');
  });

  const customerCol = columns.find(c => {
    const n = c.name.toLowerCase();
    return n.includes('customer') || n.includes('client') || n.includes('buyer') || n.includes('account');
  });

  // Decide domain
  let domain: DatasetDomain = 'general';

  if (sentimentScoreCol || sentimentLabelCol) {
    domain = 'sentiment';
  } else if (candidateCol || partyCol || (stateCol && voteCol)) {
    domain = 'voting_election';
  } else if (salaryCol || deptCol || attritionCol || tenureCol) {
    domain = 'hr_workforce';
  } else if (campaignCol || (spendCol && conversionsCol)) {
    domain = 'marketing';
  } else if (revenueCol || profitCol || (productCol && quantityCol)) {
    domain = 'ecommerce_sales';
  }

  return {
    domain,
    sentimentScoreCol,
    sentimentLabelCol,
    candidateCol,
    partyCol,
    stateCol,
    voteCol,
    deptCol,
    salaryCol,
    attritionCol,
    tenureCol,
    campaignCol,
    spendCol,
    clicksCol,
    conversionsCol,
    revenueCol,
    profitCol,
    quantityCol,
    productCol,
    customerCol,
    dateCol: effectiveDateCol,
    numericCols,
    categoricalCols,
    dateCols,
  };
}

/**
 * Strict Column & Concept Validation Layer.
 * Ensures that EVERY referenced concept in a question exists in the dataset schema.
 */
export function validateSuggestedQuestion(
  question: string,
  profile: DatasetProfile
): { valid: boolean; reason?: string } {
  if (!question || typeof question !== 'string' || question.trim().length < 5) {
    return { valid: false, reason: 'Question too short or empty' };
  }

  const q = question.toLowerCase();
  const columns = profile.columns || [];
  const colNamesLower = columns.map(c => c.name.toLowerCase());
  const numericColsLower = columns.filter(c => c.type === 'numeric').map(c => c.name.toLowerCase());
  const dateColsLower = columns.filter(c => c.type === 'datetime').map(c => c.name.toLowerCase());

  // Check whether dataset has any date/time column (or explicit Year/Date/Month)
  const hasDateCol =
    dateColsLower.length > 0 ||
    colNamesLower.some(n => n === 'date' || n === 'timestamp' || n === 'year' || n === 'month' || n.endsWith('_date'));

  // 1. Revenue / Sales check
  if (/\b(revenue|sales|turnover|gross sales|topline)\b/i.test(q)) {
    const hasRev = numericColsLower.some(
      n => n.includes('revenue') || n.includes('sales') || n.includes('turnover') || n.includes('amount')
    );
    if (!hasRev) {
      return { valid: false, reason: 'Mentions revenue/sales but no revenue column exists in dataset' };
    }
  }

  // 2. Profit / Margin check
  if (/\b(profit|profitable|margin|earnings|net income)\b/i.test(q)) {
    const hasProfit = numericColsLower.some(
      n => n.includes('profit') || n.includes('margin') || n.includes('earnings') || n.includes('income')
    );
    if (!hasProfit) {
      return { valid: false, reason: 'Mentions profit/margin but no profit column exists in dataset' };
    }
  }

  // 3. Product / SKU / Item check
  if (/\b(product|products|item|items|sku|merchandise)\b/i.test(q)) {
    const hasProduct = colNamesLower.some(
      n => n.includes('product') || n.includes('item') || n.includes('sku') || n.includes('merchandise')
    );
    if (!hasProduct) {
      return { valid: false, reason: 'Mentions product but no product column exists in dataset' };
    }
  }

  // 4. Customer / Client check
  if (/\b(customer|customers|client|clients|buyer|buyers)\b/i.test(q)) {
    const hasCustomer = colNamesLower.some(
      n => n.includes('customer') || n.includes('client') || n.includes('buyer') || n.includes('account')
    );
    if (!hasCustomer) {
      return { valid: false, reason: 'Mentions customer but no customer column exists in dataset' };
    }
  }

  // 5. Salary / Wage check
  if (/\b(salary|salaries|wage|wages|compensation|pay)\b/i.test(q)) {
    const hasSalary = numericColsLower.some(
      n => n.includes('salary') || n.includes('wage') || n.includes('compensation') || n === 'pay'
    );
    if (!hasSalary) {
      return { valid: false, reason: 'Mentions salary but no salary column exists in dataset' };
    }
  }

  // 6. Department check
  if (/\b(department|departments|dept|division)\b/i.test(q)) {
    const hasDept = colNamesLower.some(
      n => n.includes('department') || n.includes('division') || n === 'dept' || n === 'team'
    );
    if (!hasDept) {
      return { valid: false, reason: 'Mentions department but no department column exists in dataset' };
    }
  }

  // 7. Attrition / Churn check
  if (/\b(attrition|churn|employee turnover)\b/i.test(q)) {
    const hasAttrition = colNamesLower.some(
      n => n.includes('attrition') || n.includes('turnover') || n.includes('churn')
    );
    if (!hasAttrition) {
      return { valid: false, reason: 'Mentions attrition but no attrition column exists in dataset' };
    }
  }

  // 8. Tenure check
  if (/\b(tenure|years of service|years at company)\b/i.test(q)) {
    const hasTenure = numericColsLower.some(
      n => n.includes('tenure') || n.includes('experience') || n.includes('years')
    );
    if (!hasTenure) {
      return { valid: false, reason: 'Mentions tenure but no tenure column exists in dataset' };
    }
  }

  // 9. Campaign / Ad check
  if (/\b(campaign|campaigns|ad group|ad name)\b/i.test(q)) {
    const hasCampaign = colNamesLower.some(n => n.includes('campaign') || n.includes('ad'));
    if (!hasCampaign) {
      return { valid: false, reason: 'Mentions campaign but no campaign column exists in dataset' };
    }
  }

  // 10. Candidate check
  if (/\b(candidate|candidates|nominee|politician)\b/i.test(q)) {
    const hasCandidate = colNamesLower.some(
      n => n.includes('candidate') || n.includes('nominee') || n.includes('politician')
    );
    if (!hasCandidate) {
      return { valid: false, reason: 'Mentions candidate but no candidate column exists in dataset' };
    }
  }

  // 11. Sentiment check
  if (/\b(sentiment|polarity|sentiment score|positive sentiment|negative sentiment)\b/i.test(q)) {
    const hasSentiment = colNamesLower.some(
      n => n.includes('sentiment') || n.includes('polarity') || n.includes('satisfaction')
    );
    if (!hasSentiment) {
      return { valid: false, reason: 'Mentions sentiment but no sentiment column exists in dataset' };
    }
  }

  // 12. State / Region check
  if (/\b(state|states)\b/i.test(q)) {
    const hasState = colNamesLower.some(n => n === 'state' || n.includes('state') || n === 'province');
    if (!hasState) {
      return { valid: false, reason: 'Mentions state but no state column exists in dataset' };
    }
  }
  if (/\b(region|regions|territory|territories)\b/i.test(q)) {
    const hasRegion = colNamesLower.some(n => n.includes('region') || n.includes('territory') || n.includes('zone'));
    if (!hasRegion) {
      return { valid: false, reason: 'Mentions region but no region column exists in dataset' };
    }
  }

  // 13. Temporal question check (over time, monthly, trend over time)
  if (/\b(over time|monthly|daily|weekly|yearly|annual|quarterly|by month|by year|by date|trend over time)\b/i.test(q)) {
    if (!hasDateCol) {
      return { valid: false, reason: 'Time-series questions require a date or timestamp column in dataset' };
    }
  }

  // 14. Correlation question check
  if (/\b(correlation|relationship between|correlate|associated with)\b/i.test(q)) {
    if (numericColsLower.length < 2) {
      return { valid: false, reason: 'Correlation analysis requires at least two numeric columns' };
    }
  }

  // 15. Grounded column reference verification:
  // Ensure the question refers to at least one actual column from the dataset or is a valid record count query
  const matchesAtLeastOneColumn = columns.some(c => {
    const colName = c.name.toLowerCase();
    // Direct match or word boundary match
    if (q.includes(colName)) return true;
    // Replace underscores with spaces (e.g. sentiment_score -> sentiment score)
    const spaceName = colName.replace(/_/g, ' ');
    if (q.includes(spaceName)) return true;
    return false;
  });

  const isGeneralCountQuery = /\b(records|rows|entries|data points|total count)\b/i.test(q);

  if (!matchesAtLeastOneColumn && !isGeneralCountQuery) {
    return { valid: false, reason: 'Question does not reference any column from the dataset schema' };
  }

  return { valid: true };
}

/**
 * Deterministic, 100% schema-grounded question generator.
 * Produces diverse, realistic questions matching the dataset's actual schema and analytical domain.
 */
export function generateSchemaGroundedSuggestions(
  profile: DatasetProfile,
  options?: {
    lastResult?: any;
    lastQuestion?: string;
    count?: number;
  }
): string[] {
  const count = options?.count || 5;
  const mapping = detectDatasetDomain(profile);
  const questions: string[] = [];

  const addQuestion = (q: string) => {
    const trimmed = q.trim();
    if (!questions.includes(trimmed)) {
      const val = validateSuggestedQuestion(trimmed, profile);
      if (val.valid) {
        questions.push(trimmed);
      }
    }
  };

  // ----------------------------------------------------
  // CONTEXTUAL FOLLOW-UP SUGGESTIONS
  // ----------------------------------------------------
  if (options?.lastResult || options?.lastQuestion) {
    const lastPlan = options.lastResult?.plan;
    const lastMetric = lastPlan?.metric || options.lastResult?.keyMetrics?.[0]?.label;
    const lastGroup = lastPlan?.group_by?.[0];

    // Follow-up: alternative categorical grouping
    if (lastMetric && lastGroup) {
      const altGroup = mapping.categoricalCols.find(c => c.name !== lastGroup);
      if (altGroup) {
        addQuestion(`How does ${lastMetric} vary by ${altGroup.name} instead?`);
      }
    }

    // Follow-up: chronological progression if date exists
    if (lastMetric && mapping.dateCol) {
      addQuestion(`How has ${lastMetric} changed over time?`);
    }

    // Follow-up: opposite ranking
    if (lastMetric && lastGroup) {
      addQuestion(`Which ${lastGroup} has the lowest average ${lastMetric}?`);
    }

    // Follow-up: overall summary
    if (lastMetric) {
      addQuestion(`What is the overall average ${lastMetric}?`);
    }

    // If sentiment domain follow-up
    if (mapping.domain === 'sentiment' && mapping.sentimentLabelCol) {
      addQuestion(`What is the overall sentiment distribution?`);
    }
  }

  // ----------------------------------------------------
  // DOMAIN-SPECIFIC SUGGESTIONS
  // ----------------------------------------------------
  if (mapping.domain === 'sentiment') {
    const scoreCol = mapping.sentimentScoreCol?.name || mapping.numericCols[0]?.name;
    const labelCol = mapping.sentimentLabelCol?.name;
    const entityCol = mapping.stateCol?.name || mapping.candidateCol?.name || mapping.categoricalCols[0]?.name;
    const secondEntity = mapping.candidateCol?.name !== entityCol ? mapping.candidateCol?.name : mapping.categoricalCols.find(c => c.name !== entityCol)?.name;

    if (scoreCol && entityCol) {
      addQuestion(`Which ${entityCol} has the highest average ${scoreCol}?`);
    }
    if (scoreCol && secondEntity) {
      addQuestion(`How does ${scoreCol} vary by ${secondEntity}?`);
    }
    if (labelCol) {
      addQuestion(`What is the overall sentiment distribution?`);
      if (entityCol) {
        addQuestion(`Which ${entityCol} has the most positive sentiment?`);
      }
    }
    if (mapping.dateCol && scoreCol) {
      addQuestion(`How has sentiment changed over time?`);
    }
    if (mapping.numericCols.length >= 2) {
      const otherNum = mapping.numericCols.find(c => c.name !== scoreCol);
      if (otherNum && scoreCol) {
        addQuestion(`Is there a relationship between ${otherNum.name} and ${scoreCol}?`);
      }
    }
  } else if (mapping.domain === 'voting_election') {
    const voteCol = mapping.voteCol?.name || mapping.numericCols[0]?.name;
    const candCol = mapping.candidateCol?.name;
    const stateCol = mapping.stateCol?.name;
    const partyCol = mapping.partyCol?.name;

    if (voteCol && stateCol) {
      addQuestion(`Which ${stateCol} has the highest ${voteCol}?`);
    }
    if (voteCol && candCol) {
      addQuestion(`How do ${voteCol} compare across ${candCol}?`);
      addQuestion(`Which ${candCol} leads in total ${voteCol}?`);
    }
    if (partyCol && voteCol) {
      addQuestion(`What is the total ${voteCol} by ${partyCol}?`);
    }
    if (mapping.dateCol && voteCol) {
      addQuestion(`Show ${voteCol} trend over time.`);
    }
  } else if (mapping.domain === 'hr_workforce') {
    const deptCol = mapping.deptCol?.name || mapping.categoricalCols[0]?.name;
    const salaryCol = mapping.salaryCol?.name;
    const attritionCol = mapping.attritionCol?.name;
    const tenureCol = mapping.tenureCol?.name;

    if (salaryCol && deptCol) {
      addQuestion(`What is the average ${salaryCol} by ${deptCol}?`);
    }
    if (attritionCol && deptCol) {
      addQuestion(`Which ${deptCol} has the highest ${attritionCol}?`);
    }
    if (tenureCol && salaryCol) {
      addQuestion(`How does ${tenureCol} correlate with ${salaryCol}?`);
    }
    if (deptCol) {
      addQuestion(`What is the distribution of records by ${deptCol}?`);
    }
    if (salaryCol) {
      addQuestion(`What is the overall average ${salaryCol}?`);
    }
  } else if (mapping.domain === 'marketing') {
    const campCol = mapping.campaignCol?.name || mapping.categoricalCols[0]?.name;
    const convCol = mapping.conversionsCol?.name;
    const spendCol = mapping.spendCol?.name;
    const clicksCol = mapping.clicksCol?.name;

    if (convCol && campCol) {
      addQuestion(`Which ${campCol} has the highest ${convCol}?`);
    }
    if (spendCol && convCol) {
      addQuestion(`How does ${spendCol} relate to ${convCol}?`);
    }
    if (spendCol && clicksCol) {
      addQuestion(`Analyze correlation between ${spendCol} and ${clicksCol}.`);
    }
    if (campCol && spendCol) {
      addQuestion(`What is the total ${spendCol} by ${campCol}?`);
    }
  } else if (mapping.domain === 'ecommerce_sales') {
    const revCol = mapping.revenueCol?.name;
    const profCol = mapping.profitCol?.name;
    const prodCol = mapping.productCol?.name || mapping.categoricalCols[0]?.name;
    const regionCol = mapping.stateCol?.name || mapping.categoricalCols.find(c => c.name !== prodCol)?.name;

    if (revCol && prodCol) {
      addQuestion(`Which ${prodCol} generates the highest ${revCol}?`);
    }
    if (profCol && prodCol) {
      addQuestion(`Which ${prodCol} has the highest ${profCol}?`);
    }
    if (revCol && mapping.dateCol) {
      addQuestion(`Show ${revCol} trend over time.`);
    }
    if (mapping.quantityCol && revCol) {
      addQuestion(`Analyze correlation between ${mapping.quantityCol.name} and ${revCol}.`);
    }
    if (regionCol && revCol) {
      addQuestion(`Which ${regionCol} generates the highest ${revCol}?`);
    }
  }

  // ----------------------------------------------------
  // GENERAL FALLBACK / DIVERSE SCHEMA PATTERNS
  // ----------------------------------------------------
  const numCol1 = mapping.numericCols[0];
  const numCol2 = mapping.numericCols[1];
  const catCol1 = mapping.categoricalCols[0];
  const catCol2 = mapping.categoricalCols[1];
  const dateCol = mapping.dateCol;

  // 1. Comparison / Ranking
  if (numCol1 && catCol1) {
    addQuestion(`Which ${catCol1.name} has the highest ${numCol1.name}?`);
    addQuestion(`What is the average ${numCol1.name} by ${catCol1.name}?`);
  }

  // 2. Trend over time (only if date column exists)
  if (dateCol && numCol1) {
    addQuestion(`How has ${numCol1.name} changed over time?`);
  }

  // 3. Correlation (only if 2+ numeric columns exist)
  if (numCol1 && numCol2) {
    addQuestion(`Analyze correlation between ${numCol1.name} and ${numCol2.name}.`);
  }

  // 4. Distribution / Frequency
  if (catCol1) {
    addQuestion(`What is the distribution of records across ${catCol1.name}?`);
  }
  if (catCol2 && numCol1) {
    addQuestion(`How does ${numCol1.name} vary across ${catCol2.name}?`);
  }

  // 5. Summary metric
  if (numCol1) {
    addQuestion(`What is the overall average ${numCol1.name}?`);
  }

  // 6. Minimal fallback if dataset is purely categorical
  if (mapping.numericCols.length === 0 && catCol1) {
    addQuestion(`What are the most common values in ${catCol1.name}?`);
    addQuestion(`How many records are there for each ${catCol1.name}?`);
    if (catCol2) {
      addQuestion(`Compare ${catCol1.name} frequency across ${catCol2.name}.`);
    }
  }

  return questions.slice(0, count);
}

/**
 * AI-assisted suggestion generator with Gemini and guaranteed schema validation.
 * Falls back deterministically if Gemini is unavailable or returns ungrounded questions.
 */
export async function generateSuggestionsForDataset(
  profile: DatasetProfile,
  options?: {
    useAi?: boolean;
    lastResult?: any;
    lastQuestion?: string;
    count?: number;
  }
): Promise<string[]> {
  const desiredCount = options?.count || 5;

  // 1. If AI is disabled or no Gemini key configured, return schema-grounded deterministic suggestions immediately
  const ai = getAiClient();
  if (!options?.useAi || !ai) {
    return generateSchemaGroundedSuggestions(profile, options);
  }

  try {
    const colSummary = profile.columns
      .map(c => {
        const samples = (c.sampleValues || []).slice(0, 3).map(s => String(s)).join(', ');
        return `- ${c.name} (${c.type})${samples ? `: [${samples}]` : ''}`;
      })
      .join('\n');

    const prompt = `You are an expert data analyst.
Generate ${desiredCount} distinct, analytical questions for a dataset with the following schema:

Dataset Filename: ${profile.filename}
Total Records: ${profile.rowCount}
Available Columns:
${colSummary}

${options?.lastQuestion ? `User's last analyzed query: "${options.lastQuestion}"` : ''}

STRICT NON-NEGOTIABLE RULES:
1. Every question MUST be strictly answerable using ONLY the available columns listed above.
2. NEVER mention or invent any column or concept not present in the schema.
   - For example: if there is no Revenue/Sales, NEVER mention revenue or sales!
   - If there is no Profit/Margin, NEVER mention profit or margin!
   - If there is no Product, NEVER mention products!
   - If this is a voting/sentiment dataset, ask voting/sentiment questions.
   - If this is an HR dataset, ask HR questions.
3. Provide diverse analytical angles: ranking (highest/lowest), aggregation (average/total), trend (ONLY if date column exists), correlation (ONLY if 2+ numeric columns exist), and distribution.
4. Return ONLY a valid JSON array of strings, with no markdown code fences or conversational text. Example format: ["Question 1?", "Question 2?"]`;

    const response = await generateWithGemini({
      preferredModel: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        temperature: 0.2,
      },
    }, ai);

    const text = response.text?.trim() || '';
    let parsed: string[] = [];

    try {
      const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // If JSON parsing fails, extract lines that look like questions
      parsed = text
        .split('\n')
        .map(l => l.replace(/^\d+[\.\)]\s*/, '').replace(/^[-*]\s*/, '').replace(/^["']|["'],?$/g, '').trim())
        .filter(l => l.endsWith('?'));
    }

    if (Array.isArray(parsed) && parsed.length > 0) {
      // 2. RUN EVERY QUESTION THROUGH STRICT VALIDATION
      const validatedAiQuestions: string[] = [];
      for (const q of parsed) {
        if (typeof q === 'string') {
          const val = validateSuggestedQuestion(q, profile);
          if (val.valid && !validatedAiQuestions.includes(q.trim())) {
            validatedAiQuestions.push(q.trim());
          }
        }
      }

      // If we got sufficient valid AI questions, fill any remainder with deterministic suggestions
      if (validatedAiQuestions.length >= 3) {
        const fallbacks = generateSchemaGroundedSuggestions(profile, options);
        for (const fb of fallbacks) {
          if (validatedAiQuestions.length >= desiredCount) break;
          if (!validatedAiQuestions.includes(fb)) {
            validatedAiQuestions.push(fb);
          }
        }
        return validatedAiQuestions.slice(0, desiredCount);
      }
    }
  } catch (err: any) {
    // API experiencing temporary high demand (503), quota limits (429), or network pause - cleanly switch to verified deterministic engine
    console.log('[Suggestions] High demand/rate limit detected on AI service; seamlessly utilizing deterministic schema-grounded suggestions.');
  }

  // Fallback to deterministic engine
  return generateSchemaGroundedSuggestions(profile, options);
}
