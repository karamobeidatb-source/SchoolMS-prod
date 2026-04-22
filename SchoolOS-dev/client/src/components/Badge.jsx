const variants = {
  success: { bg: 'var(--success-subtle)', color: 'var(--success-text)', border: 'var(--success-border)' },
  warning: { bg: 'var(--warning-subtle)', color: 'var(--warning-text)', border: 'var(--warning-border)' },
  danger:  { bg: 'var(--error-subtle)',   color: 'var(--error-text)',   border: 'var(--error-border)' },
  info:    { bg: 'var(--info-subtle)',    color: 'var(--info-text)',    border: 'var(--info-border)' },
  gray:    { bg: 'var(--surface-secondary)', color: 'var(--text-secondary)', border: 'var(--border-default)' },
  purple:  { bg: 'var(--info-subtle)',    color: 'var(--info-text)',    border: 'var(--info-border)' },
  accent:  { bg: 'var(--accent-subtle)',  color: 'var(--accent)',       border: 'var(--accent-subtle)' },
};

export default function Badge({ children, variant = 'gray', className = '' }) {
  const v = variants[variant] || variants.gray;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}
      style={{
        backgroundColor: v.bg,
        color: v.color,
        border: `1px solid ${v.border}`,
      }}
    >
      {children}
    </span>
  );
}
