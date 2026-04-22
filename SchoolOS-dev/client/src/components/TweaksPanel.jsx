import { useAppSettings } from '../contexts/AppSettingsContext';
import { useTranslation } from '../i18n';
import { X } from 'lucide-react';

export default function TweaksPanel({ onClose }) {
  const settings = useAppSettings();
  const t = useTranslation(settings.lang);

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      insetInlineEnd: 20,
      width: 280,
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: '0 12px 40px -10px color-mix(in oklab, var(--ink) 20%, transparent)',
      zIndex: 50,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--line-soft)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <h4 style={{ margin: 0, fontFamily: 'var(--f-display)', fontSize: 15, fontWeight: 500 }}>{t.tweaks}</h4>
        <button className="icon-btn" onClick={onClose}><X size={14} /></button>
      </div>

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Accent */}
        <div>
          <div className="label" style={{ fontSize: '9.5px', marginBottom: 6 }}>{t.accentLabel}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { id: 'ink', color: 'oklch(0.45 0.14 260)' },
              { id: 'terracotta', color: 'oklch(0.55 0.14 40)' },
              { id: 'sage', color: 'oklch(0.50 0.09 155)' },
            ].map((sw) => (
              <button
                key={sw.id}
                onClick={() => settings.set({ accent: sw.id })}
                style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: sw.color,
                  border: settings.accent === sw.id ? '2px solid var(--ink)' : '2px solid transparent',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
        </div>

        {/* Theme */}
        <div>
          <div className="label" style={{ fontSize: '9.5px', marginBottom: 6 }}>{t.themeLabel}</div>
          <div style={{ display: 'flex', border: '1px solid var(--line)', borderRadius: 5, overflow: 'hidden' }}>
            <button
              onClick={() => settings.set({ theme: 'light' })}
              style={{
                flex: 1, padding: '6px 8px',
                fontFamily: 'var(--f-mono)', fontSize: '10.5px', letterSpacing: '0.06em', textTransform: 'uppercase',
                background: settings.theme === 'light' ? 'var(--ink)' : 'var(--surface)',
                color: settings.theme === 'light' ? 'var(--bg)' : 'var(--ink-3)',
              }}
            >{t.light}</button>
            <button
              onClick={() => settings.set({ theme: 'dark' })}
              style={{
                flex: 1, padding: '6px 8px',
                fontFamily: 'var(--f-mono)', fontSize: '10.5px', letterSpacing: '0.06em', textTransform: 'uppercase',
                background: settings.theme === 'dark' ? 'var(--ink)' : 'var(--surface)',
                color: settings.theme === 'dark' ? 'var(--bg)' : 'var(--ink-3)',
              }}
            >{t.dark}</button>
          </div>
        </div>

        {/* Language */}
        <div>
          <div className="label" style={{ fontSize: '9.5px', marginBottom: 6 }}>{t.languageLabel}</div>
          <div style={{ display: 'flex', border: '1px solid var(--line)', borderRadius: 5, overflow: 'hidden' }}>
            <button
              onClick={() => settings.set({ lang: 'en' })}
              style={{
                flex: 1, padding: '6px 8px',
                fontFamily: 'var(--f-mono)', fontSize: '10.5px', letterSpacing: '0.06em',
                background: settings.lang === 'en' ? 'var(--ink)' : 'var(--surface)',
                color: settings.lang === 'en' ? 'var(--bg)' : 'var(--ink-3)',
              }}
            >EN</button>
            <button
              onClick={() => settings.set({ lang: 'ar' })}
              style={{
                flex: 1, padding: '6px 8px',
                fontFamily: 'var(--f-mono)', fontSize: '10.5px', letterSpacing: '0.06em',
                background: settings.lang === 'ar' ? 'var(--ink)' : 'var(--surface)',
                color: settings.lang === 'ar' ? 'var(--bg)' : 'var(--ink-3)',
              }}
            >AR</button>
          </div>
        </div>

        {/* Density */}
        <div>
          <div className="label" style={{ fontSize: '9.5px', marginBottom: 6 }}>{t.densityLabel}</div>
          <div style={{ display: 'flex', border: '1px solid var(--line)', borderRadius: 5, overflow: 'hidden' }}>
            <button
              onClick={() => settings.set({ density: 'comfortable' })}
              style={{
                flex: 1, padding: '6px 8px',
                fontFamily: 'var(--f-mono)', fontSize: '10.5px', letterSpacing: '0.06em', textTransform: 'uppercase',
                background: settings.density === 'comfortable' ? 'var(--ink)' : 'var(--surface)',
                color: settings.density === 'comfortable' ? 'var(--bg)' : 'var(--ink-3)',
              }}
            >{t.comfortable}</button>
            <button
              onClick={() => settings.set({ density: 'compact' })}
              style={{
                flex: 1, padding: '6px 8px',
                fontFamily: 'var(--f-mono)', fontSize: '10.5px', letterSpacing: '0.06em', textTransform: 'uppercase',
                background: settings.density === 'compact' ? 'var(--ink)' : 'var(--surface)',
                color: settings.density === 'compact' ? 'var(--bg)' : 'var(--ink-3)',
              }}
            >{t.compact}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
