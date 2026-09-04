import { DatasetProfile, InsightItem } from './types.js';
import { parseCleanNumber, parseDateSafe } from './profiler.js';

export function generateAutomatedInsights(
  rows: Record<string, any>[],
  profile: DatasetProfile
): InsightItem[] {
  const insights: InsightItem[] = [];
  const numCols = profile.columns.filter(c => c.type === 'numeric');
  const catCols = profile.columns.filter(c => c.type === 'categorical');
  const dateCols = profile.columns.filter(c => c.type === 'datetime');

  // 1. CONCENTRATION (Pareto Analysis)
  // Check primary metric (e.g. Revenue, Sales, or first numeric) against primary categorical
  const primaryMetricCol = numCols.find(c => {
    const l = c.name.toLowerCase();
    return l.includes('revenue') || l.includes('sale') || l.includes('amount') || l.includes('profit');
  }) || numCols[0];

  const primaryCatCol = catCols.find(c => {
    const l = c.name.toLowerCase();
    return l.includes('product') || l.includes('category') || l.includes('segment') || l.includes('region');
  }) || catCols[0];

  if (primaryMetricCol && primaryCatCol) {
    const groupTotals = new Map<string, number>();
    let grandTotal = 0;

    for (const r of rows) {
      const cat = r[primaryCatCol.name];
      const val = parseCleanNumber(r[primaryMetricCol.name]);
      if (cat && val.isNum) {
        const k = String(cat).trim();
        groupTotals.set(k, (groupTotals.get(k) || 0) + val.value);
        grandTotal += val.value;
      }
    }

    if (groupTotals.size >= 3 && grandTotal > 0) {
      const sorted = Array.from(groupTotals.entries()).sort((a, b) => b[1] - a[1]);
      const topCount = Math.min(3, Math.ceil(sorted.length * 0.4));
      const topSum = sorted.slice(0, topCount).reduce((acc, curr) => acc + curr[1], 0);
      const topShare = Math.round((topSum / grandTotal) * 1000) / 10;

      if (topShare >= 50) {
        const topNames = sorted.slice(0, topCount).map(s => `'${s[0]}'`).join(', ');
        insights.push({
          id: 'insight-concentration',
          category: 'concentration',
          title: `${primaryMetricCol.name} Concentration`,
          finding: `Top ${topCount} ${primaryCatCol.name} groups (${topNames}) drive ${topShare}% of total ${primaryMetricCol.name}.`,
          metric: `${topShare}%`,
          secondaryMetric: `Top ${topCount} of ${sorted.length} groups`,
          interpretation: `Substantial revenue concentration detected. While high efficiency exists in top drivers, performance is heavily dependent on a few segments.`,
          dataContext: `Based on sum of valid ${primaryMetricCol.name} records ($${Math.round(grandTotal).toLocaleString()} total).`,
          confidence: 'high',
          chartSuggestion: {
            type: 'bar',
            x: primaryCatCol.name,
            y: primaryMetricCol.name,
          },
        });
      }
    }
  }

  // 2. CORRELATIONS
  if (numCols.length >= 2) {
    let maxR = 0;
    let bestPair: [string, string] = ['', ''];

    for (let i = 0; i < numCols.length; i++) {
      for (let j = i + 1; j < numCols.length; j++) {
        const colA = numCols[i].name;
        const colB = numCols[j].name;

        // Compute Pearson r
        let sumA = 0;
        let sumB = 0;
        let n = 0;
        const validPairs: [number, number][] = [];

        for (const r of rows) {
          const vA = parseCleanNumber(r[colA]);
          const vB = parseCleanNumber(r[colB]);
          if (vA.isNum && vB.isNum) {
            validPairs.push([vA.value, vB.value]);
            sumA += vA.value;
            sumB += vB.value;
            n++;
          }
        }

        if (n >= 10) {
          const meanA = sumA / n;
          const meanB = sumB / n;
          let num = 0;
          let denA = 0;
          let denB = 0;

          for (const [a, b] of validPairs) {
            const da = a - meanA;
            const db = b - meanB;
            num += da * db;
            denA += da * da;
            denB += db * db;
          }

          if (denA > 0 && denB > 0) {
            const rVal = num / Math.sqrt(denA * denB);
            if (Math.abs(rVal) > Math.abs(maxR)) {
              maxR = rVal;
              bestPair = [colA, colB];
            }
          }
        }
      }
    }

    if (Math.abs(maxR) >= 0.55 && bestPair[0]) {
      const rRounded = Math.round(maxR * 100) / 100;
      const direction = maxR > 0 ? 'positive' : 'negative';
      insights.push({
        id: 'insight-correlation',
        category: 'correlation',
        title: `Strong Association: ${bestPair[0]} & ${bestPair[1]}`,
        finding: `A strong ${direction} correlation (r = ${rRounded}) exists between '${bestPair[0]}' and '${bestPair[1]}'.`,
        metric: `r = ${rRounded}`,
        secondaryMetric: `${Math.round(maxR * maxR * 100)}% Shared Variance`,
        interpretation: `Higher values of '${bestPair[0]}' are strongly associated with ${direction === 'positive' ? 'increased' : 'decreased'} '${bestPair[1]}'. Note that correlation indicates linear co-movement, not causal relationship.`,
        dataContext: `Calculated using Pearson correlation across valid pairwise complete observations.`,
        confidence: 'high',
        chartSuggestion: {
          type: 'scatter',
          x: bestPair[0],
          y: bestPair[1],
        },
      });
    }
  }

  // 3. PROFIT MARGIN INSIGHT
  const revCol = numCols.find(c => c.name.toLowerCase().includes('revenue') || c.name.toLowerCase().includes('sale'));
  const profCol = numCols.find(c => c.name.toLowerCase().includes('profit') || c.name.toLowerCase().includes('margin'));

  if (revCol && profCol) {
    let totRev = 0;
    let totProf = 0;
    let negProfCount = 0;

    for (const r of rows) {
      const vR = parseCleanNumber(r[revCol.name]);
      const vP = parseCleanNumber(r[profCol.name]);
      if (vR.isNum && vP.isNum) {
        totRev += vR.value;
        totProf += vP.value;
        if (vP.value < 0) negProfCount++;
      }
    }

    if (totRev > 0) {
      const overallMargin = Math.round((totProf / totRev) * 1000) / 10;
      insights.push({
        id: 'insight-profitability',
        category: 'profitability',
        title: `Profit Margin Performance`,
        finding: `Overall operating profit margin is ${overallMargin}%, with ${negProfCount} loss-making transactions (${Math.round((negProfCount / rows.length) * 100)}% of orders).`,
        metric: `${overallMargin}%`,
        secondaryMetric: `${negProfCount} Negative Profit Rows`,
        interpretation: `Profitable aggregate health with opportunity to isolate the ${negProfCount} loss-making orders to optimize pricing and discount structures.`,
        dataContext: `Derived from total ${profCol.name} ($${Math.round(totProf).toLocaleString()}) divided by total ${revCol.name} ($${Math.round(totRev).toLocaleString()}).`,
        confidence: 'high',
      });
    }
  }

  // 4. TEMPORAL TRENDS
  if (dateCols.length > 0 && primaryMetricCol) {
    const dCol = dateCols[0];
    const monthTotals = new Map<string, number>();

    for (const r of rows) {
      const dVal = parseDateSafe(r[dCol.name]);
      const mVal = parseCleanNumber(r[primaryMetricCol.name]);
      if (dVal && mVal.isNum) {
        const k = `${dVal.getFullYear()}-${String(dVal.getMonth() + 1).padStart(2, '0')}`;
        monthTotals.set(k, (monthTotals.get(k) || 0) + mVal.value);
      }
    }

    const sortedMonths = Array.from(monthTotals.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    if (sortedMonths.length >= 3) {
      const firstVal = sortedMonths[0][1];
      const lastVal = sortedMonths[sortedMonths.length - 1][1];
      const growth = firstVal !== 0 ? Math.round(((lastVal - firstVal) / Math.abs(firstVal)) * 1000) / 10 : 0;

      insights.push({
        id: 'insight-trend',
        category: 'trend',
        title: `${primaryMetricCol.name} Trajectory Over Time`,
        finding: `${primaryMetricCol.name} experienced a ${growth > 0 ? '+' : ''}${growth}% trajectory from ${sortedMonths[0][0]} to ${sortedMonths[sortedMonths.length - 1][0]}.`,
        metric: `${growth > 0 ? '+' : ''}${growth}%`,
        secondaryMetric: `${sortedMonths.length} Months Tracked`,
        interpretation: growth >= 0
          ? `Positive aggregate growth trajectory observed across the evaluation timeline.`
          : `Contraction observed over the timeline, suggesting seasonal shifts or market softness.`,
        dataContext: `Monthly aggregation of valid ${primaryMetricCol.name} values over ${dCol.name}.`,
        confidence: 'high',
        chartSuggestion: {
          type: 'line',
          x: dCol.name,
          y: primaryMetricCol.name,
        },
      });
    }
  }

  // 5. DATA HEALTH & OUTLIER ALERT
  const outlierCols = numCols.filter(c => c.outlierCountIqr && c.outlierCountIqr > 0);
  if (outlierCols.length > 0) {
    const highestOutlier = outlierCols.sort((a, b) => (b.outlierCountIqr || 0) - (a.outlierCountIqr || 0))[0];
    insights.push({
      id: 'insight-outlier',
      category: 'outlier',
      title: `Distribution Outliers Detected in '${highestOutlier.name}'`,
      finding: `${highestOutlier.outlierCountIqr} extreme values lie outside [Q1 - 1.5×IQR, Q3 + 1.5×IQR] bounds.`,
      metric: `${highestOutlier.outlierCountIqr} Outliers`,
      secondaryMetric: `IQR: ${highestOutlier.iqr}`,
      interpretation: `Outliers may represent high-value enterprise sales or transaction anomalies. Verify if these represent legitimate mega-deals before metric trimming.`,
      dataContext: `Detected via non-parametric Tukey Interquartile Range (IQR) method.`,
      confidence: 'medium',
      chartSuggestion: {
        type: 'box',
        y: highestOutlier.name,
      },
    });
  }

  return insights;
}
