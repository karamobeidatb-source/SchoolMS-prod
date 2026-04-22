import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AppSettingsContext = createContext(null);

const DEFAULTS = {
  theme: 'light',
  accent: 'ink',
  lang: 'en',
  density: 'comfortable',
  role: 'admin', // default to admin since existing app is admin-focused
};

export function AppSettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('schoolos-settings') || '{}');
      return { ...DEFAULTS, ...saved };
    } catch {
      return DEFAULTS;
    }
  });

  // Sync to DOM + localStorage
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = settings.theme;
    root.dataset.accent = settings.accent;
    root.dataset.density = settings.density;
    root.dir = settings.lang === 'ar' ? 'rtl' : 'ltr';
    root.lang = settings.lang;
    localStorage.setItem('schoolos-settings', JSON.stringify(settings));
  }, [settings]);

  const set = useCallback((patch) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  const toggleTheme = useCallback(() => {
    setSettings((s) => ({ ...s, theme: s.theme === 'dark' ? 'light' : 'dark' }));
  }, []);

  const toggleLang = useCallback(() => {
    setSettings((s) => ({ ...s, lang: s.lang === 'ar' ? 'en' : 'ar' }));
  }, []);

  const isRTL = settings.lang === 'ar';
  const isDark = settings.theme === 'dark';
  const isAdmin = settings.role === 'admin';
  const isStudent = settings.role === 'student';

  return (
    <AppSettingsContext.Provider value={{
      ...settings,
      set,
      toggleTheme,
      toggleLang,
      isRTL,
      isDark,
      isAdmin,
      isStudent,
    }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) throw new Error('useAppSettings must be used within AppSettingsProvider');
  return ctx;
}
