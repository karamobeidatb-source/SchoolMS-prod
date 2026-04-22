export default function Donut({ pct, size = 56, stroke = 5, color = 'var(--accent)' }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;

  return (
    <svg width={size} height={size}>
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="var(--line)" strokeWidth={stroke}
      />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={off}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        strokeLinecap="round"
      />
    </svg>
  );
}
