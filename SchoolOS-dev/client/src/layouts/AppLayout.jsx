import { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { useTranslation } from '../i18n';
import TweaksPanel from '../components/TweaksPanel';
import api from '../utils/api';
import {
  LayoutDashboard, Users, ClipboardCheck, BookOpen, Calendar,
  FileText, MessageSquare, Bus, CalendarDays, Trophy,
  HeartPulse, Briefcase, CalendarOff, BarChart3, Settings,
  Bell, LogOut, Search, Moon, Sun, ChevronRight,
} from 'lucide-react';

const STUDENT_NAV = [
  { group: 'learning', items: [
    { id: 'dashboard', path: '/dashboard', icon: LayoutDashboard, label: 'dashboard' },
    { id: 'timetable', path: '/timetable', icon: Calendar, label: 'timetable' },
    { id: 'gradebook', path: '/gradebook', icon: BookOpen, label: 'gradebook' },
    { id: 'assignments', path: '/assignments', icon: FileText, label: 'assignments', badge: 4 },
    { id: 'attendance', path: '/attendance', icon: ClipboardCheck, label: 'attendance' },
  ]},
  { group: 'life', items: [
    { id: 'classmates', path: '/students', icon: Users, label: 'classmates' },
    { id: 'messages', path: '/messages', icon: MessageSquare, label: 'messages', badge: 2 },
    { id: 'transportation', path: '/transport', icon: Bus, label: 'transportation' },
  ]},
];

const ADMIN_NAV = [
  { group: 'academic', items: [
    { id: 'dashboard', path: '/dashboard', icon: LayoutDashboard, label: 'dashboard' },
    { id: 'students', path: '/students', icon: Users, label: 'students' },
    { id: 'attendance', path: '/attendance', icon: ClipboardCheck, label: 'attendance' },
    { id: 'gradebook', path: '/gradebook', icon: BookOpen, label: 'gradebook' },
    { id: 'timetable', path: '/timetable', icon: Calendar, label: 'timetable' },
    { id: 'assignments', path: '/assignments', icon: FileText, label: 'assignments' },
  ]},
  { group: 'life', items: [
    { id: 'events', path: '/events', icon: CalendarDays, label: 'events' },
    { id: 'clubs', path: '/clubs', icon: Trophy, label: 'clubs' },
    { id: 'nurse', path: '/nurse', icon: HeartPulse, label: 'nurse' },
    { id: 'transportation', path: '/transport', icon: Bus, label: 'transportation' },
    { id: 'messages', path: '/messages', icon: MessageSquare, label: 'messages' },
  ]},
  { group: 'operations', items: [
    { id: 'staff', path: '/staff', icon: Briefcase, label: 'staff' },
    { id: 'leave', path: '/leave', icon: CalendarOff, label: 'leave', badge: 2 },
    { id: 'reports', path: '/reports', icon: BarChart3, label: 'reports' },
    { id: 'settings', path: '/settings', icon: Settings, label: 'settings' },
  ]},
];

export default function AppLayout() {
  const { user, logout, hasPermission, activeSchool, isSuperAdmin, selectSchool } = useAuth();
  const settings = useAppSettings();
  const t = useTranslation(settings.lang);
  const navigate = useNavigate();
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [academicYear, setAcademicYear] = useState('');

  useEffect(() => {
    if (!activeSchool) { setAcademicYear(''); return; }
    api.get('/settings').then((res) => {
      setAcademicYear(res.data.academic_year || '');
    }).catch(() => setAcademicYear(''));
  }, [activeSchool]);

  const handleLogout = () => { logout(); navigate('/login'); };
  const exitSchool = async () => {
    try { await selectSchool(null); navigate('/schools'); } catch {}
  };

  const NAV = settings.isAdmin ? ADMIN_NAV : STUDENT_NAV;

  const canSee = (perm) => {
    if (!perm) return true;
    if (Array.isArray(perm)) return perm.some((p) => hasPermission(p));
    return hasPermission(perm);
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `${settings.isRTL ? '' : ''}var(--sidebar-w) 1fr`,
      minHeight: '100vh',
      direction: settings.isRTL ? 'rtl' : 'ltr',
    }}>
      {/* ── Sidebar ── */}
      <aside style={{
        background: 'var(--surface)',
        borderInlineEnd: '1px solid var(--line)',
        padding: '20px 0',
        position: 'sticky',
        top: 0,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}>
        {/* Brand */}
        <div style={{ padding: '0 20px 20px', borderBottom: '1px solid var(--line-soft)', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 6,
              background: 'var(--ink)', color: 'var(--bg)',
              display: 'grid', placeItems: 'center',
              fontFamily: 'var(--f-display)', fontWeight: 500, fontSize: 16,
              letterSpacing: '-0.02em',
            }}>s</div>
            <div>
              <div style={{ fontFamily: 'var(--f-display)', fontSize: 17, fontWeight: 500 }}>schola</div>
              <div className="label" style={{ marginTop: 2 }}>
                {settings.isAdmin
                  ? (settings.lang === 'ar' ? 'لوحة الإدارة' : 'admin console')
                  : (settings.lang === 'ar' ? 'بوابة الطالب' : 'student portal')}
              </div>
            </div>
          </div>
          {settings.isAdmin && (
            <div style={{
              marginTop: 10, padding: '6px 10px',
              background: 'var(--accent-soft)', color: 'var(--accent)',
              borderRadius: 4, fontFamily: 'var(--f-mono)', fontSize: 10,
              letterSpacing: '0.12em', fontWeight: 600,
            }}>
              {t.admin}
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ padding: '0 10px', display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
          {NAV.map((group) => (
            <div key={group.group}>
              <div style={{
                padding: '14px 12px 6px',
                fontFamily: 'var(--f-mono)', fontSize: '9.5px',
                letterSpacing: '0.16em', textTransform: 'uppercase',
                color: 'var(--ink-4)',
              }}>
                {t[group.group]}
              </div>
              {group.items.map((item) => (
                <NavLink
                  key={item.id}
                  to={item.path}
                  style={({ isActive }) => ({
                    display: 'flex', alignItems: 'center', gap: 11,
                    padding: '9px 12px', borderRadius: 5,
                    fontSize: '13.5px', position: 'relative',
                    transition: 'background 0.12s, color 0.12s',
                    userSelect: 'none', textDecoration: 'none',
                    background: isActive ? 'var(--accent-soft)' : undefined,
                    color: isActive ? 'var(--accent)' : 'var(--ink-2)',
                    fontWeight: isActive ? 500 : 400,
                  })}
                  className={({ isActive }) => isActive ? 'nav-active' : ''}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span style={{
                          position: 'absolute',
                          insetInlineStart: -10, top: 8, bottom: 8,
                          width: 2, background: 'var(--accent)', borderRadius: 2,
                        }} />
                      )}
                      <item.icon size={16} style={{ opacity: 0.85, flexShrink: 0 }} />
                      <span>{t[item.label]}</span>
                      {item.badge && (
                        <span style={{
                          marginInlineStart: 'auto',
                          fontFamily: 'var(--f-mono)', fontSize: 10,
                          background: isActive ? 'var(--accent)' : 'var(--ink)',
                          color: isActive ? 'white' : 'var(--bg)',
                          padding: '1px 6px', borderRadius: 999,
                          letterSpacing: '0.02em',
                        }}>{item.badge}</span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div style={{
          marginTop: 'auto', padding: '16px 18px',
          borderTop: '1px solid var(--line-soft)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div className="avatar">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div style={{ fontSize: '12.5px', lineHeight: 1.3 }}>
            <b style={{ display: 'block', fontWeight: 600, color: 'var(--ink)' }}>{user?.name || 'User'}</b>
            <span style={{
              color: 'var(--ink-3)', fontFamily: 'var(--f-mono)', fontSize: 10,
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>{user?.role || 'Staff'}</span>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Topbar */}
        <header style={{
          display: 'flex', alignItems: 'center',
          padding: '16px 32px', gap: 24,
          borderBottom: '1px solid var(--line)',
          background: 'var(--bg)',
          position: 'sticky', top: 0, zIndex: 5,
        }}>
          {/* Term pill */}
          <div className="mono" style={{
            fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ width: 6, height: 6, background: 'var(--ok)', borderRadius: '50%' }} />
            {settings.lang === 'ar' ? 'الفصل الثاني · الأسبوع الثامن' : 'Term 2 · Week 8'}
            <span style={{ color: 'var(--ink-4)', marginInline: 6 }}>·</span>
            {academicYear || '2025 / 2026'}
          </div>

          {/* Search */}
          <div style={{
            flex: 1, maxWidth: 420,
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--surface)', border: '1px solid var(--line)',
            borderRadius: 'var(--radius)', padding: '7px 12px',
            color: 'var(--ink-3)',
          }}>
            <Search size={14} />
            <input
              placeholder={settings.lang === 'ar' ? 'ابحث…' : 'Search classes, assignments, people…'}
              style={{
                flex: 1, background: 'transparent', border: 0, outline: 0,
                color: 'var(--ink)', fontFamily: 'inherit', fontSize: 13,
              }}
            />
            <kbd style={{
              fontFamily: 'var(--f-mono)', fontSize: 10,
              border: '1px solid var(--line)', borderRadius: 3,
              padding: '1px 5px', color: 'var(--ink-3)',
            }}>⌘K</kbd>
          </div>

          <div style={{ flex: 1 }} />

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Role toggle */}
            <div className="seg" style={{ marginInlineEnd: 4 }}>
              <button
                className={settings.role === 'student' ? 'on' : ''}
                onClick={() => settings.set({ role: 'student' })}
                style={{ padding: '5px 10px', fontSize: 11 }}
              >{t.roleStudent}</button>
              <button
                className={settings.role === 'admin' ? 'on' : ''}
                onClick={() => settings.set({ role: 'admin' })}
                style={{ padding: '5px 10px', fontSize: 11 }}
              >{t.roleAdmin}</button>
            </div>

            {/* Switch school (admin) */}
            {settings.isAdmin && isSuperAdmin && activeSchool && (
              <button className="icon-btn" onClick={exitSchool} title={t.switchSchool}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M3 9l9-6 9 6v12H3z"/><path d="M9 21v-6h6v6"/>
                </svg>
              </button>
            )}

            {/* Language */}
            <button className="icon-btn" onClick={settings.toggleLang} title="Language">
              <span className="mono" style={{ fontSize: 11, letterSpacing: '0.06em' }}>
                {settings.lang === 'ar' ? 'EN' : 'AR'}
              </span>
            </button>

            {/* Theme */}
            <button className="icon-btn" onClick={settings.toggleTheme} title="Theme">
              {settings.isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            {/* Notifications */}
            <button className="icon-btn has-dot" title="Notifications">
              <Bell size={16} />
            </button>

            {/* Tweaks */}
            <button className="icon-btn" onClick={() => setTweaksOpen((v) => !v)} title="Tweaks">
              <Settings size={16} />
            </button>

            {/* Logout */}
            <button className="icon-btn" onClick={handleLogout} title={t.signOut}>
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <div style={{ padding: 32, maxWidth: 1400, width: '100%' }}>
          <Outlet />
        </div>
      </div>

      {/* Tweaks panel */}
      {tweaksOpen && <TweaksPanel onClose={() => setTweaksOpen(false)} />}
    </div>
  );
}
