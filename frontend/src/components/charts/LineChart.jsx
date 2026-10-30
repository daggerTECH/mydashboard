import { useEffect, useRef } from 'react';
import { Chart, COLORS, tooltipBase, hexToRgba, compactNumber } from '../../lib/chartTheme.js';

/**
 * datasets: [{ label, data, color, yAxisID, fill, hidden }]
 */
export default function LineChart({ labels, datasets, height = 320 }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current?.destroy();
    chartRef.current = new Chart(canvasRef.current.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: datasets.map((d) => ({
          label: d.label,
          data: d.data,
          borderColor: d.color,
          backgroundColor: hexToRgba(d.color, 0.12),
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: d.color,
          tension: 0.35,
          fill: d.fill !== false,
          yAxisID: d.yAxisID || 'y',
          hidden: d.hidden || false,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tooltipBase(),
            callbacks: {
              label: (item) => {
                const val = item.dataset.yAxisID === 'y1' ? item.formattedValue : '$' + item.formattedValue;
                return ` ${item.dataset.label}: ${val}`;
              },
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } },
          y: { grid: { color: COLORS.grid }, ticks: { callback: (v) => '$' + compactNumber(v) } },
          y1: { display: false, position: 'right', grid: { display: false } },
        },
      },
    });
    return () => chartRef.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(labels), JSON.stringify(datasets)]);

  return (
    <div className="chart-wrap" style={{ height }}>
      <canvas ref={canvasRef}></canvas>
    </div>
  );
}
