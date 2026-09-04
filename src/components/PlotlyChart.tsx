import React, { useEffect, useRef } from 'react';
import Plotly from 'plotly.js-dist-min';

interface PlotlyChartProps {
  figure: {
    data: any[];
    layout: any;
    config?: any;
  };
  className?: string;
}

export const PlotlyChart: React.FC<PlotlyChartProps> = ({ figure, className = 'w-full h-80' }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !figure || !figure.data) return;

    const el = containerRef.current;
    const layout = {
      ...figure.layout,
      autosize: true,
    };

    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d'],
      toImageButtonOptions: {
        format: 'png',
        filename: 'data_analyst_agent_chart',
        height: 600,
        width: 1000,
        scale: 2,
      },
      ...figure.config,
    };

    Plotly.react(el, figure.data, layout, config);

    const handleResize = () => {
      Plotly.Plots.resize(el);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      Plotly.purge(el);
    };
  }, [figure]);

  return <div ref={containerRef} className={className} id={`chart-${Math.random().toString(36).substr(2, 9)}`} />;
};
