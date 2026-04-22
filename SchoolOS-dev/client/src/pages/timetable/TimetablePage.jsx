import { useState, useEffect, useMemo } from 'react';
import api from '../../utils/api';
import Modal from '../../components/Modal';
import Badge from '../../components/Badge';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Plus, Send, Calendar, UserCheck, Clock, Edit, Trash2, X } from 'lucide-react';

// day_of_week in DB is INTEGER 0-4
const DAYS = [
  { idx: 0, name: 'Sunday' },
  { idx: 1, name: 'Monday' },
  { idx: 2, name: 'Tuesday' },
  { idx: 3, name: 'Wednesday' },
  { idx: 4, name: 'Thursday' },
];

const PERIODS = Array.from({ length: 8 }, (_, i) => {
  const sh = 8 + Math.floor(i * 50 / 60), sm = (i * 50) % 60;
  const eh = 8 + Math.floor((i + 1) * 50 / 60), em = ((i + 1) * 50) % 60;
  return { num: i + 1, start: `${sh}:${String(sm).padStart(2, '0')}`, end: `${eh}:${String(em).padStart(2, '0')}` };
});

const SLOT_COLORS = [
  { bg: 'var(--accent-soft)', text: 'var(--accent)', border: 'color-mix(in oklab, var(--accent) 30%, var(--line))' },
  { bg: 'color-mix(in oklab, var(--ok) 12%, var(--surface))', text: 'var(--ok)', border: 'color-mix(in oklab, var(--ok) 30%, var(--line))' },
  { bg: 'color-mix(in oklab, var(--warn) 12%, var(--surface))', text: 'var(--warn)', border: 'color-mix(in oklab, var(--warn) 30%, var(--line))' },
  { bg: 'color-mix(in oklab, var(--bad) 12%, var(--surface))', text: 'var(--bad)', border: 'color-mix(in oklab, var(--bad) 30%, var(--line))' },
];

const DUMMY_EXAMS = [
  { id: 'e1', subject_name: 'Mathematics', grade_name: 'Grade 11', date: '2026-06-10', time: '09:00', room: 'Hall A', exam_type: 'final' },
  { id: 'e2', subject_name: 'Physics', grade_name: 'Grade 11', date: '2026-06-12', time: '09:00', room: 'Hall A', exam_type: 'final' },
  { id: 'e3', subject_name: 'Chemistry', grade_name: 'Grade 11', date: '2026-06-14', time: '09:00', room: 'Hall B', exam_type: 'final' },
  { id: 'e4', subject_name: 'English', grade_name: 'Grade 11', date: '2026-06-16', time: '09:00', room: 'Hall A', exam_type: 'final' },
  { id: 'e5', subject_name: 'Arabic', grade_name: 'Grade 11', date: '2026-06-18', time: '09:00', room: 'Hall B', exam_type: 'final' },
  { id: 'e6', subject_name: 'Computer Science', grade_name: 'Grade 11', date: '2026-05-05', time: '10:00', room: 'Lab 4', exam_type: 'midterm' },
];

const DUMMY_SUBS = [
  { id: 's1', substitute_teacher_name: 'Mr. Ahmad Masri', original_teacher_name: 'Ms. Nadia Saleh', date: '2026-04-22', slot: 1, reason: 'Sick leave' },
  { id: 's2', substitute_teacher_name: 'Ms. Lina Barakat', original_teacher_name: 'Mr. Julian Reed', date: '2026-04-21', slot: 2, reason: 'Conference attendance' },
];

export default function TimetablePage() {
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [grades, setGrades] = useState([]);
  const [selectedSection, setSelectedSection] = useState('');
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('timetable');
  const [publishing, setPublishing] = useState(false);

  // Slot modal
  const [showModal, setShowModal] = useState(false);
  const [editingSlot, setEditingSlot] = useState(null);
  const [slotForm, setSlotForm] = useState({ day_of_week: 0, period: 1, subject_id: '', teacher_id: '', room: '' });
  const [saving, setSaving] = useState(false);

  // Exam state
  const [examSlots, setExamSlots] = useState(DUMMY_EXAMS);
  const [showExamModal, setShowExamModal] = useState(false);
  const [editingExam, setEditingExam] = useState(null);
  const [examForm, setExamForm] = useState({ subject_id: '', grade_level_id: '', date: '', time: '', room: '', exam_type: 'midterm' });
  const [savingExam, setSavingExam] = useState(false);

  // Substitute state
  const [substitutes, setSubstitutes] = useState(DUMMY_SUBS);
  const [showSubModal, setShowSubModal] = useState(false);
  const [subForm, setSubForm] = useState({ original_teacher_id: '', substitute_teacher_id: '', date: '', slot: 1, reason: '' });
  const [savingSub, setSavingSub] = useState(false);

  const colorMap = useMemo(() => ({}), []);
  const getColor = (key) => {
    if (!colorMap[key]) colorMap[key] = SLOT_COLORS[Object.keys(colorMap).length % SLOT_COLORS.length];
    return colorMap[key];
  };

  // Load metadata
  useEffect(() => {
    Promise.all([
      api.get('/sections').catch(() => ({ data: [] })),
      api.get('/subjects').catch(() => ({ data: [] })),
      api.get('/users').catch(() => ({ data: { users: [] } })),
      api.get('/grade-levels').catch(() => ({ data: [] })),
    ]).then(([secRes, subRes, userRes, gradeRes]) => {
      const secs = secRes.data || [];
      setSections(secs);
      setSubjects(subRes.data || []);
      const allUsers = userRes.data?.users || userRes.data || [];
      setTeachers(allUsers.filter((u) => u.role_name === 'Teacher' || u.role_key === 'teacher' || u.role === 'teacher'));
      setGrades(gradeRes.data || []);
      if (secs.length) setSelectedSection(String(secs[0].id || secs[0]._id));
    }).finally(() => setLoading(false));
  }, []);

  // Load timetable slots for selected section
  const loadSlots = (sectionId) => {
    if (!sectionId) return;
    setLoading(true);
    api.get('/timetable', { params: { section_id: sectionId } })
      .then((res) => {
        const data = res.data.slots || res.data || [];
        const normalized = data.map((s) => ({
          ...s,
          day_of_week: typeof s.day_of_week === 'number' ? s.day_of_week : parseInt(s.day_of_week) || 0,
          subject_name: s.subject_name_en || s.subject_name || s.subject || '',
          teacher_name: s.teacher_first_name ? `${s.teacher_first_name} ${s.teacher_last_name}` : (s.teacher_name || ''),
        }));
        setSlots(normalized);
      })
      .catch(() => setSlots([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadSlots(selectedSection); }, [selectedSection]);

  // Load exams
  useEffect(() => {
    if (activeView !== 'exams') return;
    api.get('/exam-timetable')
      .then((res) => {
        const data = res.data.exams || res.data || [];
        if (data.length > 0) {
          setExamSlots(data.map((e) => ({
            ...e,
            subject_name: e.subject_name_en || e.subject_name,
            grade_name: e.grade_name_en || e.grade_name,
            date: e.exam_date || e.date,
            time: e.start_time || e.time,
          })));
        }
      })
      .catch(() => {});
  }, [activeView]);

  // Load substitutes
  useEffect(() => {
    if (activeView !== 'substitutes') return;
    api.get('/substitutes')
      .then((res) => {
        const data = res.data.substitutes || res.data || [];
        if (data.length > 0) {
          setSubstitutes(data.map((s) => ({
            ...s,
            substitute_teacher_name: s.substitute_first_name ? `${s.substitute_first_name} ${s.substitute_last_name}` : (s.substitute_teacher_name || ''),
            original_teacher_name: s.original_first_name ? `${s.original_first_name} ${s.original_last_name}` : (s.original_teacher_name || ''),
          })));
        }
      })
      .catch(() => {});
  }, [activeView]);

  const getSlot = (dayIdx, period) => slots.find((s) => s.day_of_week === dayIdx && s.period === period);

  // ── Timetable CRUD ──
  const openAddSlot = (dayIdx, period) => {
    setEditingSlot(null);
    setSlotForm({ day_of_week: dayIdx, period, subject_id: '', teacher_id: '', room: '' });
    setShowModal(true);
  };

  const openEditSlot = (slot) => {
    setEditingSlot(slot);
    setSlotForm({
      day_of_week: slot.day_of_week,
      period: slot.period,
      subject_id: String(slot.subject_id || ''),
      teacher_id: String(slot.teacher_id || ''),
      room: slot.room || '',
    });
    setShowModal(true);
  };

  const handleSaveSlot = async () => {
    if (!slotForm.subject_id || !slotForm.teacher_id) {
      alert('Please select a subject and teacher.');
      return;
    }
    setSaving(true);
    const period = PERIODS.find((p) => p.num === slotForm.period);
    const payload = {
      section_id: parseInt(selectedSection),
      subject_id: parseInt(slotForm.subject_id),
      teacher_id: parseInt(slotForm.teacher_id),
      day_of_week: slotForm.day_of_week,
      period: slotForm.period,
      start_time: period?.start || '08:00',
      end_time: period?.end || '08:50',
      room: slotForm.room || null,
      academic_year: '2025-2026',
      semester: 2,
    };
    try {
      if (editingSlot) {
        await api.put(`/timetable/${editingSlot.id}`, payload);
      } else {
        // Delete existing slot at same position first
        const existing = getSlot(slotForm.day_of_week, slotForm.period);
        if (existing) await api.delete(`/timetable/${existing.id}`);
        await api.post('/timetable', payload);
      }
      loadSlots(selectedSection);
    } catch (err) {
      console.error('Save failed:', err.response?.data || err.message);
      alert('Save failed: ' + (err.response?.data?.error || err.message));
    }
    setSaving(false);
    setShowModal(false);
  };

  const handleDeleteSlot = async (slot) => {
    if (!confirm('Delete this timetable slot?')) return;
    try {
      await api.delete(`/timetable/${slot.id}`);
      loadSlots(selectedSection);
    } catch (err) {
      alert('Delete failed: ' + (err.response?.data?.error || err.message));
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await api.post('/timetable/publish', { section_id: parseInt(selectedSection), academic_year: '2025-2026', semester: 2 });
      alert('Timetable published!');
    } catch (err) {
      alert('Publish failed: ' + (err.response?.data?.error || err.message));
    }
    setPublishing(false);
  };

  // ── Exam CRUD ──
  const openAddExam = () => {
    setEditingExam(null);
    setExamForm({ subject_id: '', grade_level_id: '', date: '', time: '', room: '', exam_type: 'midterm' });
    setShowExamModal(true);
  };
  const openEditExam = (exam) => {
    setEditingExam(exam);
    setExamForm({
      subject_id: String(exam.subject_id || ''),
      grade_level_id: String(exam.grade_level_id || ''),
      date: (exam.date || exam.exam_date || '').substring(0, 10),
      time: exam.time || exam.start_time || '',
      room: exam.room || '',
      exam_type: exam.exam_type || 'midterm',
    });
    setShowExamModal(true);
  };
  const handleSaveExam = async () => {
    setSavingExam(true);
    const subj = subjects.find((s) => String(s.id) === String(examForm.subject_id));
    const grade = grades.find((g) => String(g.id) === String(examForm.grade_level_id));
    try {
      const payload = {
        subject_id: parseInt(examForm.subject_id),
        grade_level_id: parseInt(examForm.grade_level_id),
        exam_type: examForm.exam_type,
        exam_date: examForm.date,
        start_time: examForm.time,
        end_time: examForm.time,
        room: examForm.room,
        academic_year: '2025-2026',
        semester: 2,
      };
      if (editingExam && !String(editingExam.id).startsWith('e')) {
        await api.put(`/exam-timetable/${editingExam.id}`, payload);
      } else {
        await api.post('/exam-timetable', payload);
      }
      const res = await api.get('/exam-timetable');
      const data = res.data.exams || res.data || [];
      if (data.length > 0) {
        setExamSlots(data.map((e) => ({
          ...e, subject_name: e.subject_name_en || e.subject_name, grade_name: e.grade_name_en || e.grade_name,
          date: e.exam_date || e.date, time: e.start_time || e.time,
        })));
      }
    } catch {
      // Fallback: update local
      const newExam = {
        id: editingExam?.id || `e${Date.now()}`,
        subject_name: subj?.name_en || 'Subject', grade_name: grade?.name_en || 'Grade',
        date: examForm.date, time: examForm.time, room: examForm.room, exam_type: examForm.exam_type,
        subject_id: examForm.subject_id, grade_level_id: examForm.grade_level_id,
      };
      if (editingExam) setExamSlots((prev) => prev.map((e) => e.id === editingExam.id ? newExam : e));
      else setExamSlots((prev) => [...prev, newExam]);
    }
    setSavingExam(false);
    setShowExamModal(false);
  };
  const handleDeleteExam = async (exam) => {
    if (!confirm('Delete this exam slot?')) return;
    try { if (!String(exam.id).startsWith('e')) await api.delete(`/exam-timetable/${exam.id}`); } catch {}
    setExamSlots((prev) => prev.filter((e) => e.id !== exam.id));
  };

  // ── Substitute CRUD ──
  const openAddSub = () => {
    setSubForm({ original_teacher_id: '', substitute_teacher_id: '', date: '', slot: 1, reason: '' });
    setShowSubModal(true);
  };
  const handleSaveSub = async () => {
    setSavingSub(true);
    const orig = teachers.find((t) => String(t.id) === String(subForm.original_teacher_id));
    const sub = teachers.find((t) => String(t.id) === String(subForm.substitute_teacher_id));
    try {
      await api.post('/substitute', {
        original_teacher_id: parseInt(subForm.original_teacher_id),
        substitute_teacher_id: parseInt(subForm.substitute_teacher_id),
        date: subForm.date,
        reason: subForm.reason,
      });
      const res = await api.get('/substitutes');
      const data = res.data.substitutes || res.data || [];
      if (data.length > 0) {
        setSubstitutes(data.map((s) => ({
          ...s,
          substitute_teacher_name: s.substitute_first_name ? `${s.substitute_first_name} ${s.substitute_last_name}` : '',
          original_teacher_name: s.original_first_name ? `${s.original_first_name} ${s.original_last_name}` : '',
        })));
      }
    } catch {
      setSubstitutes((prev) => [...prev, {
        id: `s${Date.now()}`,
        original_teacher_name: orig ? `${orig.first_name} ${orig.last_name}` : 'Teacher',
        substitute_teacher_name: sub ? `${sub.first_name} ${sub.last_name}` : 'Substitute',
        date: subForm.date, slot: subForm.slot, reason: subForm.reason,
      }]);
    }
    setSavingSub(false);
    setShowSubModal(false);
  };
  const handleDeleteSub = (sub) => {
    setSubstitutes((prev) => prev.filter((s) => s.id !== sub.id));
  };

  if (loading && sections.length === 0) return <LoadingSpinner />;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28, gap: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 38, fontWeight: 400, lineHeight: 1.05, letterSpacing: '-0.02em', margin: 0 }}>Timetable</h1>
          <div style={{ color: 'var(--ink-3)', marginTop: 6, fontSize: '13.5px' }}>Weekly schedule (Sunday - Thursday)</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="select"
          >
            {sections.map((s) => {
              const grade = s.grade_level_name || s.grade_name_en || '';
              return <option key={s.id || s._id} value={s.id || s._id}>{grade ? `${grade} — ` : ''}{s.name_en || s.name}</option>;
            })}
          </select>
          <button onClick={handlePublish} disabled={publishing} className="btn accent">
            <Send size={14} /> {publishing ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="seg" style={{ marginBottom: 'var(--gap)' }}>
        {[
          { key: 'timetable', label: 'Weekly Timetable', icon: Calendar },
          { key: 'exams', label: 'Exam Timetable', icon: Clock },
          { key: 'substitutes', label: 'Substitutes', icon: UserCheck },
        ].map((tab) => (
          <button key={tab.key} className={activeView === tab.key ? 'on' : ''} onClick={() => setActiveView(tab.key)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <tab.icon size={13} /> {tab.label}
          </button>
        ))}
      </div>

      {/* ── Weekly Timetable ── */}
      {activeView === 'timetable' && (
        loading ? <LoadingSpinner /> : (
          <div className="card" style={{ padding: 0, overflow: 'auto' }}>
            <table className="tbl" style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={{ width: 100 }}>Period</th>
                  {DAYS.map((d) => <th key={d.idx} style={{ textAlign: 'center' }}>{d.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {PERIODS.map((p) => (
                  <tr key={p.num}>
                    <td style={{ verticalAlign: 'top', padding: '12px 16px' }}>
                      <div style={{ fontFamily: 'var(--f-display)', fontWeight: 500, fontSize: 15 }}>Period {p.num}</div>
                      <div className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 2, letterSpacing: '0.06em' }}>{p.start} – {p.end}</div>
                    </td>
                    {DAYS.map((day) => {
                      const slot = getSlot(day.idx, p.num);
                      const color = slot ? getColor(slot.subject_id || slot.subject_name) : null;
                      return (
                        <td key={day.idx} style={{ padding: 4, verticalAlign: 'top' }}>
                          {slot ? (
                            <div style={{
                              padding: '8px 10px', borderRadius: 6, fontSize: 12, lineHeight: 1.3,
                              background: color.bg, color: color.text, border: `1px solid ${color.border}`,
                              position: 'relative', minHeight: 52, cursor: 'pointer',
                            }} onClick={() => openEditSlot(slot)}>
                              <div style={{ fontWeight: 600 }}>{slot.subject_name}</div>
                              {slot.teacher_name && <div style={{ opacity: 0.8, marginTop: 2, fontSize: 11 }}>{slot.teacher_name}</div>}
                              {slot.room && <div className="mono" style={{ fontSize: 10, marginTop: 2, opacity: 0.7, letterSpacing: '0.04em' }}>{slot.room}</div>}
                              <button onClick={(e) => { e.stopPropagation(); handleDeleteSlot(slot); }}
                                style={{ position: 'absolute', top: 4, insetInlineEnd: 4, opacity: 0.4, background: 'none', border: 0, cursor: 'pointer', color: 'inherit', padding: 2 }}
                                onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.4'; }}>
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => openAddSlot(day.idx, p.num)} style={{
                              width: '100%', height: 52, border: '2px dashed var(--line)', borderRadius: 6,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: 'var(--ink-4)', cursor: 'pointer', background: 'transparent',
                              transition: 'border-color 0.15s, color 0.15s',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.color = 'var(--ink-4)'; }}>
                              <Plus size={14} />
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── Exam Timetable ── */}
      {activeView === 'exams' && (
        <div className="card" style={{ padding: 0 }}>
          <div className="card-head">
            <h3>Exam Schedule</h3>
            <button onClick={openAddExam} className="btn accent"><Plus size={14} /> Add Exam</button>
          </div>
          {examSlots.length === 0 ? (
            <div className="empty">No exam slots scheduled</div>
          ) : (
            <table className="tbl">
              <thead><tr><th>Subject</th><th>Grade</th><th>Date</th><th>Time</th><th>Room</th><th>Type</th><th style={{ textAlign: 'end', width: 80 }}>Actions</th></tr></thead>
              <tbody>
                {examSlots.map((exam) => (
                  <tr key={exam.id}>
                    <td style={{ fontWeight: 500 }}>{exam.subject_name || 'N/A'}</td>
                    <td>{exam.grade_name || 'N/A'}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{(exam.date || '').substring(0, 10)}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{exam.time || 'N/A'}</td>
                    <td>{exam.room || 'N/A'}</td>
                    <td><span className={`chip ${exam.exam_type === 'final' ? 'bad' : exam.exam_type === 'midterm' ? 'accent' : 'ok'}`}><span className="dot" />{exam.exam_type}</span></td>
                    <td style={{ textAlign: 'end' }}>
                      <button className="icon-btn" onClick={() => openEditExam(exam)}><Edit size={14} /></button>
                      <button className="icon-btn" style={{ color: 'var(--bad)' }} onClick={() => handleDeleteExam(exam)}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Substitutes ── */}
      {activeView === 'substitutes' && (
        <div className="card" style={{ padding: 0 }}>
          <div className="card-head">
            <h3>Substitute Assignments</h3>
            <button onClick={openAddSub} className="btn accent"><Plus size={14} /> Assign Substitute</button>
          </div>
          {substitutes.length === 0 ? (
            <div className="empty">No substitute assignments</div>
          ) : (
            <table className="tbl">
              <thead><tr><th>Substitute</th><th>Replacing</th><th>Date</th><th>Period</th><th>Reason</th><th style={{ textAlign: 'end', width: 60 }}></th></tr></thead>
              <tbody>
                {substitutes.map((sub) => (
                  <tr key={sub.id}>
                    <td style={{ fontWeight: 500 }}>{sub.substitute_teacher_name || 'N/A'}</td>
                    <td>{sub.original_teacher_name || 'N/A'}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{(sub.date || '').substring(0, 10)}</td>
                    <td className="mono" style={{ fontSize: 12 }}>P{sub.slot || sub.period || '?'}</td>
                    <td style={{ color: 'var(--ink-3)', fontSize: 13 }}>{sub.reason || '—'}</td>
                    <td style={{ textAlign: 'end' }}>
                      <button className="icon-btn" style={{ color: 'var(--bad)' }} onClick={() => handleDeleteSub(sub)}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Add/Edit Slot Modal ── */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingSlot ? 'Edit Timetable Slot' : 'Add Timetable Slot'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label" style={{ marginBottom: 6 }}>Day</label>
              <select value={slotForm.day_of_week} onChange={(e) => setSlotForm((s) => ({ ...s, day_of_week: parseInt(e.target.value) }))} className="select" style={{ width: '100%' }}>
                {DAYS.map((d) => <option key={d.idx} value={d.idx}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" style={{ marginBottom: 6 }}>Period</label>
              <select value={slotForm.period} onChange={(e) => setSlotForm((s) => ({ ...s, period: parseInt(e.target.value) }))} className="select" style={{ width: '100%' }}>
                {PERIODS.map((p) => <option key={p.num} value={p.num}>Period {p.num} ({p.start})</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label" style={{ marginBottom: 6 }}>Subject *</label>
            <select value={slotForm.subject_id} onChange={(e) => setSlotForm((s) => ({ ...s, subject_id: e.target.value }))} className="input">
              <option value="">Select Subject</option>
              {subjects.map((s) => <option key={s.id || s._id} value={s.id || s._id}>{s.name_en || s.name} ({s.code})</option>)}
            </select>
          </div>
          <div>
            <label className="label" style={{ marginBottom: 6 }}>Teacher *</label>
            <select value={slotForm.teacher_id} onChange={(e) => setSlotForm((s) => ({ ...s, teacher_id: e.target.value }))} className="input">
              <option value="">Select Teacher</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" style={{ marginBottom: 6 }}>Room</label>
            <input value={slotForm.room} onChange={(e) => setSlotForm((s) => ({ ...s, room: e.target.value }))} className="input" placeholder="e.g., Room 204" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8 }}>
            <button onClick={() => setShowModal(false)} className="btn">Cancel</button>
            <button onClick={handleSaveSlot} disabled={saving} className="btn accent">{saving ? 'Saving...' : editingSlot ? 'Update' : 'Add Slot'}</button>
          </div>
        </div>
      </Modal>

      {/* ── Exam Modal ── */}
      <Modal open={showExamModal} onClose={() => setShowExamModal(false)} title={editingExam ? 'Edit Exam' : 'Add Exam Slot'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label" style={{ marginBottom: 6 }}>Subject</label>
              <select value={examForm.subject_id} onChange={(e) => setExamForm({ ...examForm, subject_id: e.target.value })} className="input">
                <option value="">Select Subject</option>
                {subjects.map((s) => <option key={s.id || s._id} value={s.id || s._id}>{s.name_en || s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" style={{ marginBottom: 6 }}>Grade</label>
              <select value={examForm.grade_level_id} onChange={(e) => setExamForm({ ...examForm, grade_level_id: e.target.value })} className="input">
                <option value="">Select Grade</option>
                {grades.map((g) => <option key={g.id || g._id} value={g.id || g._id}>{g.name_en || g.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label" style={{ marginBottom: 6 }}>Date</label>
              <input type="date" value={examForm.date} onChange={(e) => setExamForm({ ...examForm, date: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label" style={{ marginBottom: 6 }}>Time</label>
              <input type="time" value={examForm.time} onChange={(e) => setExamForm({ ...examForm, time: e.target.value })} className="input" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label" style={{ marginBottom: 6 }}>Room</label>
              <input value={examForm.room} onChange={(e) => setExamForm({ ...examForm, room: e.target.value })} className="input" placeholder="e.g., Hall A" />
            </div>
            <div>
              <label className="label" style={{ marginBottom: 6 }}>Exam Type</label>
              <select value={examForm.exam_type} onChange={(e) => setExamForm({ ...examForm, exam_type: e.target.value })} className="input">
                <option value="midterm">Midterm</option><option value="final">Final</option><option value="quiz">Quiz</option><option value="makeup">Makeup</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8 }}>
            <button onClick={() => setShowExamModal(false)} className="btn">Cancel</button>
            <button onClick={handleSaveExam} disabled={savingExam} className="btn accent">{savingExam ? 'Saving...' : editingExam ? 'Update' : 'Add Exam'}</button>
          </div>
        </div>
      </Modal>

      {/* ── Substitute Modal ── */}
      <Modal open={showSubModal} onClose={() => setShowSubModal(false)} title="Assign Substitute">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="label" style={{ marginBottom: 6 }}>Original Teacher</label>
            <select value={subForm.original_teacher_id} onChange={(e) => setSubForm({ ...subForm, original_teacher_id: e.target.value })} className="input">
              <option value="">Select Teacher</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" style={{ marginBottom: 6 }}>Substitute Teacher</label>
            <select value={subForm.substitute_teacher_id} onChange={(e) => setSubForm({ ...subForm, substitute_teacher_id: e.target.value })} className="input">
              <option value="">Select Substitute</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label" style={{ marginBottom: 6 }}>Date</label>
              <input type="date" value={subForm.date} onChange={(e) => setSubForm({ ...subForm, date: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label" style={{ marginBottom: 6 }}>Period</label>
              <select value={subForm.slot} onChange={(e) => setSubForm({ ...subForm, slot: parseInt(e.target.value) })} className="input">
                {PERIODS.map((p) => <option key={p.num} value={p.num}>Period {p.num}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label" style={{ marginBottom: 6 }}>Reason</label>
            <input value={subForm.reason} onChange={(e) => setSubForm({ ...subForm, reason: e.target.value })} className="input" placeholder="e.g., Sick leave" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8 }}>
            <button onClick={() => setShowSubModal(false)} className="btn">Cancel</button>
            <button onClick={handleSaveSub} disabled={savingSub} className="btn accent">{savingSub ? 'Saving...' : 'Assign'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
