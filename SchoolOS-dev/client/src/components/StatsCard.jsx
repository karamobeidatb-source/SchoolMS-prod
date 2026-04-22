import { TrendingUp, TrendingDown } from 'lucide-react';

const colorMap = {
  blue:   { bg: 'var(--info-subtle)',    icon: 'var(--info-text)' },
  green:  { bg: 'var(--success-subtle)', icon: 'var(--success-text)' },
  amber:  { bg: 'var(--warning-subtle)', icon: 'var(--warning-text)' },
  red:    { bg: 'var(--error-subtle)',   icon: 'var(--error-text)' },
  purple: { bg: 'var(--info-subtle)',    icon: 'var(--info-text)' },
};

export default function StatsCard({ icon: Icon, label, value, trend, trendLabel, color = 'blue' }) {
  const c = colorMap[color] || colorMap.blue;

  return (
    <div className="card p-6 flex items-start gap-4">
      <div
        className="p-3 rounded-lg"
        style={{ backgroundColor: c.bg, color: c.icon }}
      >
        {Icon && <Icon className="w-6 h-6" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</p>
        <p className="text-2xl font-bold font-heading mt-1" style={{ color: 'var(--text-primary)' }}>{value}</p>
        {trend !== undefined && (
          <div className="flex items-center gap-1 mt-1 text-xs font-medium"
            style={{ color: trend >= 0 ? 'var(--success-text)' : 'var(--error-text)' }}
          >
            {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span>{Math.abs(trend)}%</span>
            {trendLabel && <span style={{ color: 'var(--text-tertiary)' }} className="ml-1">{trendLabel}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
