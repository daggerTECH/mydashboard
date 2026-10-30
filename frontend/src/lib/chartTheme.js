import { Chart } from 'chart.js/auto';

export const COLORS = {
  mint: '#33D6A6',
  blue: '#26ACE2',
  red: '#F2667A',
  amber: '#E8B14F',
  grid: 'rgba(255,255,255,0.06)',
  text: '#9AA3B5',
};
export const PALETTE = [COLORS.mint, COLORS.blue, COLORS.amber, COLORS.red, '#A78BFA', '#4FD1C5'];

Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.color = COLORS.text;

export function tooltipBase() {
  return {
    backgroundColor: '#1A2029',
    borderColor: '#2A3240',
    borderWidth: 1,
    padding: 10,
    titleColor: '#F3F5F8',
    bodyColor: '#C4CBDB',
    titleFont: { weight: '600' },
    displayColors: true,
    boxPadding: 4,
  };
}

export function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function compactNumber(n) {
  if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + 'k';
  return Math.round(n);
}

export { Chart };
