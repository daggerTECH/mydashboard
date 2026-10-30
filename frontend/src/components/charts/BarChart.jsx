import { useEffect, useRef } from 'react';
import { Chart, COLORS, tooltipBase, hexToRgba, compactNumber } from '../../lib/chartTheme.js';

export default function BarChart({ labels, data, color = COLORS.mint, horizontal = false, height = 320 }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

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
        plugins: { legend: { display: false }, tooltip: { ...tooltipBase(), callbacks: { label: (item) => ' $' + item.formattedValue } } },
        scales: horizontal
          ? { x: { grid: { color: COLORS.grid }, ticks: { callback: (v) => '$' + compactNumber(v) } }, y: { grid: { display: false } } }
          : { x: { grid: { display: false } }, y: { grid: { color: COLORS.grid }, ticks: { callback: (v) => '$' + compactNumber(v) } } },
      },
    });
    return () => chartRef.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(labels), JSON.stringify(data), color, horizontal]);

  return (
    <div className="chart-wrap" style={{ height }}>
      <canvas ref={canvasRef}></canvas>
    </div>
  );
}
