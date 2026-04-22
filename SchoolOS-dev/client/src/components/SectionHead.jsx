export default function SectionHead({ title, sub, actions }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
      marginBottom: 28, gap: 24,
    }}>
      <div>
        <h1 style={{
          fontFamily: 'var(--f-display)', fontSize: 38, fontWeight: 400,
          lineHeight: 1.05, letterSpacing: '-0.02em', margin: 0,
        }}>{title}</h1>
        {sub && <div style={{ color: 'var(--ink-3)', marginTop: 6, fontSize: '13.5px' }}>{sub}</div>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
    </div>
  );
}
