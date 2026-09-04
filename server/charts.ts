export interface PlotlyFigure {
  data: any[];
  layout: Record<string, any>;
  config: Record<string, any>;
}

const PALETTE = ['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4', '#E11D48', '#14B8A6', '#6366F1', '#D97706'];

// Generate dark-mode, high-polish Plotly figure
export function generatePlotlyFigure(
  type: 'bar' | 'line' | 'scatter' | 'histogram' | 'box' | 'pie' | 'heatmap' | 'combo' | 'treemap' | 'sunburst',
  dataPayload: any,
  title: string,
  options?: { isCurrency?: boolean; isPercent?: boolean }
): PlotlyFigure {
  const commonLayout = {
    title: {
      text: title,
      font: { family: 'Plus Jakarta Sans, sans-serif', size: 14, color: '#F3F4F6' },
      x: 0.02,
      y: 0.95,
    },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { family: 'Plus Jakarta Sans, sans-serif', color: '#9CA3AF', size: 12 },
    margin: { l: 60, r: 45, t: 50, b: 60 },
    autosize: true,
    hoverlabel: {
      bgcolor: '#1F2937',
      bordercolor: '#374151',
      font: { family: 'Plus Jakarta Sans, sans-serif', color: '#F9FAFB', size: 12 },
    },
    xaxis: {
      gridcolor: '#1F2937',
      zerolinecolor: '#374151',
      tickfont: { color: '#9CA3AF' },
      automargin: true,
    },
    yaxis: {
      gridcolor: '#1F2937',
      zerolinecolor: '#374151',
      tickfont: { color: '#9CA3AF' },
      automargin: true,
    },
    legend: {
      font: { color: '#D1D5DB' },
      orientation: 'h',
      yanchor: 'bottom',
      y: 1.02,
      xanchor: 'right',
      x: 1,
    },
  };

  const commonConfig = {
    responsive: true,
    displayModeBar: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['lasso2d', 'select2d'],
    toImageButtonOptions: {
      format: 'png',
      filename: 'chart_export',
      height: 600,
      width: 1000,
      scale: 2,
    },
  };

  // If payload contains pre-grouped traces (Color Dimension)
  if (dataPayload.groupedTraces && Array.isArray(dataPayload.groupedTraces) && dataPayload.groupedTraces.length > 0) {
    const traces = dataPayload.groupedTraces.map((g: any, idx: number) => {
      const color = PALETTE[idx % PALETTE.length];
      if (type === 'line') {
        return {
          name: g.name,
          x: g.x,
          y: g.y,
          type: 'scatter',
          mode: 'lines+markers',
          line: { color, width: 2.5, shape: 'spline' },
          marker: { color, size: 5 },
          hovertemplate: `<b>${g.name}</b><br>%{x}: %{y:,.2f}<extra></extra>`,
        };
      } else if (type === 'scatter') {
        return {
          name: g.name,
          x: g.x,
          y: g.y,
          type: 'scatter',
          mode: 'markers',
          marker: { color, size: 7, opacity: 0.8 },
          hovertemplate: `<b>${g.name}</b><br>%{x}: %{y:,.2f}<extra></extra>`,
        };
      } else {
        return {
          name: g.name,
          x: g.x,
          y: g.y,
          type: 'bar',
          marker: { color },
          hovertemplate: `<b>${g.name}</b><br>%{x}: %{y:,.2f}<extra></extra>`,
        };
      }
    });

    return {
      data: traces,
      layout: {
        ...commonLayout,
        barmode: 'group',
        xaxis: { ...commonLayout.xaxis, title: { text: dataPayload.xAxis || 'Category', font: { color: '#9CA3AF' } } },
        yaxis: { ...commonLayout.yaxis, title: { text: dataPayload.yAxis || 'Metric', font: { color: '#9CA3AF' } } },
      },
      config: commonConfig,
    };
  }

  // 1. COMBO DUAL-AXIS CHART (Bar on Y1 + Line on Y2)
  if (type === 'combo') {
    const items = dataPayload.items || [];
    const categories = items.map((i: any) => i.category);
    const primaryVals = items.map((i: any) => i.value ?? i.primaryValue ?? 0);
    const secondaryVals = items.map((i: any) => i.secondaryValue ?? 0);

    const primaryMetric = dataPayload.primaryMetric || dataPayload.metricColumn || 'Primary Metric';
    const secondaryMetric = dataPayload.secondaryMetric || 'Secondary Metric';

    return {
      data: [
        {
          name: primaryMetric,
          x: categories,
          y: primaryVals,
          type: 'bar',
          marker: {
            color: '#3B82F6',
            line: { color: '#60A5FA', width: 1 },
          },
          hovertemplate: `<b>%{x}</b><br>${primaryMetric}: %{y:,.2f}<extra></extra>`,
        },
        {
          name: secondaryMetric,
          x: categories,
          y: secondaryVals,
          yaxis: 'y2',
          type: 'scatter',
          mode: 'lines+markers',
          line: { color: '#10B981', width: 3, shape: 'spline' },
          marker: { color: '#10B981', size: 7, symbol: 'circle', line: { color: '#064E3B', width: 1 } },
          hovertemplate: `<b>%{x}</b><br>${secondaryMetric}: %{y:,.2f}<extra></extra>`,
        },
      ],
      layout: {
        ...commonLayout,
        xaxis: { ...commonLayout.xaxis, title: { text: dataPayload.groupColumn || 'Dimension', font: { color: '#9CA3AF' } } },
        yaxis: {
          ...commonLayout.yaxis,
          title: { text: primaryMetric, font: { color: '#3B82F6' } },
          tickfont: { color: '#3B82F6' },
        },
        yaxis2: {
          title: { text: secondaryMetric, font: { color: '#10B981' } },
          overlaying: 'y',
          side: 'right',
          showgrid: false,
          zeroline: false,
          tickfont: { color: '#10B981' },
          automargin: true,
        },
      },
      config: commonConfig,
    };
  }

  // 2. TREEMAP
  if (type === 'treemap') {
    const labels = dataPayload.labels || (dataPayload.items ? dataPayload.items.map((i: any) => i.category) : []);
    const parents = dataPayload.parents || (dataPayload.items ? dataPayload.items.map((i: any) => i.parent || '') : labels.map(() => ''));
    const values = dataPayload.values || (dataPayload.items ? dataPayload.items.map((i: any) => i.value) : []);

    return {
      data: [
        {
          type: 'treemap',
          labels,
          parents,
          values,
          textinfo: 'label+value+percent parent',
          hoverinfo: 'label+value+percent parent',
          marker: {
            colorscale: 'Blues',
            line: { width: 1, color: '#1E293B' },
          },
        },
      ],
      layout: {
        ...commonLayout,
        margin: { l: 10, r: 10, t: 40, b: 10 },
      },
      config: commonConfig,
    };
  }

  // 3. SUNBURST
  if (type === 'sunburst') {
    const labels = dataPayload.labels || (dataPayload.items ? dataPayload.items.map((i: any) => i.category) : []);
    const parents = dataPayload.parents || (dataPayload.items ? dataPayload.items.map((i: any) => i.parent || '') : labels.map(() => ''));
    const values = dataPayload.values || (dataPayload.items ? dataPayload.items.map((i: any) => i.value) : []);

    return {
      data: [
        {
          type: 'sunburst',
          labels,
          parents,
          values,
          branchvalues: 'total',
          hoverinfo: 'label+value+percent entry',
          marker: {
            colorscale: 'Viridis',
            line: { width: 1, color: '#0F172A' },
          },
        },
      ],
      layout: {
        ...commonLayout,
        margin: { l: 10, r: 10, t: 40, b: 10 },
      },
      config: commonConfig,
    };
  }

  // 4. BAR CHART
  if (type === 'bar') {
    const items = dataPayload.items || [];
    const categories = items.map((i: any) => i.category);
    const values = items.map((i: any) => i.value);

    return {
      data: [
        {
          x: categories,
          y: values,
          type: 'bar',
          marker: {
            color: '#3B82F6',
            line: { color: '#60A5FA', width: 1 },
          },
          hovertemplate: `<b>%{x}</b><br>Value: %{y:,.2f}<extra></extra>`,
        },
      ],
      layout: {
        ...commonLayout,
        xaxis: { ...commonLayout.xaxis, title: { text: dataPayload.groupColumn, font: { color: '#9CA3AF' } } },
        yaxis: { ...commonLayout.yaxis, title: { text: dataPayload.metricColumn, font: { color: '#9CA3AF' } } },
      },
      config: commonConfig,
    };
  }

  // 5. LINE CHART
  if (type === 'line') {
    const periods = dataPayload.periods || [];
    const xVals = periods.map((p: any) => p.period);
    const yVals = periods.map((p: any) => p.value);

    return {
      data: [
        {
          x: xVals,
          y: yVals,
          type: 'scatter',
          mode: 'lines+markers',
          line: { color: '#10B981', width: 2.5, shape: 'spline' },
          marker: { color: '#10B981', size: 6, line: { color: '#064E3B', width: 1 } },
          hovertemplate: `<b>%{x}</b><br>Metric: %{y:,.2f}<extra></extra>`,
        },
      ],
      layout: {
        ...commonLayout,
        xaxis: { ...commonLayout.xaxis, title: { text: dataPayload.dateColumn || 'Period' } },
        yaxis: { ...commonLayout.yaxis, title: { text: dataPayload.metricColumn || 'Value' } },
      },
      config: commonConfig,
    };
  }

  // 6. SCATTER PLOT
  if (type === 'scatter') {
    const pairs = dataPayload.pairsSample || [];
    const xVals = pairs.map((p: any) => p[0]);
    const yVals = pairs.map((p: any) => p[1]);

    return {
      data: [
        {
          x: xVals,
          y: yVals,
          type: 'scatter',
          mode: 'markers',
          marker: {
            color: '#8B5CF6',
            size: 7,
            opacity: 0.75,
            line: { color: '#C4B5FD', width: 1 },
          },
          hovertemplate: `${dataPayload.column1 || 'X'}: %{x:,.2f}<br>${dataPayload.column2 || 'Y'}: %{y:,.2f}<extra></extra>`,
        },
      ],
      layout: {
        ...commonLayout,
        xaxis: { ...commonLayout.xaxis, title: { text: dataPayload.column1 } },
        yaxis: { ...commonLayout.yaxis, title: { text: dataPayload.column2 } },
      },
      config: commonConfig,
    };
  }

  // 7. PIE / DONUT CHART
  if (type === 'pie') {
    const items = dataPayload.items || [];
    const labels = items.map((i: any) => i.category);
    const values = items.map((i: any) => i.value);

    return {
      data: [
        {
          labels,
          values,
          type: 'pie',
          hole: 0.45,
          marker: {
            colors: ['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4', '#E11D48', '#14B8A6'],
            line: { color: '#111827', width: 1.5 },
          },
          textinfo: 'label+percent',
          hoverinfo: 'label+value+percent',
        },
      ],
      layout: {
        ...commonLayout,
        showlegend: true,
      },
      config: commonConfig,
    };
  }

  // 8. BOX PLOT
  if (type === 'box') {
    return {
      data: [
        {
          y: dataPayload.samples || [],
          type: 'box',
          name: dataPayload.metric || 'Distribution',
          boxpoints: 'outliers',
          marker: { color: '#F59E0B' },
          line: { color: '#FBBF24', width: 1.5 },
        },
      ],
      layout: {
        ...commonLayout,
        yaxis: { ...commonLayout.yaxis, title: { text: dataPayload.metric || 'Values' } },
      },
      config: commonConfig,
    };
  }

  // 9. HISTOGRAM
  if (type === 'histogram') {
    return {
      data: [
        {
          x: dataPayload.samples || [],
          type: 'histogram',
          marker: {
            color: '#6366F1',
            line: { color: '#818CF8', width: 1 },
          },
          hovertemplate: `Range: %{x}<br>Count: %{y}<extra></extra>`,
        },
      ],
      layout: {
        ...commonLayout,
        xaxis: { ...commonLayout.xaxis, title: { text: dataPayload.metric || 'Values' } },
        yaxis: { ...commonLayout.yaxis, title: { text: 'Frequency / Count' } },
      },
      config: commonConfig,
    };
  }

  // 10. HEATMAP (Correlation or 2D Matrix)
  if (type === 'heatmap') {
    const cols = dataPayload.columns || [];
    const matrix = dataPayload.matrix || [];

    return {
      data: [
        {
          type: 'heatmap',
          x: cols,
          y: cols,
          z: matrix,
          colorscale: [
            [0, '#EF4444'],
            [0.5, '#1E293B'],
            [1, '#3B82F6'],
          ],
          zmin: -1,
          zmax: 1,
          showscale: true,
          colorbar: {
            title: { text: 'Correlation', font: { color: '#9CA3AF', size: 11 } },
            tickfont: { color: '#9CA3AF' },
          },
          hovertemplate: '<b>%{y}</b> vs <b>%{x}</b><br>Correlation: %{z:.3f}<extra></extra>',
        },
      ],
      layout: {
        ...commonLayout,
        xaxis: { ...commonLayout.xaxis, tickangle: -45, automargin: true },
        yaxis: { ...commonLayout.yaxis, automargin: true },
      },
      config: commonConfig,
    };
  }

  // Fallback / default
  return {
    data: [],
    layout: commonLayout,
    config: commonConfig,
  };
}
