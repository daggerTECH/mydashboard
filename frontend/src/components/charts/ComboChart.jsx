import { useEffect, useRef } from 'react';
import { Chart, COLORS, tooltipBase, hexToRgba, compactNumber } from '../../lib/chartTheme.js';

/**
 * Two bar series (left $ axis) plus one line series (right % axis, e.g. ACOS).
 * barDatasets: [{ label, data, color }]
 * lineDataset: { label, data, color } — values are fractions (0.25 = 25%), null-safe
 */
export default function ComboChart({ labels, barDatasets, lineDataset, height = 320 }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current?.destroy();
    chartRef.current = new Chart(canvasRef.current.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          ...barDatasets.map((d) => ({
            type: 'bar',
            label: d.label,
            data: d.data,
            backgroundColor: hexToRgba(d.color, 0.75),
            borderRadius: 4,
            maxBarThickness: 22,
            yAxisID: 'y',
          })),
          {
            type: 'line',
            label: lineDataset.label,
            data: lineDataset.data,
            borderColor: lineDataset.color,
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 2,
            pointHoverRadius: 4,
            pointBackgroundColor: lineDataset.color,
            tension: 0.3,
            yAxisID: 'y1',
            spanGaps: true, // null points (zero-revenue days) don't break the line
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, padding: 14, color: COLORS.text } },
          tooltip: {
            ...tooltipBase(),
            callbacks: {
              label: (item) => {
                if (item.dataset.yAxisID === 'y1') {
                  return item.raw == null ? ` ${item.dataset.label}: —` : ` ${item.dataset.label}: ${(item.raw * 100).toFixed(1)}%`;
                }
                return ` ${item.dataset.label}: $${item.formattedValue}`;
              },
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } },
          y: { position: 'left', grid: { color: COLORS.grid }, ticks: { callback: (v) => '$' + compactNumber(v) } },
          y1: {
            position: 'right',
            grid: { display: false },
            ticks: { callback: (v) => (v * 100).toFixed(0) + '%' },
          },
        },
      },
    });
    return () => chartRef.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(labels), JSON.stringify(barDatasets), JSON.stringify(lineDataset)]);

  return (
    <div className="chart-wrap" style={{ height }}>
      <canvas ref={canvasRef}></canvas>
    </div>
  );
}
