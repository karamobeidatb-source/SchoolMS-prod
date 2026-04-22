import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { useTranslation } from '../i18n';
import api from '../utils/api';
import SectionHead from '../components/SectionHead';
import Sparkline from '../components/Sparkline';
import Donut from '../components/Donut';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  Users, ClipboardCheck, CalendarDays, AlertCircle,
  TrendingUp, Clock, UserPlus, FileText, ArrowRight,
  Calendar, Plus, MapPin, Bus, ArrowUp,
} from 'lucide-react';

// ── Seed data for the student portal dashboard ──
const STUDENT_SUBJECTS = [
  { code: 'MATH', name: 'Mathematics', nameAr: 'الرياضيات', teacher: 'Ms. Nadia Saleh', teacherAr: 'أ. نادية صالح', grade: 'A-', pct: 91, trend: [84,86,88,85,90,89,91], color: 'accent' },
  { code: 'PHYS', name: 'Physics', nameAr: 'الفيزياء', teacher: 'Mr. Omar Khalil', teacherAr: 'أ. عمر خليل', grade: 'B+', pct: 87, trend: [78,80,82,85,86,88,87], color: 'ok' },
  { code: 'CHEM', name: 'Chemistry', nameAr: 'الكيمياء', teacher: 'Dr. Rima Faris', teacherAr: 'د. ريما فارس', grade: 'A', pct: 94, trend: [88,90,91,92,93,94,94], color: 'ok' },
  { code: 'ENG',  name: 'English Literature', nameAr: 'الأدب الإنجليزي', teacher: 'Ms. Sarah Bishop', teacherAr: 'أ. سارة بيشوب', grade: 'A-', pct: 90, trend: [85,87,86,88,89,90,90], color: 'accent' },
  { code: 'ARAB', name: 'Arabic Literature', nameAr: 'الأدب العربي', teacher: 'أ. مريم طه', teacherAr: 'أ. مريم طه', grade: 'A', pct: 95, trend: [92,93,94,95,94,95,95], color: 'ok' },
];

const STUDENT_ASSIGNMENTS = [
  { id: 1, title: 'Quadratic Functions — Problem Set 9', titleAr: 'الدوال التربيعية - مجموعة ٩', subj: 'MATH', due: 'Today, 23:59', dueAr: 'اليوم، ٢٣:٥٩', dueStatus: 'soon', done: false },
  { id: 2, title: 'Lab Report: Refraction of Light', titleAr: 'تقرير مخبري: انكسار الضوء', subj: 'PHYS', due: 'Apr 23', dueAr: '٢٣ أبريل', dueStatus: '', done: false },
  { id: 3, title: 'Essay: Themes in "The Great Gatsby"', titleAr: 'مقال: ثيمات في "غاتسبي العظيم"', subj: 'ENG', due: 'Apr 24', dueAr: '٢٤ أبريل', dueStatus: '', done: false },
  { id: 4, title: 'Periodic Trends Worksheet', titleAr: 'ورقة عمل: الاتجاهات الدورية', subj: 'CHEM', due: 'Apr 19', dueAr: '١٩ أبريل', dueStatus: 'overdue', done: false },
];

const STUDENT_MESSAGES = [
  { id: 1, from: 'Ms. Nadia Saleh', fromAr: 'أ. نادية صالح', initials: 'NS', time: '10:24', preview: 'Your problem set 9 looks great — one note on Q4…', previewAr: 'مجموعتك ٩ رائعة - ملاحظة على السؤال ٤…', unread: true },
  { id: 2, from: 'School Admin', fromAr: 'إدارة المدرسة', initials: 'SA', time: 'Mon', preview: 'Permission slip for Science Museum field trip — due Friday.', previewAr: 'إذن رحلة المتحف العلمي - حتى الجمعة.', unread: true },
  { id: 3, from: 'Dr. Rima Faris', fromAr: 'د. ريما فارس', initials: 'RF', time: 'Sun', preview: 'Lab safety quiz retakes available this week.', previewAr: 'إعادة اختبار السلامة المخبرية متاحة هذا الأسبوع.', unread: false },
];

// ── Student Dashboard (matches design handoff pixel-perfect) ──
function StudentDashboard({ t, lang }) {
  const navigate = useNavigate();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? t.goodMorning : hour < 17 ? t.goodAfternoon : t.goodEvening;
  const firstName = lang === 'ar' ? 'ليلى' : 'Layla';

  const days = lang === 'ar'
    ? ['الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد']
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayNums = [20, 21, 22, 23, 24, 25, 26];
  const weekEvents = [
    [{ label: 'MATH', cls: 'accent' }, { label: 'PHYS', cls: '' }],
    [{ label: 'CHEM', cls: '' }, { label: 'CS', cls: 'accent' }, { label: 'PE', cls: '' }],
    [{ label: 'ENG', cls: 'accent' }, { label: 'MATH', cls: 'accent' }],
    [{ label: 'CHEM', cls: '' }, { label: 'HIST', cls: 'warn' }, { label: 'CS', cls: 'accent' }],
    [{ label: 'MATH', cls: 'accent' }, { label: 'ENG', cls: 'accent' }, { label: 'ARAB', cls: '' }],
    [], [],
  ];

  return (
    <>
      <SectionHead
        title={<>{greeting}, <span style={{ color: 'var(--accent)' }}>{firstName}</span>.</>}
        sub={t.welcomeSub + '  ' + (lang === 'ar' ? 'الثلاثاء، ٢١ أبريل' : 'Tuesday, April 21 · 23°')}
        actions={<>
          <button className="btn" onClick={() => navigate('/timetable')}>
            <Calendar size={14} />{lang === 'ar' ? 'الجدول' : 'Schedule'}
          </button>
          <button className="btn accent">
            <Plus size={14} />{lang === 'ar' ? 'واجب جديد' : 'New task'}
          </button>
        </>}
      />

      {/* Week pulse strip */}
      <div style={{
        display: 'grid', gridTemplateColumns: '120px 1fr', gap: 24, padding: 24,
        background: 'var(--surface)', border: '1px solid var(--line)',
        borderRadius: 'var(--radius-lg)', marginBottom: 'var(--gap)',
      }}>
        <div>
          <div className="label">{t.thisWeek}</div>
          <div className="display" style={{ fontSize: 28, lineHeight: 1, marginTop: 6, letterSpacing: '-0.02em' }}>
            {lang === 'ar' ? 'أسبوع ٨' : 'Week 8'}
          </div>
          <div className="mono" style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>Apr 20 — 26</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, alignItems: 'stretch' }}>
          {days.map((d, i) => (
            <div key={i} style={{
              border: `1px solid ${i === 1 ? 'var(--accent)' : 'var(--line-soft)'}`,
              borderRadius: 6, padding: 10, minHeight: 90,
              background: i === 1 ? 'var(--accent-soft)' : 'var(--bg)',
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span className="mono" style={{
                  fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
                  color: i === 1 ? 'var(--accent)' : 'var(--ink-3)',
                }}>{d}</span>
                <span className="display" style={{ fontSize: 18, lineHeight: 1 }}>{dayNums[i]}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 'auto' }}>
                {weekEvents[i].map((e, j) => (
                  <span key={j} className="mono" style={{
                    fontSize: 9, letterSpacing: '0.04em', padding: '2px 5px', borderRadius: 3,
                    background: e.cls === 'accent'
                      ? 'color-mix(in oklab, var(--accent) 18%, transparent)'
                      : e.cls === 'warn'
                      ? 'color-mix(in oklab, var(--warn) 18%, transparent)'
                      : 'var(--surface-2)',
                    color: e.cls === 'accent' ? 'var(--accent)' : e.cls === 'warn' ? 'var(--warn)' : 'var(--ink-2)',
                    display: 'inline-block', maxWidth: '100%', whiteSpace: 'nowrap',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{e.label}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4 KPI Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--gap)', marginBottom: 'var(--gap)' }}>
        {[
          {
            label: t.todayGPA,
            value: <>3.82<sup style={{ fontSize: 16, color: 'var(--ink-3)', fontFamily: 'var(--f-mono)', marginInlineStart: 3, fontWeight: 400 }}>/4.0</sup></>,
            trend: <span className="mono" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ok)' }}><ArrowUp size={10} />+0.08 Term 1</span>,
            chart: <Sparkline data={[3.4, 3.55, 3.6, 3.68, 3.72, 3.78, 3.82]} color="var(--accent)" width={120} />,
          },
          {
            label: t.attendanceRate,
            value: <>96<sup style={{ fontSize: 16, color: 'var(--ink-3)', fontFamily: 'var(--f-mono)', marginInlineStart: 3, fontWeight: 400 }}>%</sup></>,
            trend: <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>2 late · 1 absent</span>,
            chart: <Donut pct={96} color="var(--ok)" />,
          },
          {
            label: t.assignmentsDue,
            value: <>4</>,
            trend: <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>{lang === 'ar' ? '١ متأخر' : '1 overdue'}</span>,
            chart: <Sparkline data={[6, 5, 4, 7, 3, 5, 4]} color="var(--warn)" width={120} />,
          },
          {
            label: t.busStatus,
            value: <>12<sup style={{ fontSize: 16, color: 'var(--ink-3)', fontFamily: 'var(--f-mono)', marginInlineStart: 3, fontWeight: 400 }}>min</sup></>,
            trend: <span className="chip ok" style={{ padding: '1px 6px' }}><span className="dot" />{lang === 'ar' ? 'في الطريق' : 'En route'}</span>,
            chart: <Bus size={38} style={{ color: 'var(--ink-3)' }} />,
          },
        ].map((s, i) => (
          <div key={i} style={{
            padding: 20, background: 'var(--surface)', border: '1px solid var(--line)',
            borderRadius: 'var(--radius-lg)', position: 'relative', overflow: 'hidden',
          }}>
            <div className="label" style={{ marginBottom: 8 }}>{s.label}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div className="display" style={{ fontSize: 40, letterSpacing: '-0.025em', lineHeight: 1 }}>{s.value}</div>
              <div style={{ color: 'var(--ink-3)' }}>{s.chart}</div>
            </div>
            <div style={{ marginTop: 10 }}>{s.trend}</div>
          </div>
        ))}
      </div>

      {/* Two cols: Upcoming work + Recent grades */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--gap)', marginBottom: 'var(--gap)' }}>
        {/* Upcoming work */}
        <div className="card">
          <div className="card-head">
            <h3>{lang === 'ar' ? 'مهامك المستحقة' : 'Upcoming work'}</h3>
            <button className="btn" onClick={() => navigate('/assignments')}>{t.viewAll} <ArrowRight size={12} /></button>
          </div>
          <div>
            {STUDENT_ASSIGNMENTS.map((a) => {
              const subj = STUDENT_SUBJECTS.find((s) => s.code === a.subj);
              return (
                <div key={a.id} style={{
                  padding: '16px 20px', borderBottom: '1px solid var(--line-soft)',
                  display: 'grid', gridTemplateColumns: '28px 1fr 120px 80px',
                  gap: 16, alignItems: 'center',
                }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: 4,
                    border: '1.5px solid var(--line)',
                  }} />
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{lang === 'ar' ? a.titleAr : a.title}</div>
                    <span className={`chip ${subj?.color || ''}`} style={{ marginTop: 4 }}>
                      <span className="dot" />{subj?.code}
                    </span>
                  </div>
                  <div className="mono" style={{
                    fontSize: '11.5px', letterSpacing: '0.04em',
                    color: a.dueStatus === 'overdue' ? 'var(--bad)' : a.dueStatus === 'soon' ? 'var(--warn)' : 'var(--ink-3)',
                  }}>{lang === 'ar' ? a.dueAr : a.due}</div>
                  <div><button className="btn" style={{ padding: '4px 10px' }}>{lang === 'ar' ? 'افتح' : 'Open'}</button></div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent grades */}
        <div className="card">
          <div className="card-head">
            <h3>{t.recentGrades}</h3>
            <button className="btn" onClick={() => navigate('/gradebook')}>{t.viewAll} <ArrowRight size={12} /></button>
          </div>
          <div>
            {STUDENT_SUBJECTS.map((s) => (
              <div key={s.code} style={{
                display: 'grid', gridTemplateColumns: '1fr 60px 50px', gap: 12,
                alignItems: 'center', padding: '12px 20px',
                borderTop: '1px solid var(--line-soft)',
              }}>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 500 }}>{lang === 'ar' ? s.nameAr : s.name}</div>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 2, letterSpacing: '0.08em' }}>{s.code}</div>
                </div>
                <Sparkline data={s.trend} color={`var(--${s.color === 'warn' ? 'warn' : s.color === 'accent' ? 'accent' : 'ok'})`} width={60} height={20} />
                <div className="mono" style={{ fontSize: 14, fontWeight: 600, textAlign: 'end' }}>
                  {s.pct}<span style={{ color: 'var(--ink-3)' }}>%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bus + Inbox */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--gap)' }}>
        {/* Bus card */}
        <div className="card">
          <div className="card-head">
            <h3>{lang === 'ar' ? 'النقل المدرسي' : "Today's bus"}</h3>
            <button className="btn" onClick={() => navigate('/transport')}><MapPin size={12} />{t.track}</button>
          </div>
          <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '120px 1fr 140px', gap: 24, alignItems: 'center' }}>
            <div>
              <div className="display" style={{ fontSize: 22, letterSpacing: '-0.01em' }}>{lang === 'ar' ? 'الخط ٧ — جبل عمان' : 'Route 7 — Jabal Amman'}</div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4, letterSpacing: '0.06em' }}>
                {lang === 'ar' ? 'أ. سامر ك.' : 'Mr. Samer K.'} · 41-8832
              </div>
            </div>
            <div>
              <div style={{ position: 'relative', height: 6, background: 'var(--surface-2)', borderRadius: 999 }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '55%', background: 'var(--accent)', borderRadius: 999 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', marginTop: -9, position: 'relative' }}>
                {[
                  { name: lang === 'ar' ? 'دوار الحديقة' : 'Garden Circle', time: '07:02', state: 'done' },
                  { name: lang === 'ar' ? 'الدوار الرابع' : '4th Circle', time: '07:11', state: 'done' },
                  { name: lang === 'ar' ? 'شارع الرينبو' : 'Rainbow St.', time: '07:18', state: 'current' },
                  { name: lang === 'ar' ? 'بوابة المدرسة' : 'School Gate', time: '07:34', state: 'upcoming' },
                ].map((stop, i) => (
                  <div key={i} style={{ position: 'relative', paddingTop: 20, textAlign: 'center' }}>
                    <span style={{
                      position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)',
                      width: 12, height: 12, borderRadius: '50%',
                      background: stop.state === 'done' ? 'var(--accent)' : stop.state === 'current' ? 'white' : 'var(--surface)',
                      border: `2px solid ${stop.state === 'done' || stop.state === 'current' ? 'var(--accent)' : 'var(--line)'}`,
                      boxShadow: stop.state === 'current' ? '0 0 0 4px color-mix(in oklab, var(--accent) 30%, transparent)' : 'none',
                    }} />
                    <div className="mono" style={{
                      fontSize: 10, letterSpacing: '0.04em',
                      color: stop.state === 'current' ? 'var(--accent)' : 'var(--ink-3)',
                      fontWeight: stop.state === 'current' ? 600 : 400,
                    }}>{stop.name}</div>
                    <div style={{ fontSize: 11, marginTop: 2 }} className="mono">{stop.time}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ textAlign: 'end' }}>
              <div className="display" style={{ fontSize: 36, letterSpacing: '-0.02em', lineHeight: 1 }}>12'</div>
              <div className="mono" style={{ fontSize: 10, letterSpacing: '0.1em', color: 'var(--ink-3)', textTransform: 'uppercase', marginTop: 4 }}>{t.minAway}</div>
            </div>
          </div>
        </div>

        {/* Inbox */}
        <div className="card">
          <div className="card-head">
            <h3>{t.inbox}</h3>
            <span className="chip accent"><span className="dot" />2 {t.unreadMessages}</span>
          </div>
          <div>
            {STUDENT_MESSAGES.map((m) => (
              <div key={m.id} style={{
                padding: '14px 18px', borderBottom: '1px solid var(--line-soft)',
                cursor: 'pointer', display: 'flex', gap: 10,
              }} onClick={() => navigate('/messages')}>
                <div className="avatar-sm">{m.initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div style={{ fontWeight: 600, fontSize: '13.5px' }}>
                      {lang === 'ar' ? m.fromAr : m.from}
                      {m.unread && <span style={{
                        display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                        background: 'var(--accent)', marginInlineStart: 6, verticalAlign: 'middle',
                      }} />}
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>{m.time}</div>
                  </div>
                  <div style={{
                    fontSize: '12.5px', marginTop: 4,
                    color: m.unread ? 'var(--ink-2)' : 'var(--ink-3)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{lang === 'ar' ? m.previewAr : m.preview}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Admin Dashboard (existing, adapted to new design system) ──
function AdminDashboard({ t, lang }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reports/dashboard')
      .then((res) => setData(res.data))
      .catch(() => setData({ students: { total: 0 }, today: { attendanceRate: 0 }, upcomingEvents: [], pendingLeaves: 0 }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;
  const stats = data || {};

  const firstName = user?.name?.split(' ')[0] || (lang === 'ar' ? 'المدير' : 'there');
  const hour = new Date().getHours();
  const greeting = hour < 12 ? t.goodMorning : hour < 17 ? t.goodAfternoon : t.goodEvening;

  const quickActions = [
    { label: lang === 'ar' ? 'إضافة طالب' : 'Add Student', icon: UserPlus, path: '/students/new' },
    { label: lang === 'ar' ? 'تسجيل الحضور' : 'Mark Attendance', icon: ClipboardCheck, path: '/attendance' },
    { label: lang === 'ar' ? 'عرض التقارير' : 'View Reports', icon: TrendingUp, path: '/reports' },
    { label: lang === 'ar' ? 'الواجبات' : 'Assignments', icon: FileText, path: '/assignments' },
  ];

  return (
    <>
      <SectionHead
        title={<>{greeting}, <span style={{ color: 'var(--accent)' }}>{firstName}</span>.</>}
        sub={lang === 'ar' ? 'إليك ملخص ما يحدث في مدرستك اليوم.' : 'Here is what is happening at your school today.'}
      />

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--gap)', marginBottom: 'var(--gap)' }}>
        {[
          { label: t.totalStudents, value: stats.students?.total ?? 0, icon: Users, color: 'var(--accent)' },
          { label: t.attendanceRate, value: `${stats.students?.attendanceRate ?? 0}%`, icon: ClipboardCheck, color: 'var(--ok)' },
          { label: t.upcomingEvents, value: Array.isArray(stats.upcomingEvents) ? stats.upcomingEvents.length : (stats.upcomingEvents ?? 0), icon: CalendarDays, color: 'var(--accent-2)' },
          { label: t.pendingLeaves, value: stats.pendingLeaves ?? 0, icon: AlertCircle, color: 'var(--warn)' },
        ].map((s, i) => (
          <div key={i} style={{
            padding: 20, background: 'var(--surface)', border: '1px solid var(--line)',
            borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'flex-start', gap: 16,
          }}>
            <div style={{ padding: 12, borderRadius: 'var(--radius)', background: 'var(--accent-soft)', color: s.color }}>
              <s.icon size={24} />
            </div>
            <div>
              <div className="label">{s.label}</div>
              <div className="display" style={{ fontSize: 32, lineHeight: 1, marginTop: 6 }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions + Recent activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--gap)' }}>
        <div className="card">
          <div className="card-head"><h3>{t.quickActions}</h3></div>
          <div>
            {quickActions.map((action) => (
              <a key={action.label} href={action.path} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
                borderTop: '1px solid var(--line-soft)', textDecoration: 'none', color: 'var(--ink)',
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 'var(--radius)', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'grid', placeItems: 'center' }}>
                  <action.icon size={16} />
                </div>
                <span style={{ flex: 1, fontSize: '13.5px', fontWeight: 500 }}>{action.label}</span>
                <ArrowRight size={14} style={{ color: 'var(--ink-4)' }} />
              </a>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h3>{t.recentActivity}</h3></div>
          <div>
            {(stats.recentActivity?.length || 0) === 0 ? (
              <div className="empty">
                <Clock size={32} style={{ margin: '0 auto 8px', color: 'var(--ink-4)' }} />
                <p>{t.noActivity}</p>
              </div>
            ) : (
              stats.recentActivity.map((item, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 20px',
                  borderTop: '1px solid var(--line-soft)',
                }}>
                  <div className="avatar-sm" style={{ marginTop: 2 }}>
                    <Clock size={12} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5 }}>{item.message || item.text}</div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>{item.time || item.createdAt || ''}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main export: switches between Student and Admin dashboard ──
export default function Dashboard() {
  const settings = useAppSettings();
  const t = useTranslation(settings.lang);

  if (settings.isStudent) {
    return <StudentDashboard t={t} lang={settings.lang} />;
  }
  return <AdminDashboard t={t} lang={settings.lang} />;
}
