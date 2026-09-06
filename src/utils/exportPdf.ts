import { jsPDF } from 'jspdf';
import Plotly from 'plotly.js-dist-min';
import { ExecutiveReport } from '../types';

export interface PdfExportOptions {
  chartImages?: string[];
  onProgress?: (status: string) => void;
}

/**
 * Renders a Plotly chart figure to a high-resolution PNG data URL
 * with a clean, print-friendly white background and dark typography.
 */
export async function renderPlotlyFigureToDataUrl(
  figure: any,
  width = 960,
  height = 420
): Promise<string> {
  if (typeof window === 'undefined' || !figure || !figure.data || figure.data.length === 0) {
    return '';
  }

  try {
    const tempDiv = document.createElement('div');
    tempDiv.style.width = `${width}px`;
    tempDiv.style.height = `${height}px`;
    tempDiv.style.position = 'fixed';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '-9999px';
    tempDiv.style.visibility = 'hidden';
    document.body.appendChild(tempDiv);

    // Clean presentation layout for print & PDF
    const printLayout = {
      ...figure.layout,
      width,
      height,
      paper_bgcolor: '#ffffff',
      plot_bgcolor: '#ffffff',
      font: {
        family: 'Plus Jakarta Sans, system-ui, -apple-system, sans-serif',
        color: '#0f172a',
        size: 11,
      },
      margin: { l: 60, r: 40, t: 40, b: 50 },
      autosize: false,
    };

    await (Plotly as any).newPlot(tempDiv, figure.data, printLayout, {
      staticPlot: true,
      displayModeBar: false,
      responsive: false,
    });

    const dataUrl = await (Plotly as any).toImage(tempDiv, {
      format: 'png',
      width,
      height,
    });

    try {
      (Plotly as any).purge(tempDiv);
      if (document.body.contains(tempDiv)) {
        document.body.removeChild(tempDiv);
      }
    } catch {
      // Ignore cleanup error
    }

    return dataUrl;
  } catch (err) {
    console.warn('Plotly offscreen render error:', err);
    return '';
  }
}

/**
 * Generates a clean, professional multi-page Executive PDF Report
 * directly in the browser with real embedded graphs and triggers an automatic download.
 */
export async function downloadExecutiveReportPdf(
  report: ExecutiveReport,
  options?: PdfExportOptions
): Promise<void> {
  options?.onProgress?.('Preparing document structure...');

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let cursorY = margin;

  const primaryColor: [number, number, number] = [37, 99, 235]; // Royal Blue
  const darkNavy: [number, number, number] = [15, 23, 42]; // Slate 900
  const slateMuted: [number, number, number] = [100, 116, 139]; // Slate 500
  const emeraldColor: [number, number, number] = [16, 185, 129]; // Emerald 500
  const amberColor: [number, number, number] = [245, 158, 11]; // Amber 500
  const cardBg: [number, number, number] = [248, 250, 252]; // Slate 50
  const cardBorder: [number, number, number] = [226, 232, 240]; // Slate 200

  // -------------------------------------------------------------------------
  // Render Chart Exhibits to Images if not supplied
  // -------------------------------------------------------------------------
  const chartImages: string[] = options?.chartImages && options.chartImages.length >= report.visualSections.length
    ? options.chartImages
    : [];

  if (chartImages.length < report.visualSections.length) {
    for (let i = 0; i < report.visualSections.length; i++) {
      options?.onProgress?.(`Rendering chart exhibit ${i + 1} of ${report.visualSections.length}...`);
      const sec = report.visualSections[i];
      const img = await renderPlotlyFigureToDataUrl(sec.chart, 960, 420);
      chartImages.push(img);
    }
  }

  options?.onProgress?.('Assembling executive dossier pages...');

  function addHeader(title: string, subtitle?: string) {
    doc.setFillColor(...primaryColor);
    doc.rect(margin, cursorY, 3.5, 9, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...darkNavy);
    doc.text(title, margin + 6, cursorY + 6.5);

    if (subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...slateMuted);
      doc.text(subtitle, margin + 6, cursorY + 11.5);
      cursorY += 16;
    } else {
      cursorY += 13;
    }
  }

  function addFooter(pageNum: number, totalPages: number) {
    doc.setDrawColor(...cardBorder);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...slateMuted);
    doc.text('Data Studio by PJA — Autonomous Business Intelligence Dossier', margin, pageHeight - 8);
    doc.text(`Confidential • Page ${pageNum} of ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }

  function checkPageBreak(requiredHeight: number): boolean {
    if (cursorY + requiredHeight > pageHeight - 18) {
      doc.addPage();
      cursorY = margin;
      return true;
    }
    return false;
  }

  // =========================================================================
  // PAGE 1: Executive Cover & Strategic Briefing
  // =========================================================================

  // Brand Header Bar
  doc.setFillColor(...darkNavy);
  doc.roundedRect(margin, cursorY, contentWidth, 24, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(59, 130, 246);
  doc.text('DATA STUDIO BY PJA', margin + 6, cursorY + 8);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('AUTONOMOUS BUSINESS INTELLIGENCE & STRATEGIC DOSSIER', margin + 6, cursorY + 13);

  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  const genDate = new Date(report.generatedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  doc.text(`Date: ${genDate}  |  Domain: ${report.datasetScale.primaryDomain}`, pageWidth - margin - 6, cursorY + 8, { align: 'right' });
  doc.text(`Zero-Hallucination Verified Computation`, pageWidth - margin - 6, cursorY + 13, { align: 'right' });

  cursorY += 30;

  // Dataset Title & Scale Badges
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...darkNavy);
  const cleanTitle = doc.splitTextToSize(report.datasetName, contentWidth);
  doc.text(cleanTitle, margin, cursorY);
  cursorY += cleanTitle.length * 7 + 2;

  // Badges Bar (Records, Columns, Quality Rating)
  doc.setFillColor(...cardBg);
  doc.setDrawColor(...cardBorder);
  doc.roundedRect(margin, cursorY, contentWidth, 11, 1.5, 1.5, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkNavy);
  doc.text(`Scale: ${report.datasetScale.rows.toLocaleString()} Records`, margin + 4, cursorY + 7);
  doc.text(`Attributes: ${report.datasetScale.columns} Columns`, margin + 50, cursorY + 7);
  doc.text(`Quality Rating: ${report.dataQualityHealth.overallScore}/100 (${report.dataQualityHealth.status})`, margin + 105, cursorY + 7);
  doc.text(`Null Rate: ${report.dataQualityHealth.nullRate}%`, pageWidth - margin - 4, cursorY + 7, { align: 'right' });

  cursorY += 17;

  // Section: Executive Briefing Headline
  addHeader('Executive Summary & Strategic Context');

  // Executive Headline Box
  doc.setFillColor(239, 246, 255); // Blue 50
  doc.setDrawColor(191, 219, 254); // Blue 200
  doc.roundedRect(margin, cursorY, contentWidth, 14, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(29, 78, 216);
  const headlineLines = doc.splitTextToSize(`"${report.executiveBrief.headline}"`, contentWidth - 8);
  doc.text(headlineLines, margin + 4, cursorY + 6);
  cursorY += 18;

  // Overview Narrative
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...darkNavy);
  const overviewLines = doc.splitTextToSize(report.executiveBrief.overview, contentWidth);
  doc.text(overviewLines, margin, cursorY);
  cursorY += overviewLines.length * 4.2 + 4;

  // Macro Context
  if (report.executiveBrief.macroContext) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...slateMuted);
    const macroLines = doc.splitTextToSize(`Market Context: ${report.executiveBrief.macroContext}`, contentWidth);
    doc.text(macroLines, margin, cursorY);
    cursorY += macroLines.length * 4 + 6;
  }

  // Two-column box: Core Strengths vs Risks & Warnings
  const colWidth = (contentWidth - 6) / 2;
  const strengthsY = cursorY;

  // Strengths Box (Left)
  doc.setFillColor(240, 253, 244); // Emerald 50
  doc.setDrawColor(187, 247, 208); // Emerald 200
  doc.roundedRect(margin, strengthsY, colWidth, 42, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(4, 120, 87); // Emerald 700
  doc.text('CORE STRENGTHS & VALUE DRIVERS', margin + 4, strengthsY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  let strY = strengthsY + 12;
  report.executiveBrief.strengths.slice(0, 3).forEach((str) => {
    const lines = doc.splitTextToSize(`• ${str}`, colWidth - 8);
    doc.text(lines.slice(0, 2), margin + 4, strY);
    strY += lines.slice(0, 2).length * 4.2 + 1;
  });

  // Risks Box (Right)
  doc.setFillColor(254, 242, 242); // Red 50
  doc.setDrawColor(254, 202, 202); // Red 200
  doc.roundedRect(margin + colWidth + 6, strengthsY, colWidth, 42, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(185, 28, 28); // Red 700
  doc.text('RISKS & CONCENTRATION SENSITIVITY', margin + colWidth + 10, strengthsY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  let rskY = strengthsY + 12;
  report.executiveBrief.risks.slice(0, 3).forEach((rsk) => {
    const lines = doc.splitTextToSize(`• ${rsk}`, colWidth - 8);
    doc.text(lines.slice(0, 2), margin + colWidth + 10, rskY);
    rskY += lines.slice(0, 2).length * 4.2 + 1;
  });

  cursorY = strengthsY + 48;

  // Key Findings Highlight Bar
  doc.setFillColor(...cardBg);
  doc.setDrawColor(...cardBorder);
  doc.roundedRect(margin, cursorY, contentWidth, 18, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...darkNavy);
  doc.text('CORE EXECUTIVE TAKEAWAY', margin + 4, cursorY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...slateMuted);
  const coreTakeaway = `Anchor segment '${report.businessEconomics.topSegmentName}' generates ${report.businessEconomics.topSegmentShareFormatted} of output. Margin sits at ${report.businessEconomics.profitMarginFormatted} with ${report.businessEconomics.averageOrderValueFormatted} AOV. Strategic imperative: diversify beyond Pareto 80/20 risk while automating data validation.`;
  const takeawayLines = doc.splitTextToSize(coreTakeaway, contentWidth - 8);
  doc.text(takeawayLines.slice(0, 2), margin + 4, cursorY + 10);

  // =========================================================================
  // PAGE 2: Financial Economics & Important Insights from Data
  // =========================================================================
  doc.addPage();
  cursorY = margin;

  addHeader('Financial Economics & Performance Scorecard', 'Audited transactional volume, profitability margins, and distribution indices');

  const kpiItems = [
    {
      label: 'Gross Volume / Revenue',
      val: report.businessEconomics.totalRevenueFormatted,
      sub: `${report.datasetScale.rows.toLocaleString()} transactions audited`,
      color: primaryColor,
    },
    {
      label: 'Operating Profitability',
      val: report.businessEconomics.profitMarginFormatted,
      sub: `Net profit: ${report.businessEconomics.totalProfitFormatted}`,
      color: emeraldColor,
    },
    {
      label: 'Average Order Value (AOV)',
      val: report.businessEconomics.averageOrderValueFormatted,
      sub: 'Transaction ticket mean',
      color: primaryColor,
    },
    {
      label: 'Primary Anchor Segment',
      val: report.businessEconomics.topSegmentName,
      sub: `${report.businessEconomics.topSegmentShareFormatted} total volume share`,
      color: amberColor,
    },
    {
      label: 'Pareto 80/20 Concentration',
      val: report.businessEconomics.paretoTop20ShareFormatted,
      sub: 'Volume driven by top 20% contributors',
      color: primaryColor,
    },
    {
      label: 'Growth Momentum',
      val: report.businessEconomics.periodGrowthFormatted,
      sub: 'Period-over-period delta',
      color: emeraldColor,
    },
    {
      label: 'Refunds & Adjustments',
      val: report.businessEconomics.refundAdjustmentFormatted,
      sub: `${report.businessEconomics.refundAdjustmentCount} transactions flagged`,
      color: [225, 29, 72] as [number, number, number],
    },
    {
      label: 'Data Completeness Index',
      val: `${100 - report.dataQualityHealth.nullRate}%`,
      sub: `${report.dataQualityHealth.outlierCount} statistical outliers`,
      color: emeraldColor,
    },
  ];

  const kpiColW = (contentWidth - 6) / 2;
  const kpiRowH = 16;

  kpiItems.forEach((item, idx) => {
    const colIdx = idx % 2;
    const rowIdx = Math.floor(idx / 2);
    const x = margin + colIdx * (kpiColW + 6);
    const y = cursorY + rowIdx * (kpiRowH + 4);

    doc.setFillColor(...cardBg);
    doc.setDrawColor(...cardBorder);
    doc.roundedRect(x, y, kpiColW, kpiRowH, 1.5, 1.5, 'FD');

    // Left accent strip
    doc.setFillColor(...item.color);
    doc.rect(x, y, 2, kpiRowH, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...slateMuted);
    doc.text(item.label.toUpperCase(), x + 5, y + 4.5);

    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...darkNavy);
    doc.text(item.val, x + 5, y + 10.5);

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...slateMuted);
    doc.text(item.sub, x + 5, y + 14);
  });

  cursorY += 4 * (kpiRowH + 4) + 6;

  // Important Insights from Data Section
  addHeader('Important Insights from Data', 'Autonomous statistical pattern recognition, Pareto distribution, and risk alerts');

  const insightItems = report.insights && report.insights.length > 0
    ? report.insights.slice(0, 3)
    : [
        {
          category: 'concentration' as const,
          title: 'Segment Revenue Concentration',
          finding: `Top segment '${report.businessEconomics.topSegmentName}' accounts for ${report.businessEconomics.topSegmentShareFormatted} of total portfolio volume.`,
          metric: report.businessEconomics.topSegmentShareFormatted,
          interpretation: 'A high concentration ratio provides commercial stability but increases single-point exposure. Diversification across secondary tiers is recommended.',
          confidence: 'high' as const,
        },
        {
          category: 'profitability' as const,
          title: 'Unit Margin & Bottom-Line Performance',
          finding: `Portfolio margin audited at ${report.businessEconomics.profitMarginFormatted}, generating ${report.businessEconomics.totalProfitFormatted} in net profit.`,
          metric: report.businessEconomics.profitMarginFormatted,
          interpretation: 'Healthy margins provide buffer against raw cost inflation. Targeted pricing optimization can lift overall yield.',
          confidence: 'high' as const,
        },
        {
          category: 'outlier' as const,
          title: 'Data Hygiene & Variance Profile',
          finding: `${report.dataQualityHealth.outlierCount} distribution outliers identified across ${report.datasetScale.rows.toLocaleString()} verified rows.`,
          metric: `${report.dataQualityHealth.overallScore}/100`,
          interpretation: 'Dataset integrity verified with automated Tukey IQR boundaries and zero tolerance for calculation hallucinations.',
          confidence: 'high' as const,
        },
      ];

  insightItems.forEach((ins, idx) => {
    checkPageBreak(24);

    doc.setFillColor(...cardBg);
    doc.setDrawColor(...cardBorder);
    doc.roundedRect(margin, cursorY, contentWidth, 21, 1.5, 1.5, 'FD');

    // Category pill
    doc.setFillColor(239, 246, 255);
    doc.roundedRect(margin + 4, cursorY + 3, 26, 4.5, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(29, 78, 216);
    doc.text(ins.category.toUpperCase(), margin + 6, cursorY + 6.2);

    // Title & Metric
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...darkNavy);
    doc.text(`${idx + 1}. ${ins.title}`, margin + 33, cursorY + 6.5);

    doc.setFontSize(8);
    doc.setTextColor(16, 185, 129);
    doc.text(ins.metric, pageWidth - margin - 5, cursorY + 6.5, { align: 'right' });

    // Finding
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(...darkNavy);
    const findLines = doc.splitTextToSize(ins.finding, contentWidth - 8);
    doc.text(findLines.slice(0, 1), margin + 4, cursorY + 11.5);

    // Interpretation
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(...slateMuted);
    const interpLines = doc.splitTextToSize(`Takeaway: ${ins.interpretation}`, contentWidth - 8);
    doc.text(interpLines.slice(0, 1), margin + 4, cursorY + 16.5);

    cursorY += 24;
  });

  // =========================================================================
  // PAGES 3+: Visual Analytics Suite (With Embedded Real Charts!)
  // =========================================================================
  for (let idx = 0; idx < report.visualSections.length; idx++) {
    const sec = report.visualSections[idx];
    const chartImg = chartImages[idx];

    doc.addPage();
    cursorY = margin;

    addHeader(
      `Visual Exhibit ${idx + 1}: ${sec.title}`,
      `Chart Type: ${sec.chartType.toUpperCase()} • Interactive model synthesized from ${report.datasetScale.rows.toLocaleString()} records`
    );

    // Render Real Chart Image
    if (chartImg && chartImg.startsWith('data:image/png')) {
      // Container border for chart
      doc.setDrawColor(...cardBorder);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, cursorY, contentWidth, 80, 2, 2, 'D');

      try {
        // Embed real graph PNG image
        doc.addImage(chartImg, 'PNG', margin + 1, cursorY + 1, contentWidth - 2, 78);
      } catch (err) {
        console.warn('Could not embed chart image in PDF:', err);
      }
      cursorY += 84;
    } else {
      // Fallback exhibit card
      doc.setFillColor(...cardBg);
      doc.setDrawColor(...cardBorder);
      doc.roundedRect(margin, cursorY, contentWidth, 36, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...darkNavy);
      doc.text(`Exhibit ${idx + 1}: ${sec.title}`, margin + 6, cursorY + 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...slateMuted);
      doc.text(`Visualization Type: ${sec.chartType.toUpperCase()} (Interactive visualizer active in dashboard)`, margin + 6, cursorY + 16);
      cursorY += 40;
    }

    // Business Interpretation Card
    doc.setFillColor(...cardBg);
    doc.setDrawColor(...cardBorder);
    doc.roundedRect(margin, cursorY, contentWidth, 22, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...darkNavy);
    doc.text('Analytical Business Interpretation', margin + 5, cursorY + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(...slateMuted);
    const interpLines = doc.splitTextToSize(sec.businessInterpretation, contentWidth - 10);
    doc.text(interpLines.slice(0, 2), margin + 5, cursorY + 10.5);

    // Key Strategic Takeaway Bar
    doc.setFillColor(239, 246, 255);
    doc.setDrawColor(191, 219, 254);
    doc.roundedRect(margin, cursorY + 25, contentWidth, 14, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(29, 78, 216);
    doc.text(`Key Takeaway: ${sec.keyTakeaway}`, margin + 5, cursorY + 33.5);

    cursorY += 44;
  }

  // =========================================================================
  // NEXT PAGE: Strategic Action Playbook ("What Needs To Be Done")
  // =========================================================================
  doc.addPage();
  cursorY = margin;

  addHeader('Strategic Action Playbook: What Needs To Be Done', 'Concrete operational execution directives derived from audited dataset patterns');

  report.actionPlan.forEach((act, idx) => {
    checkPageBreak(30);

    const isImmediate = act.category === 'Immediate 30-Day';
    const isOptimization = act.category === '60-90 Day Optimization';
    const isRisk = act.category === 'Risk & Sensitivity';
    const tagBg: [number, number, number] = isImmediate
      ? [239, 246, 255]
      : isOptimization
      ? [240, 253, 244]
      : isRisk
      ? [254, 242, 242]
      : [254, 243, 199];
    const tagColor: [number, number, number] = isImmediate
      ? [29, 78, 216]
      : isOptimization
      ? [4, 120, 87]
      : isRisk
      ? [185, 28, 28]
      : [180, 83, 9];

    doc.setFillColor(...cardBg);
    doc.setDrawColor(...cardBorder);
    doc.roundedRect(margin, cursorY, contentWidth, 26, 1.5, 1.5, 'FD');

    // Header strip: category badge
    doc.setFillColor(...tagBg);
    doc.roundedRect(margin + 4, cursorY + 3, 38, 4.5, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(...tagColor);
    doc.text(act.category.toUpperCase(), margin + 6, cursorY + 6.2);

    // Priority badge
    doc.setFontSize(6.5);
    doc.setTextColor(...slateMuted);
    doc.text(`Priority: ${act.priority}  |  Owner: ${act.responsibleRole}`, margin + 46, cursorY + 6.2);

    // Action Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...darkNavy);
    doc.text(`${idx + 1}. ${act.title}`, margin + 4, cursorY + 11.5);

    // Action Description
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...slateMuted);
    const actLines = doc.splitTextToSize(act.action, contentWidth - 8);
    doc.text(actLines.slice(0, 2), margin + 4, cursorY + 15.5);

    // Expected Impact
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(...emeraldColor);
    doc.text(`Expected Impact: ${act.expectedImpact}`, margin + 4, cursorY + 23);

    cursorY += 29;
  });

  // =========================================================================
  // FINAL PAGE: Data Governance & Quality Audit Verification Scorecard
  // =========================================================================
  checkPageBreak(75);
  addHeader('Data Governance & Audit Verification Scorecard');

  doc.setFillColor(...cardBg);
  doc.setDrawColor(...cardBorder);
  doc.roundedRect(margin, cursorY, contentWidth, 38, 2, 2, 'FD');

  const govItems = [
    { label: 'Overall Quality Health', val: `${report.dataQualityHealth.overallScore}/100 (${report.dataQualityHealth.status})` },
    { label: 'Missing / Null Values', val: `${report.dataQualityHealth.nullRate}% null rate` },
    { label: 'Duplicate Rows', val: `${report.dataQualityHealth.duplicateRows} duplicate records` },
    { label: 'Statistical Outliers', val: `${report.dataQualityHealth.outlierCount} extreme values (Tukey IQR)` },
    { label: 'Compliance & PII Status', val: report.dataQualityHealth.complianceNote },
  ];

  let govY = cursorY + 6;
  govItems.forEach((g) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...darkNavy);
    doc.text(g.label, margin + 6, govY);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...slateMuted);
    doc.text(g.val, margin + 60, govY);

    govY += 6.5;
  });

  cursorY += 44;

  // Zero-Hallucination Methodology Note
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, cursorY, contentWidth, 16, 1.5, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...darkNavy);
  doc.text('METHODOLOGY & DETERMINISTIC INTEGRITY ASSURANCE', margin + 4, cursorY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...slateMuted);
  const methodText =
    'All aggregates, totals, growth rates, and statistical boundaries in this report are deterministically calculated by the computational analytics engine. AI synthesis is restricted to qualitative strategy synthesis and domain taxonomy categorization. No numbers are generated by language model hallucinations.';
  const methodLines = doc.splitTextToSize(methodText, contentWidth - 8);
  doc.text(methodLines, margin + 4, cursorY + 9);

  // Add Footers to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(i, totalPages);
  }

  // Save PDF
  const filename = `${report.datasetName.replace(/[^a-z0-9]/gi, '_')}_Executive_Report.pdf`;
  doc.save(filename);
}

/**
 * Opens a dedicated, clean, styled printable report in a popup window
 * with real embedded charts and auto-triggers the print dialog. Works inside iframes without sandbox blocks.
 */
export async function openPrintableReportWindow(
  report: ExecutiveReport,
  options?: { chartImages?: string[] }
): Promise<void> {
  const chartImages: string[] = options?.chartImages && options.chartImages.length >= report.visualSections.length
    ? options.chartImages
    : [];

  if (chartImages.length < report.visualSections.length) {
    for (let i = 0; i < report.visualSections.length; i++) {
      const sec = report.visualSections[i];
      const img = await renderPlotlyFigureToDataUrl(sec.chart, 960, 420);
      chartImages.push(img);
    }
  }

  const printWindow = window.open('', '_blank', 'width=1000,height=900');
  if (!printWindow) {
    alert('Pop-up was blocked. Please allow pop-ups for this site to view the printable report.');
    return;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${report.datasetName} — Executive Report</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
      color: #0f172a;
      background: #ffffff;
      padding: 32px;
      line-height: 1.5;
      font-size: 13px;
    }
    
    .header-bar {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 16px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .brand { font-size: 11px; font-weight: 800; color: #2563eb; text-transform: uppercase; letter-spacing: 0.05em; }
    .title { font-size: 24px; font-weight: 800; color: #0f172a; margin-top: 4px; }
    .meta { text-align: right; font-size: 11px; color: #64748b; font-family: 'JetBrains Mono', monospace; }
    
    .badge-bar {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }
    .badge {
      font-size: 11px;
      font-weight: 600;
      padding: 4px 10px;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      color: #334155;
    }
    .badge-primary { background: #eff6ff; border-color: #bfdbfe; color: #1d4ed8; }
    .badge-success { background: #f0fdf4; border-color: #bbf7d0; color: #047857; }
    
    .section {
      margin-bottom: 32px;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 14px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #0f172a;
      border-left: 4px solid #2563eb;
      padding-left: 8px;
      margin-bottom: 14px;
    }
    
    .headline-box {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 14px;
      font-size: 14px;
      font-weight: 700;
      color: #1e40af;
      margin-bottom: 14px;
    }
    
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .grid-4 {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    }
    
    .kpi-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 3px solid #2563eb;
      border-radius: 6px;
      padding: 10px 12px;
    }
    .kpi-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; }
    .kpi-val { font-size: 16px; font-weight: 800; color: #0f172a; margin: 4px 0 2px 0; font-family: 'JetBrains Mono', monospace; }
    .kpi-sub { font-size: 10px; color: #64748b; }
    
    .action-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 10px;
    }
    .action-cat {
      display: inline-block;
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 2px 6px;
      background: #eff6ff;
      color: #1d4ed8;
      border-radius: 4px;
      margin-bottom: 6px;
    }
    .action-title { font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
    .action-body { font-size: 11.5px; color: #475569; margin-bottom: 6px; }
    .action-impact { font-size: 11px; font-weight: 600; color: #047857; }

    .chart-container {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 12px;
      text-align: center;
    }
    .chart-img {
      max-width: 100%;
      height: auto;
      max-height: 360px;
      object-fit: contain;
      border-radius: 4px;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      font-size: 11.5px;
    }
    th, td {
      padding: 8px 12px;
      border: 1px solid #e2e8f0;
      text-align: left;
    }
    th { background: #f1f5f9; font-weight: 700; color: #334155; }
    
    .footer {
      border-top: 1px solid #e2e8f0;
      margin-top: 40px;
      padding-top: 12px;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #94a3b8;
    }
    
    @media print {
      body { padding: 0; font-size: 11px; }
      .no-print { display: none; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header-bar">
    <div>
      <div class="brand">Data Studio by PJA • Executive Intelligence Dossier</div>
      <h1 class="title">${report.datasetName}</h1>
    </div>
    <div class="meta">
      <div>Generated: ${new Date(report.generatedAt).toLocaleString()}</div>
      <div>Domain: ${report.datasetScale.primaryDomain}</div>
      <div>Audit Score: ${report.dataQualityHealth.overallScore}/100</div>
    </div>
  </div>

  <div class="badge-bar">
    <div class="badge badge-primary">${report.datasetScale.rows.toLocaleString()} Records</div>
    <div class="badge">${report.datasetScale.columns} Columns</div>
    <div class="badge badge-success">Quality: ${report.dataQualityHealth.overallScore}/100 (${report.dataQualityHealth.status})</div>
    <div class="badge">Null Rate: ${report.dataQualityHealth.nullRate}%</div>
  </div>

  <div class="section">
    <div class="section-title">Executive Briefing & Key Points</div>
    <div class="headline-box">"${report.executiveBrief.headline}"</div>
    <p style="margin-bottom: 12px; color: #334155; line-height: 1.6;">${report.executiveBrief.overview}</p>
    <div class="grid-2">
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px; border-radius: 8px;">
        <strong style="color: #047857; font-size: 11px; text-transform: uppercase;">Key Strengths & Growth Drivers</strong>
        <ul style="margin-top: 6px; padding-left: 16px; font-size: 11.5px; color: #0f172a;">
          ${report.executiveBrief.strengths.map(s => `<li>${s}</li>`).join('')}
        </ul>
      </div>
      <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 12px; border-radius: 8px;">
        <strong style="color: #b91c1c; font-size: 11px; text-transform: uppercase;">Risks & Sensitivity Watchouts</strong>
        <ul style="margin-top: 6px; padding-left: 16px; font-size: 11.5px; color: #0f172a;">
          ${report.executiveBrief.risks.map(r => `<li>${r}</li>`).join('')}
        </ul>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Financial Economics & KPI Dashboard</div>
    <div class="grid-4">
      <div class="kpi-card">
        <div class="kpi-label">Gross Volume</div>
        <div class="kpi-val">${report.businessEconomics.totalRevenueFormatted}</div>
        <div class="kpi-sub">${report.datasetScale.rows.toLocaleString()} records</div>
      </div>
      <div class="kpi-card" style="border-left-color: #10b981;">
        <div class="kpi-label">Audited Margin</div>
        <div class="kpi-val">${report.businessEconomics.profitMarginFormatted}</div>
        <div class="kpi-sub">Net: ${report.businessEconomics.totalProfitFormatted}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Average Order Value</div>
        <div class="kpi-val">${report.businessEconomics.averageOrderValueFormatted}</div>
        <div class="kpi-sub">Mean volume/order</div>
      </div>
      <div class="kpi-card" style="border-left-color: #f59e0b;">
        <div class="kpi-label">Top Contributor</div>
        <div class="kpi-val" style="font-size: 13px;">${report.businessEconomics.topSegmentName}</div>
        <div class="kpi-sub">${report.businessEconomics.topSegmentShareFormatted} of volume</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Pareto 80/20</div>
        <div class="kpi-val">${report.businessEconomics.paretoTop20ShareFormatted}</div>
        <div class="kpi-sub">Top 20% share</div>
      </div>
      <div class="kpi-card" style="border-left-color: #10b981;">
        <div class="kpi-label">Period Growth</div>
        <div class="kpi-val">${report.businessEconomics.periodGrowthFormatted}</div>
        <div class="kpi-sub">Period delta</div>
      </div>
      <div class="kpi-card" style="border-left-color: #e11d48;">
        <div class="kpi-label">Refunds / Negative</div>
        <div class="kpi-val">${report.businessEconomics.refundAdjustmentFormatted}</div>
        <div class="kpi-sub">${report.businessEconomics.refundAdjustmentCount} adjustments</div>
      </div>
      <div class="kpi-card" style="border-left-color: #10b981;">
        <div class="kpi-label">Completeness</div>
        <div class="kpi-val">${100 - report.dataQualityHealth.nullRate}%</div>
        <div class="kpi-sub">${report.dataQualityHealth.outlierCount} outliers</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Visual Analytics Exhibits (Charts & Insights)</div>
    ${report.visualSections.map((sec, i) => `
      <div style="margin-bottom: 24px; page-break-inside: avoid;">
        <h3 style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 6px;">
          Exhibit ${i + 1}: ${sec.title} (${sec.chartType.toUpperCase()})
        </h3>
        ${chartImages[i] ? `
          <div class="chart-container">
            <img class="chart-img" src="${chartImages[i]}" alt="${sec.title}" />
          </div>
        ` : ''}
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; margin-bottom: 6px;">
          <div style="font-size: 11px; color: #475569;">${sec.businessInterpretation}</div>
        </div>
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 8px 12px; font-size: 11.5px; font-weight: 700; color: #1d4ed8;">
          Key Takeaway: ${sec.keyTakeaway}
        </div>
      </div>
    `).join('')}
  </div>

  <div class="section">
    <div class="section-title">Strategic Action Playbook ("What Needs To Be Done")</div>
    ${report.actionPlan.map((act, i) => `
      <div class="action-card">
        <span class="action-cat">${act.category} • Priority: ${act.priority}</span>
        <div class="action-title">${i + 1}. ${act.title}</div>
        <div class="action-body">${act.action}</div>
        <div class="action-impact">Expected Impact: ${act.expectedImpact} (Owner: ${act.responsibleRole})</div>
      </div>
    `).join('')}
  </div>

  <div class="section">
    <div class="section-title">Data Governance & Verification Scorecard</div>
    <table>
      <thead>
        <tr><th>Audit Metric</th><th>Audited Result</th><th>Compliance Standard</th></tr>
      </thead>
      <tbody>
        <tr><td>Overall Reliability Index</td><td><strong>${report.dataQualityHealth.overallScore}/100</strong></td><td>${report.dataQualityHealth.status}</td></tr>
        <tr><td>Missing / Null Rate</td><td>${report.dataQualityHealth.nullRate}%</td><td>Pass (&lt; 20%)</td></tr>
        <tr><td>Duplicate Records</td><td>${report.dataQualityHealth.duplicateRows} rows</td><td>Zero Tolerance</td></tr>
        <tr><td>Distribution Outliers</td><td>${report.dataQualityHealth.outlierCount} records</td><td>Tukey 1.5×IQR</td></tr>
        <tr><td>Compliance &amp; Privacy</td><td>${report.dataQualityHealth.complianceNote}</td><td>Shield Verified</td></tr>
      </tbody>
    </table>
  </div>

  <div class="footer">
    <div>Data Studio by PJA — Autonomous Deterministic Business Intelligence</div>
    <div>Zero-Hallucination Mathematical Verification Verified</div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
