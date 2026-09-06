import React, { useEffect, useRef } from 'react';
import Plotly from 'plotly.js-dist-min';

// Global resilience patch: prevent internal Plotly auto-margin redraws from accessing undefined _fullLayout
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (event?.message && event.message.includes('_redrawFromAutoMarginCount')) {
      event.preventDefault();
      event.stopPropagation();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reasonMsg = event?.reason?.message || String(event?.reason || '');
    if (reasonMsg.includes('_redrawFromAutoMarginCount')) {
      event.preventDefault();
      event.stopPropagation();
    }
  });
}

// Intercept Plotly.purge to ensure the detached element retains a safe layout stub
if (typeof Plotly !== 'undefined' && Plotly.purge && !(Plotly as any).__patchedPurge) {
  const originalPurge = Plotly.purge;
  Plotly.purge = function (el: any) {
    if (!el) return;
    try {
      originalPurge.call(Plotly, el);
    } catch {
      // Ignore internal Plotly teardown errors on detached elements
    } finally {
      if (el) {
        try {
          // Provide safe layout stub so in-flight microtasks/callbacks (e.g. iA, N0t)
          // accessing _redrawFromAutoMarginCount evaluate cleanly without throwing
          el._fullLayout = {
            _redrawFromAutoMarginCount: 0,
            _visibleModules: [],
            _replotting: true,
            automargin: false,
          };
        } catch {
          // Ignore
        }
      }
    }
  };
  (Plotly as any).__patchedPurge = true;
}

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
  const isMountedRef = useRef(true);
  const rafResizeRef = useRef<number | null>(null);
  const chartIdRef = useRef<string>(`chart-${Math.random().toString(36).substring(2, 11)}`);

  // Setup ResizeObserver and handle teardown ONLY on unmount
  useEffect(() => {
    isMountedRef.current = true;
    const el = containerRef.current;
    if (!el) return;

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        if (!isMountedRef.current || !el || !(el as any)._fullLayout || !document.body.contains(el)) {
          return;
        }

        if (rafResizeRef.current) {
          cancelAnimationFrame(rafResizeRef.current);
        }

        rafResizeRef.current = requestAnimationFrame(() => {
          if (isMountedRef.current && el && (el as any)._fullLayout && document.body.contains(el)) {
            try {
              Plotly.Plots.resize(el);
            } catch {
              // Ignore resize errors during fast transitions
            }
          }
        });
      });
      resizeObserver.observe(el);
    }

    return () => {
      isMountedRef.current = false;
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (rafResizeRef.current) {
        cancelAnimationFrame(rafResizeRef.current);
      }
      if (el) {
        try {
          Plotly.purge(el);
        } catch {
          // Ignore purge errors
        }
        // Guarantee safe layout stub after unmount
        (el as any)._fullLayout = {
          _redrawFromAutoMarginCount: 0,
          _visibleModules: [],
          _replotting: true,
          automargin: false,
        };
      }
    };
  }, []);

  // Update chart data/layout without purging the DOM element on every prop change
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !isMountedRef.current) return;
    if (!figure || !figure.data || !Array.isArray(figure.data) || figure.data.length === 0) {
      return;
    }

    const layout = {
      autosize: true,
      font: {
        family: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
        size: 11,
        color: '#94a3b8',
        ...(figure.layout?.font || {}),
      },
      colorway: [
        '#3b82f6', // Royal Blue
        '#10b981', // Emerald
        '#f59e0b', // Amber
        '#8b5cf6', // Violet
        '#ec4899', // Pink
        '#06b6d4', // Cyan
        '#f97316', // Orange
        '#6366f1', // Indigo
      ],
      hoverlabel: {
        bgcolor: '#0f172a',
        bordercolor: '#334155',
        font: {
          family: "'Plus Jakarta Sans', sans-serif",
          size: 12,
          color: '#f8fafc',
        },
        ...(figure.layout?.hoverlabel || {}),
      },
      margin: {
        l: 50,
        r: 30,
        t: 40,
        b: 50,
        pad: 4,
        ...(figure.layout?.margin || {}),
      },
      paper_bgcolor: figure.layout?.paper_bgcolor || 'transparent',
      plot_bgcolor: figure.layout?.plot_bgcolor || 'transparent',
      ...figure.layout,
    };

    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d'],
      toImageButtonOptions: {
        format: 'png',
        filename: 'data_studio_chart',
        height: 600,
        width: 1000,
        scale: 2,
      },
      ...figure.config,
    };

    // Plotly.react safely reconciles existing plots in-place
    Plotly.react(el, figure.data, layout, config).catch(() => {
      // Safely ignore cancelled / detached rendering promises
    });
  }, [figure]);

  return <div ref={containerRef} className={className} id={chartIdRef.current} />;
};

