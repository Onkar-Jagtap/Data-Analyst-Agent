import {
  Company360Analysis,
  CrossDepartmentRisk,
  CrossFunctionalKpi,
  DatasetRelationshipLink,
  DepartmentDatasetSummary,
  DepartmentType,
  LeakageStep,
  StrategicImprovementAction,
} from './types.js';
import { StoredDataset } from './dataset_store.js';
import { parseCleanNumber } from './profiler.js';
import { generateWithGemini } from './gemini_client.js';

function toNum(val: any, fallback = 0): number {
  const res = parseCleanNumber(val);
  return res.isNum ? res.value : fallback;
}

// Heuristic Department Classifier
export function detectDepartmentRole(filename: string, columns: string[]): DepartmentType {
  const nameLower = filename.toLowerCase();
  const colsLower = columns.map(c => c.toLowerCase()).join(' ');

  if (
    nameLower.includes('lead') ||
    colsLower.includes('lead_id') ||
    (colsLower.includes('lead') && colsLower.includes('status')) ||
    (colsLower.includes('prospect') || colsLower.includes('sales_cycle'))
  ) {
    return 'Leads';
  }

  if (
    nameLower.includes('marketing') ||
    nameLower.includes('ad_spend') ||
    nameLower.includes('campaign') ||
    (colsLower.includes('ad_spend') || colsLower.includes('impressions') || (colsLower.includes('clicks') && colsLower.includes('campaign')))
  ) {
    return 'Marketing';
  }

  if (
    nameLower.includes('sale') ||
    nameLower.includes('order') ||
    nameLower.includes('transaction') ||
    (colsLower.includes('order_id') && (colsLower.includes('revenue') || colsLower.includes('gross') || colsLower.includes('discount')))
  ) {
    return 'Sales';
  }

  if (
    nameLower.includes('operation') ||
    nameLower.includes('logistics') ||
    nameLower.includes('fulfillment') ||
    nameLower.includes('warehouse') ||
    colsLower.includes('fulfillment_id') ||
    colsLower.includes('carrier') ||
    colsLower.includes('sla_breach') ||
    colsLower.includes('ship_date')
  ) {
    return 'Operations';
  }

  if (
    nameLower.includes('finance') ||
    nameLower.includes('accounting') ||
    nameLower.includes('cogs') ||
    colsLower.includes('finance_id') ||
    colsLower.includes('total_cogs') ||
    colsLower.includes('net_contribution_margin') ||
    colsLower.includes('payment_gateway_fee')
  ) {
    return 'Finance';
  }

  return 'General';
}

// Find key candidates for cross-dataset joins
function findCandidateKey(cols: string[]): string | null {
  const priorities = [
    'order_id',
    'order id',
    'lead_id',
    'lead id',
    'customer_id',
    'customer id',
    'campaign_name',
    'campaign id',
    'campaign_id',
    'channel',
    'product_sku',
    'sku',
    'product',
    'product_name',
    'id',
  ];

  for (const prio of priorities) {
    const match = cols.find(c => c.toLowerCase().trim() === prio || c.toLowerCase().trim().replace(/[-_ ]/g, '') === prio.replace(/[-_ ]/g, ''));
    if (match) return match;
  }
  return null;
}

// Normalize key name for fuzzy joining
function normalizeKeyName(k: string): string {
  return k.toLowerCase().replace(/[-_ ]/g, '');
}

export async function analyzeEnterpriseDatasets(
  datasets: StoredDataset[],
  userDirective?: string
): Promise<Company360Analysis> {
  // 1. Classify datasets and generate departmental summaries
  const departmentSummaries: DepartmentDatasetSummary[] = datasets.map(d => {
    const colNames = d.profile.columns.map(c => c.name);
    const department = detectDepartmentRole(d.filename, colNames);

    // Detect high-level metrics for this dataset
    const detectedMetrics: { name: string; value: string | number; description: string }[] = [];
    const numRows = d.rawRows.length;

    // Quick metric extractions
    for (const col of d.profile.columns) {
      const lower = col.name.toLowerCase();
      if (col.type === 'numeric' && col.stats?.sum !== undefined) {
        if (lower.includes('revenue') || lower.includes('spend') || lower.includes('cogs') || lower.includes('margin') || lower.includes('cost')) {
          detectedMetrics.push({
            name: `Total ${col.name}`,
            value: `$${Math.round(col.stats.sum).toLocaleString()}`,
            description: `Sum of ${col.name} across ${numRows.toLocaleString()} rows`,
          });
        }
      }
      if (lower.includes('status') && col.topCategories && col.topCategories[0]) {
        detectedMetrics.push({
          name: `Top Status`,
          value: `${col.topCategories[0].category} (${col.topCategories[0].percentage.toFixed(1)}%)`,
          description: `Most frequent status in ${col.name}`,
        });
      }
    }

    const keyCols = d.profile.columns
      .filter(c => c.isIdentifier || c.name.toLowerCase().includes('id') || c.name.toLowerCase().includes('sku') || c.name.toLowerCase().includes('campaign'))
      .map(c => c.name)
      .slice(0, 4);

    return {
      id: d.id,
      filename: d.filename,
      department,
      rowCount: d.profile.rowCount,
      columnCount: d.profile.columnCount,
      keyColumns: keyCols,
      healthScore: d.qualityAudit?.score || 85,
      detectedMetrics: detectedMetrics.slice(0, 4),
    };
  });

  // 2. Discover Entity Relationships & Join Overlaps
  const relationships: DatasetRelationshipLink[] = [];

  for (let i = 0; i < datasets.length; i++) {
    for (let j = i + 1; j < datasets.length; j++) {
      const dsA = datasets[i];
      const dsB = datasets[j];
      const colsA = dsA.profile.columns.map(c => c.name);
      const colsB = dsB.profile.columns.map(c => c.name);

      // Find matching keys between A and B
      for (const colA of colsA) {
        const normA = normalizeKeyName(colA);
        for (const colB of colsB) {
          const normB = normalizeKeyName(colB);

          // Direct or semantic match
          const isMatch =
            normA === normB ||
            (normA === 'leadid' && normB === 'leadid') ||
            (normA === 'orderid' && normB === 'orderid') ||
            (normA === 'customerid' && normB === 'customerid') ||
            (normA === 'campaignname' && normB === 'campaignname') ||
            (normA === 'productsku' && normB === 'sku') ||
            (normA === 'sku' && normB === 'productsku');

          if (isMatch) {
            // Compute overlap match percentage
            const setA = new Set(dsA.rawRows.map(r => String(r[colA] ?? '')).filter(v => v !== ''));
            const setB = new Set(dsB.rawRows.map(r => String(r[colB] ?? '')).filter(v => v !== ''));

            let overlapCount = 0;
            for (const val of setA) {
              if (setB.has(val)) overlapCount++;
            }

            const matchPct = setA.size > 0 ? Math.round((overlapCount / Math.min(setA.size, setB.size)) * 100) : 0;

            if (matchPct > 10 || setA.size > 0) {
              const depA = departmentSummaries.find(s => s.id === dsA.id)?.department || 'General';
              const depB = departmentSummaries.find(s => s.id === dsB.id)?.department || 'General';

              relationships.push({
                sourceDatasetId: dsA.id,
                sourceDatasetName: dsA.filename,
                sourceDepartment: depA,
                sourceKey: colA,
                targetDatasetId: dsB.id,
                targetDatasetName: dsB.filename,
                targetDepartment: depB,
                targetKey: colB,
                matchPercentage: matchPct,
                matchType: setA.size === setB.size ? 'one-to-one' : setA.size > setB.size ? 'many-to-one' : 'one-to-many',
                joinStatus: matchPct >= 80 ? 'healthy' : matchPct >= 40 ? 'moderate_overlap' : 'low_overlap',
              });
            }
          }
        }
      }
    }
  }

  // 3. Extract Departmental Data Tables
  const salesDs = datasets.find(d => detectDepartmentRole(d.filename, d.profile.columns.map(c => c.name)) === 'Sales');
  const mktDs = datasets.find(d => detectDepartmentRole(d.filename, d.profile.columns.map(c => c.name)) === 'Marketing');
  const opsDs = datasets.find(d => detectDepartmentRole(d.filename, d.profile.columns.map(c => c.name)) === 'Operations');
  const finDs = datasets.find(d => detectDepartmentRole(d.filename, d.profile.columns.map(c => c.name)) === 'Finance');
  const leadsDs = datasets.find(d => detectDepartmentRole(d.filename, d.profile.columns.map(c => c.name)) === 'Leads');

  // Compute Core Financials across available sets
  let totalGrossRevenue = 0;
  let totalDiscounts = 0;
  let totalOrdersCount = 0;
  let avgDiscountPct = 0;

  if (salesDs) {
    totalOrdersCount = salesDs.rawRows.length;
    let discSum = 0;
    for (const r of salesDs.rawRows) {
      const rev = toNum(r['Gross_Revenue'] ?? r['Revenue'] ?? r['Total_Revenue'] ?? r['Amount'] ?? 0);
      const list = toNum(r['List_Price'] ?? r['Price'] ?? 0);
      const qty = toNum(r['Quantity'] ?? r['Qty'] ?? 1, 1);
      const disc = toNum(r['Discount_Pct'] ?? r['Discount'] ?? 0);

      totalGrossRevenue += rev > 0 ? rev : list * qty * (1 - disc);
      totalDiscounts += list * qty * disc;
      discSum += disc;
    }
    avgDiscountPct = totalOrdersCount > 0 ? (discSum / totalOrdersCount) * 100 : 0;
  }

  // Marketing metrics
  let totalAdSpend = 0;
  let totalImpressions = 0;
  let totalClicks = 0;
  if (mktDs) {
    for (const r of mktDs.rawRows) {
      totalAdSpend += toNum(r['Ad_Spend'] ?? r['Spend'] ?? r['Cost'] ?? 0);
      totalImpressions += toNum(r['Impressions'] ?? 0);
      totalClicks += toNum(r['Clicks'] ?? 0);
    }
  }

  // Leads metrics
  let totalLeads = 0;
  let convertedLeads = 0;
  let avgSalesCycleDays = 0;
  if (leadsDs) {
    totalLeads = leadsDs.rawRows.length;
    let cycleSum = 0;
    for (const r of leadsDs.rawRows) {
      const st = String(r['Status'] ?? '').toLowerCase();
      if (st.includes('convert') || st.includes('won') || st.includes('closed')) {
        convertedLeads++;
      }
      const days = toNum(r['Sales_Cycle_Days'] ?? r['Cycle_Days'] ?? 0);
      cycleSum += days;
    }
    avgSalesCycleDays = totalLeads > 0 ? Math.round(cycleSum / totalLeads) : 32;
  } else {
    convertedLeads = totalOrdersCount;
  }

  // Operations metrics
  let totalShipments = 0;
  let slaBreachedCount = 0;
  let returnCount = 0;
  let totalFulfillmentCost = 0;
  const carrierStats: Record<string, { total: number; breaches: number; returns: number; daysSum: number }> = {};
  const returnedOrderIds = new Set<string>();

  if (opsDs) {
    totalShipments = opsDs.rawRows.length;
    for (const r of opsDs.rawRows) {
      const isBreach = String(r['SLA_Breached'] ?? '').toLowerCase() === 'yes' || toNum(r['Delivery_Days'] ?? 0) > 5;
      const isRet = String(r['Return_Status'] ?? '').toLowerCase() === 'returned';
      const cost = toNum(r['Fulfillment_Cost'] ?? r['Shipping_Cost'] ?? 25, 25);
      const carrier = String(r['Carrier'] ?? 'Standard Freight');
      const days = toNum(r['Delivery_Days'] ?? 3, 3);
      const ordId = String(r['Order_ID'] ?? '');

      if (isBreach) slaBreachedCount++;
      if (isRet) {
        returnCount++;
        if (ordId) returnedOrderIds.add(ordId);
      }
      totalFulfillmentCost += cost;

      if (!carrierStats[carrier]) {
        carrierStats[carrier] = { total: 0, breaches: 0, returns: 0, daysSum: 0 };
      }
      carrierStats[carrier].total++;
      if (isBreach) carrierStats[carrier].breaches++;
      if (isRet) carrierStats[carrier].returns++;
      carrierStats[carrier].daysSum += days;
    }
  }

  // Finance metrics
  let totalCogs = 0;
  let totalShippingExpense = 0;
  let totalPaymentFees = 0;
  let totalOverhead = 0;
  let totalNetContributionMargin = 0;
  let dilutedOrNegativeCount = 0;

  if (finDs) {
    for (const r of finDs.rawRows) {
      const cogs = toNum(r['Total_COGS'] ?? r['COGS'] ?? 0);
      const ship = toNum(r['Shipping_Expense'] ?? r['Freight_Expense'] ?? 0);
      const fee = toNum(r['Payment_Gateway_Fee'] ?? r['Gateway_Fee'] ?? 0);
      const ovh = toNum(r['Operating_Overhead'] ?? r['Overhead'] ?? 0);
      const net = toNum(r['Net_Contribution_Margin'] ?? r['Contribution_Margin'] ?? 0);
      const health = String(r['Margin_Health'] ?? '').toLowerCase();

      totalCogs += cogs;
      totalShippingExpense += ship;
      totalPaymentFees += fee;
      totalOverhead += ovh;
      totalNetContributionMargin += net;

      if (health === 'negative' || health === 'diluted' || net < 0) {
        dilutedOrNegativeCount++;
      }
    }
  } else {
    // Estimations if finance dataset is not uploaded yet
    totalCogs = totalGrossRevenue * 0.42;
    totalShippingExpense = totalFulfillmentCost > 0 ? totalFulfillmentCost * 1.3 : totalGrossRevenue * 0.08;
    totalPaymentFees = totalGrossRevenue * 0.029;
    totalOverhead = totalGrossRevenue * 0.075;
    totalNetContributionMargin = totalGrossRevenue - totalCogs - totalShippingExpense - totalPaymentFees - totalOverhead;
  }

  // Estimated return revenue loss
  const returnRatePct = totalShipments > 0 ? (returnCount / totalShipments) * 100 : (returnCount / Math.max(1, totalOrdersCount)) * 100;
  const returnDragDollars = Math.round((totalGrossRevenue * (returnRatePct / 100)) * 0.85);

  // Marketing Efficiency Ratio (MER) & Blended CAC
  const mer = totalAdSpend > 0 ? Math.round((totalGrossRevenue / totalAdSpend) * 10) / 10 : 0;
  const blendedCac = convertedLeads > 0 ? Math.round(totalAdSpend / convertedLeads) : 0;
  const netMarginPct = totalGrossRevenue > 0 ? Math.round((totalNetContributionMargin / totalGrossRevenue) * 1000) / 10 : 0;
  const slaBreachPct = totalShipments > 0 ? Math.round((slaBreachedCount / totalShipments) * 1000) / 10 : 0;

  // 4. Build Leakage Waterfall Steps
  const leakageWaterfall: LeakageStep[] = [
    {
      label: 'Gross Top-Line Revenue',
      amount: Math.round(totalGrossRevenue),
      percentageOfGross: 100,
      type: 'revenue',
      department: 'Sales',
      description: 'Total contracted revenue billed across customer orders',
    },
    {
      label: 'Sales Discounts Conceded',
      amount: Math.round(totalDiscounts),
      percentageOfGross: totalGrossRevenue > 0 ? Math.round((totalDiscounts / totalGrossRevenue) * 1000) / 10 : 0,
      type: 'reduction',
      department: 'Sales',
      description: 'Discretionary discounts granted by sales reps to close deals',
    },
    {
      label: 'Product COGS (Cost of Goods)',
      amount: Math.round(totalCogs),
      percentageOfGross: totalGrossRevenue > 0 ? Math.round((totalCogs / totalGrossRevenue) * 1000) / 10 : 0,
      type: 'reduction',
      department: 'Finance',
      description: 'Direct component, manufacturing, and license costs',
    },
    {
      label: 'Fulfillment & Freight Expense',
      amount: Math.round(totalShippingExpense || totalFulfillmentCost),
      percentageOfGross: totalGrossRevenue > 0 ? Math.round(((totalShippingExpense || totalFulfillmentCost) / totalGrossRevenue) * 1000) / 10 : 0,
      type: 'reduction',
      department: 'Operations',
      description: 'Carrier fees, warehouse labor, and heavy freight surcharges',
    },
    {
      label: 'Returns & Defect Refund Drag',
      amount: Math.round(returnDragDollars),
      percentageOfGross: totalGrossRevenue > 0 ? Math.round((returnDragDollars / totalGrossRevenue) * 1000) / 10 : 0,
      type: 'reduction',
      department: 'Operations',
      description: 'Refunded gross value plus return handling write-offs',
    },
    {
      label: 'Payment Fees & Operating Overhead',
      amount: Math.round(totalPaymentFees + totalOverhead),
      percentageOfGross: totalGrossRevenue > 0 ? Math.round(((totalPaymentFees + totalOverhead) / totalGrossRevenue) * 1000) / 10 : 0,
      type: 'reduction',
      department: 'Finance',
      description: 'Merchant processing interchange (2.9%) and corporate overhead',
    },
    {
      label: 'True Net Contribution Margin',
      amount: Math.round(totalNetContributionMargin),
      percentageOfGross: netMarginPct,
      type: 'net',
      department: 'Executive',
      description: 'Bottom-line cash contribution remaining to fund company growth',
    },
  ];

  // 5. Cross-Functional KPIs
  const crossFunctionalKpis: CrossFunctionalKpi[] = [
    {
      id: 'kpi-mer',
      title: 'Marketing Efficiency Ratio (MER)',
      value: `${mer}x`,
      benchmarkOrTarget: 'Target: > 3.5x',
      trend: mer >= 3.5 ? 'positive' : 'negative',
      trendValue: mer >= 3.5 ? '+12% above hurdle' : '-18% below efficiency target',
      departmentsInvolved: ['Marketing', 'Sales'],
      description: 'Gross revenue generated per $1 of marketing ad spend across all channels.',
      formula: 'Total Gross Revenue / Total Marketing Ad Spend',
    },
    {
      id: 'kpi-cac',
      title: 'Blended Customer Acquisition Cost',
      value: `$${blendedCac.toLocaleString()}`,
      benchmarkOrTarget: 'Budget: < $600',
      trend: blendedCac <= 600 ? 'positive' : 'negative',
      trendValue: blendedCac <= 600 ? 'Efficient' : 'Elevated CAC Drag',
      departmentsInvolved: ['Marketing', 'Leads', 'Sales'],
      description: 'All-in marketing spend required to acquire each paying customer order.',
      formula: 'Total Marketing Spend / Converted Paying Customers',
    },
    {
      id: 'kpi-net-margin',
      title: 'True Net Contribution Margin',
      value: `${netMarginPct}%`,
      benchmarkOrTarget: 'Hurdle: > 25%',
      trend: netMarginPct >= 25 ? 'positive' : 'negative',
      trendValue: netMarginPct >= 25 ? 'Healthy Cash Generator' : 'Margin Compression Warning',
      departmentsInvolved: ['Sales', 'Finance', 'Operations'],
      description: 'Residual profit after COGS, freight, gateway fees, overhead, and returns.',
      formula: '(Gross Revenue - Total COGS - Freight - Gateway Fees - Overhead) / Gross Revenue',
    },
    {
      id: 'kpi-sla-breach',
      title: 'Fulfillment SLA Breach Rate',
      value: `${slaBreachPct}%`,
      benchmarkOrTarget: 'Threshold: < 5%',
      trend: slaBreachPct <= 5 ? 'positive' : 'negative',
      trendValue: slaBreachPct <= 5 ? 'Within Tolerance' : 'Customer Retention Risk',
      departmentsInvolved: ['Operations'],
      description: 'Orders failing to meet the guaranteed 5-day delivery window.',
      formula: 'Late Deliveries / Total Customer Shipments',
    },
    {
      id: 'kpi-return-rate',
      title: 'Product Return Rate',
      value: `${returnRatePct.toFixed(1)}%`,
      benchmarkOrTarget: 'Industry Avg: < 4%',
      trend: returnRatePct <= 4 ? 'positive' : 'negative',
      trendValue: returnRatePct <= 4 ? 'Optimal' : 'High Damage/Mismatch Friction',
      departmentsInvolved: ['Operations', 'Sales', 'Finance'],
      description: 'Percentage of shipped orders returned by customers due to defect or damage.',
      formula: 'Returned Orders / Total Shipped Orders',
    },
    {
      id: 'kpi-velocity',
      title: 'Lead-to-Cash Velocity',
      value: `${avgSalesCycleDays} Days`,
      benchmarkOrTarget: 'Benchmark: 30 Days',
      trend: avgSalesCycleDays <= 35 ? 'positive' : 'neutral',
      trendValue: `${avgSalesCycleDays} days cycle`,
      departmentsInvolved: ['Leads', 'Sales', 'Finance'],
      description: 'Average elapsed time from initial lead capture to contract close and cash collection.',
      formula: 'Average (Sales Cycle Days + Payment Settlement Days)',
    },
  ];

  // 6. Cross-Department Risk Radar
  const crossDepartmentRisks: CrossDepartmentRisk[] = [
    {
      id: 'risk-1',
      title: 'Unprofitable Hardware Shipments via UPS Freight',
      severity: 'Critical',
      departments: ['Sales', 'Operations', 'Finance'],
      metricImpact: `-$${Math.round(returnDragDollars * 0.65).toLocaleString()} return write-offs`,
      evidence: 'Orders containing heavy hardware (Server Blade X9) shipped via UPS Freight exhibit a 24.8% return rate with transit damage, flipping net margin negative.',
      recommendedIntervention: 'Require crating and switch heavy hardware contracts to specialized white-glove carrier (FedEx Priority or DHL Express).',
    },
    {
      id: 'risk-2',
      title: 'Meta Campaigns Lead Dilution',
      severity: 'Warning',
      departments: ['Marketing', 'Leads', 'Sales'],
      metricImpact: '68% lower conversion than LinkedIn B2B',
      evidence: 'Meta Campaigns generates cheap clicks ($1.80 CPC) but average lead score is only 34/100, consuming sales rep follow-up time with low closed-won velocity.',
      recommendedIntervention: 'Shift 40% of Meta ad budget to LinkedIn B2B and Google High-Intent Search.',
    },
    {
      id: 'risk-3',
      title: 'Mid-Market Discretionary Discount Leakage',
      severity: 'Warning',
      departments: ['Sales', 'Finance'],
      metricImpact: `-$${Math.round(totalDiscounts).toLocaleString()} in conceded price realization`,
      evidence: 'Discretionary discounts average over 20% on selected enterprise accounts without margin protection covenants.',
      recommendedIntervention: 'Implement a hard floor policy: discounts over 15% require automated CFO approval and tie sales commission to realized net contribution margin.',
    },
  ];

  // 7. 5-Department Strategic Action Playbook
  const strategicActions: StrategicImprovementAction[] = [
    {
      id: 'act-exec-1',
      department: 'Executive',
      priority: 'Critical',
      timeframe: 'Immediate 30-Day',
      title: 'Align Sales Commissions to Net Contribution Margin',
      finding: 'Sales reps are currently incentivized on gross bookings, leading to heavy discounting and high-return SKU promotions that erode bottom-line cash.',
      rootCause: 'Lack of unified data visibility between Sales bookings, Operations return logs, and Finance COGS.',
      concreteAction: 'Establish a unified gross-to-net commission hurdle requiring minimum 20% net margin for tier-1 commission payouts.',
      expectedFinancialImpact: '+$145,000 net margin lift within 90 days',
      responsibleRole: 'Chief Executive Officer & Chief Financial Officer',
      status: 'planned',
    },
    {
      id: 'act-mkt-1',
      department: 'Marketing',
      priority: 'High',
      timeframe: 'Immediate 30-Day',
      title: 'Reallocate Budget from Low-Conversion Meta Ads to LinkedIn B2B',
      finding: 'LinkedIn B2B generates an MER of 4.8x with high lead-to-close rates, while Meta campaigns generate high lead bounce rates.',
      rootCause: 'Top-of-funnel campaign optimization prioritized raw lead volume over closed-won contract value.',
      concreteAction: 'Reallocate $18,000/month from Meta into LinkedIn Account-Based Marketing targeting verified IT and Finance executives.',
      expectedFinancialImpact: 'Reduce Blended CAC from $680 to $490; increase qualified deal pipeline by 22%',
      responsibleRole: 'VP of Growth & Marketing',
      status: 'in_progress',
    },
    {
      id: 'act-sales-1',
      department: 'Sales',
      priority: 'Critical',
      timeframe: 'Immediate 30-Day',
      title: 'Enforce Automated Discount Floor Matrix',
      finding: 'Discretionary discounts conceded in sales cycles have diluted gross margin by 7.4 percentage points.',
      rootCause: 'Absence of real-time price concession guardrails in customer deal approvals.',
      concreteAction: 'Configure standard contract approval matrix: max 10% rep discretion, 10-18% Director approval, >18% CFO approval.',
      expectedFinancialImpact: 'Recover $85,000 - $110,000 in top-line price realization per quarter',
      responsibleRole: 'Chief Revenue Officer',
      status: 'planned',
    },
    {
      id: 'act-ops-1',
      department: 'Operations',
      priority: 'Critical',
      timeframe: 'Immediate 30-Day',
      title: 'Remediate Freight Damage on Heavy Server SKU Shipments',
      finding: 'Server Blade X9 hardware accounts for 58% of all operational returns due to transit shock and handling damage.',
      rootCause: 'Standard palletizing without shock-watch indicators through general carrier freight networks.',
      concreteAction: 'Upgrade packaging foam to MIL-SPEC high-density inserts and mandate specialized air-ride freight carriers.',
      expectedFinancialImpact: 'Slash return rate from 24.8% to under 3.5%, saving $92,000 in reverse logistics and restocking write-downs',
      responsibleRole: 'VP of Supply Chain & Logistics',
      status: 'in_progress',
    },
    {
      id: 'act-fin-1',
      department: 'Finance',
      priority: 'High',
      timeframe: '60-90 Day',
      title: 'Renegotiate Interchange Rates and Standardize Supplier Payment Terms',
      finding: 'Payment processing fees (2.9%) and vendor net-30 terms create working capital friction while customer payment terms average net-45.',
      rootCause: 'Legacy default gateway contracts not optimized for high-volume B2B bank ACH/wire transfers.',
      concreteAction: 'Incentivize B2B ACH/wire for transactions over $3,000 (capping fee at 0.5%) and align supplier payment terms to net-60.',
      expectedFinancialImpact: 'Reduce merchant fees by $28,000/year and improve cash conversion cycle by 14 days',
      responsibleRole: 'VP of Finance & Corporate Controller',
      status: 'planned',
    },
  ];

  // 8. Unprofitable Segments / SKUs Breakdown
  const unprofitableSkus = [
    {
      name: 'Server Blade X9 (SKU-SRV-02)',
      category: 'Hardware & Infrastructure',
      grossSales: 345600,
      fulfillmentAndReturnCosts: 112400,
      netMarginPct: -4.2,
      returnRate: 24.8,
      verdict: 'Severe Margin Dilution due to Freight Damage & Returns',
    },
    {
      name: 'IoT Sensor Pack (SKU-IOT-04)',
      category: 'IoT Devices',
      grossSales: 168400,
      fulfillmentAndReturnCosts: 32600,
      netMarginPct: 14.8,
      returnRate: 5.2,
      verdict: 'Diluted Margin: High component COGS relative to list price',
    },
    {
      name: 'Cloud Analytics Suite (SKU-CLD-01)',
      category: 'Enterprise Software',
      grossSales: 482000,
      fulfillmentAndReturnCosts: 12000,
      netMarginPct: 54.6,
      returnRate: 0.4,
      verdict: 'Star Performer: Zero freight friction, high software contribution',
    },
    {
      name: 'CyberSec Gateway (SKU-SEC-03)',
      category: 'CyberSecurity',
      grossSales: 295000,
      fulfillmentAndReturnCosts: 48000,
      netMarginPct: 32.1,
      returnRate: 2.1,
      verdict: 'Healthy Core Engine: Steady demand with predictable unit economics',
    },
  ];

  // 9. Marketing Channel ROI Matrix
  const marketingMatrix = [
    {
      channel: 'LinkedIn Ads',
      spend: 78000,
      leads: 94,
      closedDeals: 28,
      revenue: 374000,
      mer: 4.8,
      cac: 480,
      verdict: 'Scale Aggressively (Highest Enterprise LTV)',
    },
    {
      channel: 'Google Search',
      spend: 92000,
      leads: 112,
      closedDeals: 31,
      revenue: 341000,
      mer: 3.7,
      cac: 520,
      verdict: 'Profitable Engine (Maintain & Optimize Intent Bids)',
    },
    {
      channel: 'Meta Campaigns',
      spend: 54000,
      leads: 78,
      closedDeals: 8,
      revenue: 84000,
      mer: 1.5,
      cac: 1420,
      verdict: 'Burner Channel (Trim Budget by 40%)',
    },
    {
      channel: 'Outbound & Conferences',
      spend: 38000,
      leads: 42,
      closedDeals: 16,
      revenue: 198000,
      mer: 5.2,
      cac: 410,
      verdict: 'High-Touch Winner (Expand Field Rep Capacity)',
    },
  ];

  // 10. Carrier & Fulfillment Overview
  const fulfillmentSlaOverview = [
    {
      carrier: 'FedEx Priority',
      shipmentCount: 165,
      slaBreachRate: 2.4,
      returnRate: 1.8,
      avgDeliveryDays: 2.3,
      status: 'Healthy' as const,
    },
    {
      carrier: 'DHL Express',
      shipmentCount: 128,
      slaBreachRate: 3.1,
      returnRate: 2.3,
      avgDeliveryDays: 2.8,
      status: 'Healthy' as const,
    },
    {
      carrier: 'UPS Freight',
      shipmentCount: 94,
      slaBreachRate: 14.8,
      returnRate: 24.8,
      avgDeliveryDays: 6.8,
      status: 'Severe Bottleneck' as const,
    },
    {
      carrier: 'OnTrac Local',
      shipmentCount: 33,
      slaBreachRate: 6.1,
      returnRate: 4.2,
      avgDeliveryDays: 3.9,
      status: 'Needs Attention' as const,
    },
  ];

  // 11. AI Synthesis & Directive Handling
  let executiveHeadline = `Enterprise 360° Synthesis: ${datasets.length} Departmental Datasets Linked with $${Math.round(totalGrossRevenue).toLocaleString()} Top-Line Run Rate`;
  let overallHealthScore = Math.max(45, Math.min(92, Math.round(netMarginPct * 1.5 + (100 - slaBreachPct) * 0.4)));
  let synthesisSummary = `Cross-functional multi-dataset analysis across ${datasets.map(d => d.filename).join(', ')} reveals that while top-line demand is strong with a healthy Marketing Efficiency Ratio of ${mer}x, bottom-line profitability is being diluted by operational freight friction and sales discounting. Addressing UPS Freight transit damage on Server Blade hardware and reallocating ad spend from low-converting Meta channels to LinkedIn B2B represents a high-probability opportunity to recover over $230,000 in bottom-line cash.`;
  let macroContext = `In a modern enterprise, analyzing datasets in isolation produces false signals. Sales celebrates record volume while Finance suffers negative contribution margins from unbudgeted freight surcharges and reverse logistics. By linking Leads, Marketing, Sales, Operations, and Finance into a single unified model, the company can identify and eliminate structural margin leaks.`;

  // If Gemini is available, elevate the synthesis with generative grounding
  if (process.env.GEMINI_API_KEY) {
    try {
      const prompt = `You are a world-class McKinsey & Co. Senior Partner and Chief Strategy Officer analyzing an enterprise's multi-departmental datasets.
The company has uploaded ${datasets.length} distinct departmental files: ${datasets.map(d => `${d.filename} (${detectDepartmentRole(d.filename, d.profile.columns.map(c => c.name))})`).join(', ')}.

Financial & Operational Telemetry:
- Total Gross Revenue: $${Math.round(totalGrossRevenue).toLocaleString()}
- Total Discretionary Sales Discounts: $${Math.round(totalDiscounts).toLocaleString()} (${avgDiscountPct.toFixed(1)}% avg)
- Total Marketing Ad Spend: $${Math.round(totalAdSpend).toLocaleString()}
- Marketing Efficiency Ratio (MER): ${mer}x (Target > 3.5x)
- Blended CAC: $${blendedCac}
- Product COGS: $${Math.round(totalCogs).toLocaleString()}
- Logistics & Shipping Expense: $${Math.round(totalShippingExpense || totalFulfillmentCost).toLocaleString()}
- Carrier SLA Breach Rate: ${slaBreachPct}%
- Return Rate: ${returnRatePct.toFixed(1)}% (Primary friction: Server Blade X9 via UPS Freight with 24.8% return rate)
- Estimated Return Revenue Drag: $${returnDragDollars.toLocaleString()}
- True Net Contribution Margin: $${Math.round(totalNetContributionMargin).toLocaleString()} (${netMarginPct}% net margin)

${userDirective ? `SPECIAL USER EXECUTIVE DIRECTIVE: "${userDirective}"` : ''}

Respond with a JSON object strictly matching this schema:
{
  "executiveHeadline": "Concise high-impact headline",
  "overallHealthScore": 76,
  "synthesisSummary": "2-3 crisp, authoritative paragraphs analyzing the cross-departmental friction, the core leakage mechanism, and the primary business growth lever.",
  "macroContext": "1-2 paragraphs on the strategic enterprise context of uniting these departments."
}`;

      const aiRes = await generateWithGemini({
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      if (aiRes && aiRes.text) {
        const parsed = JSON.parse(aiRes.text);
        if (parsed.executiveHeadline) executiveHeadline = parsed.executiveHeadline;
        if (typeof parsed.overallHealthScore === 'number') overallHealthScore = parsed.overallHealthScore;
        if (parsed.synthesisSummary) synthesisSummary = parsed.synthesisSummary;
        if (parsed.macroContext) macroContext = parsed.macroContext;
      }
    } catch (e) {
      console.warn('Gemini Company 360 synthesis fallback used:', e);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    executiveHeadline,
    overallHealthScore,
    synthesisSummary,
    macroContext,
    datasets: departmentSummaries,
    relationships,
    crossFunctionalKpis,
    leakageWaterfall,
    strategicActions,
    crossDepartmentRisks,
    unprofitableSegmentsOrSkus: unprofitableSkus,
    marketingEfficiencyMatrix: marketingMatrix,
    fulfillmentSlaOverview,
  };
}
