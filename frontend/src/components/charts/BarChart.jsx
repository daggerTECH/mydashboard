import { useEffect, useRef } from 'react';
import { Chart, COLORS, tooltipBase, hexToRgba, compactNumber } from '../../lib/chartTheme.js';
import { fmtMoney, fmtInt, currencySymbol } from '../../lib/format.js';

/**
 * valueType: 'money' (default) formats using the store's real currency —
 * never a hardcoded "$" — or 'count' for plain integers (e.g. order counts).
 * showLabels (default true) prints the formatted value directly on each
 * bar, so the number is readable without cross-referencing a separate
 * table — added after client feedback that the bars alone weren't enough.
 */
export default function BarChart({ labels, data, color = COLORS.mint, horizontal = false, height = 320, currency = 'USD', valueType = 'money', showLabels = true }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  const fmt = (v) => (valueType === 'count' ? fmtInt(v) : fmtMoney(v, currency));
  const axisFmt = (v) => (valueType === 'count' ? fmtInt(v) : fmtMoney(v, currency).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1'));

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current?.destroy();
    chartRef.current = new Chart(canvasRef.current.getContext('2d'), {
      type: 'bar',
      data: { labels, datasets: [{ data, backgroundColor: hexToRgba(color, 0.75), borderRadius: 6, maxBarThickness: 34 }] },
      options: {
        indexAxis: horizontal ? 'y' : 'x',
        responsive: true,
        maintainAspectRatio: false,
        // Headroom so end-of-bar labels never get clipped by the chart edge.
        layout: { padding: horizontal ? { right: 56 } : { top: 28 } },
        plugins: {
          legend: { display: false },
          tooltip: { ...tooltipBase(), callbacks: { label: (item) => ' ' + fmt(item.raw) } },
          datalabels: {
            display: showLabels,
            color: '#F3F5F8',
            font: { weight: '600', size: 12 },
            anchor: 'end',
            align: horizontal ? 'end' : 'end',
            offset: 4,
            clamp: true,
            formatter: (value) => (value ? fmt(value) : ''),
          },
        },
        scales: horizontal
          ? { x: { grid: { color: COLORS.grid }, ticks: { callback: (v) => (valueType === 'count' ? v : currencySymbol(currency) + compactNumber(v)) } }, y: { grid: { display: false } } }
          : { x: { grid: { display: false } }, y: { grid: { color: COLORS.grid }, ticks: { callback: (v) => (valueType === 'count' ? v : currencySymbol(currency) + compactNumber(v)) } } },
      },
    });
    return () => chartRef.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(labels), JSON.stringify(data), color, horizontal, currency, valueType, showLabels]);

  return (
    <div className="chart-wrap" style={{ height }}>
      <canvas ref={canvasRef}></canvas>
    </div>
  );
}
