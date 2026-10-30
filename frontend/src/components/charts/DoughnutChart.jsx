import { useEffect, useRef } from 'react';
import { Chart, PALETTE, tooltipBase, COLORS } from '../../lib/chartTheme.js';

export default function DoughnutChart({ labels, data, height = 260 }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current?.destroy();
    chartRef.current = new Chart(canvasRef.current.getContext('2d'), {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: PALETTE, borderColor: '#141922', borderWidth: 3 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, padding: 14, color: COLORS.text } },
          tooltip: tooltipBase(),
        },
      },
    });
    return () => chartRef.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(labels), JSON.stringify(data)]);

  return (
    <div className="chart-wrap is-compact" style={{ height }}>
      <canvas ref={canvasRef}></canvas>
    </div>
  );
}
