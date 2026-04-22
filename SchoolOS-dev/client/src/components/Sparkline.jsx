export default function Sparkline({ data, width = 80, height = 24, color }) {
  if (!data || !data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => `${i * step},${height - ((v - min) / range) * height}`).join(' ');
  const last = data[data.length - 1];
  const lastX = (data.length - 1) * step;
  const lastY = height - ((last - min) / range) * height;

  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      <polyline
        points={pts}
        fill="none"
        stroke={color || 'currentColor'}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastX} cy={lastY} r="2.5" fill={color || 'currentColor'} />
    </svg>
  );
}
