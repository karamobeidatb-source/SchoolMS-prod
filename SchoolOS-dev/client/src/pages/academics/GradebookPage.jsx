import { useState, useEffect } from 'react';
import api from '../../utils/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import Modal from '../../components/Modal';
import { Save, Lock, Unlock, CheckCircle, AlertCircle, Sliders } from 'lucide-react';

const DEFAULT_CATEGORY_DEFS = [
  { key: 'homework', label: 'Homework', column: 'homework_weight', defaultWeight: 20 },
  { key: 'quiz', label: 'Quizzes', column: 'quizzes_weight', defaultWeight: 20 },
  { key: 'participation', label: 'Participation', column: 'participation_weight', defaultWeight: 10 },
  { key: 'midterm', label: 'Midterm', column: 'midterm_weight', defaultWeight: 25 },
  { key: 'final', label: 'Final', column: 'final_weight', defaultWeight: 25 },
  { key: 'project', label: 'Projects', column: 'projects_weight', defaultWeight: 0 },
];

function buildCategories(weightRow) {
  return DEFAULT_CATEGORY_DEFS
    .map((d) => ({
      key: d.key,
      label: d.label,
      column: d.column,
      weight: weightRow ? Number(weightRow[d.column] ?? 0) : d.defaultWeight,
    }))
    .filter((c) => c.weight > 0);
}

export default function GradebookPage() {
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [students, setStudents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [grades, setGrades] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(false);
  const [approved, setApproved] = useState(false);
  const [approving, setApproving] = useState(false);
  const [academicYear, setAcademicYear] = useState('2025-2026');
  const [semester, setSemester] = useState('2');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [showWeights, setShowWeights] = useState(false);
  const [weightDraft, setWeightDraft] = useState({});
  const [savingWeights, setSavingWeights] = useState(false);
  const [hoveredRow, setHoveredRow] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/sections'),
      api.get('/subjects'),
      api.get('/settings').catch(() => ({ data: [] })),
    ]).then(([secRes, subRes, setRes]) => {
      const settings = Array.isArray(setRes.data) ? setRes.data : [];
      const ayS = settings.find(s => s.key === 'academic_year');
      const semS = settings.find(s => s.key === 'current_semester');
      if (ayS) setAcademicYear(ayS.value);
      if (semS) setSemester(semS.value);
      const secs = Array.isArray(secRes.data) ? secRes.data : [];
      const subs = Array.isArray(subRes.data) ? subRes.data : [];
      setSections(secs);
      setSubjects(subs);
      if (secs.length) setSelectedSection(secs[0].id || secs[0]._id);
      if (subs.length) setSelectedSubject(subs[0].id || subs[0]._id);
    }).catch((err) => {
      const msg = err.response?.data?.error || err.message || 'Failed to load sections/subjects';
      setError(msg);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedSection || !selectedSubject) return;
    setLoading(true);
    Promise.all([
      api.get('/students', { params: { section_id: selectedSection, status: 'active' } }),
      api.get('/grades', { params: { section_id: selectedSection, subject_id: selectedSubject, semester } }),
      api.get('/grading-weights', { params: { subject_id: selectedSubject, academic_year: academicYear, semester } }).catch(() => ({ data: [] })),
    ]).then(([studRes, gradeRes, weightRes]) => {
      const studs = studRes.data.students || studRes.data || [];
      setStudents(studs);
      const weightRows = Array.isArray(weightRes.data) ? weightRes.data : [];
      setCategories(buildCategories(weightRows[0]));
      const gmap = {};
      const rows = Array.isArray(gradeRes.data) ? gradeRes.data : (gradeRes.data.grades || []);
      rows.forEach((g) => {
        const sid = g.student_id || g.student || g.studentId;
        if (!gmap[sid]) gmap[sid] = {};
        gmap[sid][g.category] = g.score;
      });
      setGrades(gmap);
      setLocked(rows.length > 0 && rows.every((g) => g.is_locked));
      setApproved(rows.length > 0 && rows.every((g) => g.approved_by));
    }).catch(() => {
      setStudents([]);
      setGrades({});
      setCategories(buildCategories(null));
    }).finally(() => setLoading(false));
  }, [selectedSection, selectedSubject, semester, academicYear]);

  const updateGrade = (studentId, category, value) => {
    if (locked) return;
    const cat = categories.find((c) => c.key === category);
    const max = cat?.weight ?? 100;
    let num = value === '' ? '' : parseFloat(value);
    if (num !== '' && !Number.isNaN(num)) {
      num = Math.min(Math.max(num, 0), max);
    }
    setGrades((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [category]: num },
    }));
  };

  const calcTotal = (studentId) => {
    const sg = grades[studentId] || {};
    let total = 0;
    categories.forEach((cat) => {
      const score = parseFloat(sg[cat.key]) || 0;
      const capped = Math.min(Math.max(score, 0), cat.weight || 0);
      total += capped;
    });
    return total.toFixed(1);
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    const promises = [];
    let failed = 0;
    students.forEach((s) => {
      const sid = s.id || s._id;
      categories.forEach((cat) => {
        const score = grades[sid]?.[cat.key];
        if (score !== undefined && score !== '') {
          promises.push(
            api.post('/grades', {
              student_id: sid,
              subject_id: selectedSubject,
              category: cat.key,
              score: parseFloat(score) || 0,
              max_score: cat.weight,
              academic_year: academicYear,
              semester: semester,
              title: cat.label,
            }).catch((err) => {
              failed++;
              console.error('Save grade failed:', err.response?.data || err.message);
            })
          );
        }
      });
    });
    await Promise.all(promises);
    setSaving(false);
    if (failed > 0) {
      setError(`${failed} grade${failed > 1 ? 's' : ''} failed to save. Check console.`);
    } else if (promises.length > 0) {
      setToast(`Saved ${promises.length} grade${promises.length > 1 ? 's' : ''}.`);
      setTimeout(() => setToast(''), 2500);
    } else {
      setToast('Nothing to save.');
      setTimeout(() => setToast(''), 2000);
    }
  };

  const handleLock = async () => {
    setError('');
    try {
      const endpoint = locked ? '/grades/unlock' : '/grades/lock';
      await api.post(endpoint, { subject_id: selectedSubject, section_id: selectedSection, academic_year: academicYear, semester });
      setLocked(!locked);
      setToast(locked ? 'Grades unlocked.' : 'Grades locked.');
      setTimeout(() => setToast(''), 2500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to toggle lock.');
    }
  };

  const openWeightEditor = () => {
    const draft = {};
    for (const d of DEFAULT_CATEGORY_DEFS) {
      const cat = categories.find((c) => c.key === d.key);
      draft[d.key] = cat ? cat.weight : 0;
    }
    setWeightDraft(draft);
    setShowWeights(true);
  };

  const weightSum = Object.values(weightDraft).reduce((s, v) => s + (parseFloat(v) || 0), 0);

  const handleSaveWeights = async () => {
    if (Math.round(weightSum * 10) !== 1000) {
      setError('Weights must sum to exactly 100.');
      return;
    }
    if (savingWeights) return;
    setSavingWeights(true);
    setError('');
    try {
      const payload = {
        subject_id: Number(selectedSubject),
        academic_year: academicYear,
        semester,
        homework_weight: parseFloat(weightDraft.homework) || 0,
        quizzes_weight: parseFloat(weightDraft.quiz) || 0,
        participation_weight: parseFloat(weightDraft.participation) || 0,
        midterm_weight: parseFloat(weightDraft.midterm) || 0,
        final_weight: parseFloat(weightDraft.final) || 0,
        projects_weight: parseFloat(weightDraft.project) || 0,
      };
      const res = await api.post('/grading-weights', payload);
      setCategories(buildCategories(res.data));
      setShowWeights(false);
      setToast('Mark distribution updated.');
      setTimeout(() => setToast(''), 2500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save weights.');
    } finally {
      setSavingWeights(false);
    }
  };

  const handleApprove = async () => {
    if (approving) return;
    setApproving(true);
    setError('');
    try {
      await api.post('/grades/approve', {
        subject_id: selectedSubject,
        section_id: selectedSection,
        academic_year: academicYear,
        semester,
      });
      setApproved(true);
      setLocked(true);
      setToast('Grades approved.');
      setTimeout(() => setToast(''), 2500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to approve grades.');
    }
    setApproving(false);
  };

  if (loading && sections.length === 0) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold font-heading" style={{ color: 'var(--text-primary)' }}>Gradebook</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Manage student grades by section and subject</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleApprove}
            disabled={approving || approved || students.length === 0 || !selectedSection || !selectedSubject}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            style={
              approved
                ? { borderColor: 'var(--success-border)', color: 'var(--success-text)', backgroundColor: 'var(--success-subtle)' }
                : { borderColor: 'var(--accent-border, var(--border-default))', color: 'var(--accent-text, var(--text-secondary))' }
            }
          >
            <CheckCircle className="w-4 h-4" /> {approved ? 'Approved' : approving ? 'Approving...' : 'Approve'}
          </button>
          <button
            onClick={handleLock}
            disabled={!selectedSection || !selectedSubject}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            style={
              locked
                ? { borderColor: 'var(--success-border)', color: 'var(--success-text)' }
                : { borderColor: 'var(--warning-border)', color: 'var(--warning-text)' }
            }
          >
            {locked ? <><Unlock className="w-4 h-4" /> Unlock</> : <><Lock className="w-4 h-4" /> Lock Grades</>}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || locked || students.length === 0}
            className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {error && (
        <div
          className="mb-4 p-3 rounded-lg text-sm flex items-center gap-2"
          style={{ backgroundColor: 'var(--error-subtle)', border: '1px solid var(--error-border)', color: 'var(--error-text)' }}
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}
      {toast && (
        <div
          className="mb-4 p-3 rounded-lg text-sm flex items-center gap-2"
          style={{ backgroundColor: 'var(--success-subtle)', border: '1px solid var(--success-border)', color: 'var(--success-text)' }}
        >
          <CheckCircle className="w-4 h-4 flex-shrink-0" /> {toast}
        </div>
      )}

      {/* Selectors */}
      <div className="card p-4 mb-4 flex flex-wrap items-center gap-4">
        <div>
          <label className="label block text-xs font-medium mb-1">Section</label>
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            disabled={sections.length === 0}
            className="input min-w-[180px] px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {sections.length === 0 && <option value="">No sections available</option>}
            {sections.map((s) => {
              const grade = s.grade_name_en ? `${s.grade_name_en} — ` : '';
              return <option key={s.id || s._id} value={s.id || s._id}>{grade}{s.name_en || s.name}</option>;
            })}
          </select>
        </div>
        <div>
          <label className="label block text-xs font-medium mb-1">Subject</label>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            disabled={subjects.length === 0}
            className="input min-w-[180px] px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {subjects.length === 0 && <option value="">No subjects available</option>}
            {subjects.map((s) => <option key={s.id || s._id} value={s.id || s._id}>{s.name_en || s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label block text-xs font-medium mb-1">Semester</label>
          <select
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            className="input px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="1">Semester 1</option>
            <option value="2">Semester 2</option>
          </select>
        </div>
        <button
          onClick={openWeightEditor}
          disabled={!selectedSubject || locked}
          className="btn-secondary self-end flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
          title="Edit mark distribution for this subject"
        >
          <Sliders className="w-4 h-4" /> Edit Distribution
        </button>
        {locked && (
          <div className="ml-auto flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--warning-text)' }}>
            <Lock className="w-4 h-4" /> Grades are locked
          </div>
        )}
        {approved && (
          <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--success-text)' }}>
            <CheckCircle className="w-4 h-4" /> Grades approved
          </div>
        )}
      </div>

      <Modal open={showWeights} onClose={() => setShowWeights(false)} title="Mark Distribution" size="md">
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          Set the point value of each category for this subject in semester {semester}. The total must equal 100.
        </p>
        <div className="space-y-3">
          {DEFAULT_CATEGORY_DEFS.map((d) => (
            <div key={d.key} className="flex items-center gap-3">
              <label className="label flex-1 text-sm font-medium">{d.label}</label>
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={weightDraft[d.key] ?? 0}
                onChange={(e) => setWeightDraft((prev) => ({ ...prev, [d.key]: e.target.value }))}
                className="input w-24 px-3 py-2 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm w-12" style={{ color: 'var(--text-tertiary)' }}>pts</span>
            </div>
          ))}
        </div>
        <div
          className="mt-4 p-3 rounded-lg text-sm font-medium flex items-center justify-between"
          style={
            Math.round(weightSum * 10) === 1000
              ? { backgroundColor: 'var(--success-subtle)', color: 'var(--success-text)' }
              : { backgroundColor: 'var(--warning-subtle)', color: 'var(--warning-text)' }
          }
        >
          <span>Total</span>
          <span>{weightSum.toFixed(1)} / 100</span>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={() => setShowWeights(false)}
            className="btn-secondary px-4 py-2 rounded-lg text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveWeights}
            disabled={savingWeights || Math.round(weightSum * 10) !== 1000}
            className="btn-primary px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {savingWeights ? 'Saving...' : 'Save Distribution'}
          </button>
        </div>
      </Modal>

      {/* Grade Grid */}
      {loading ? <LoadingSpinner /> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: 'var(--surface-secondary)', borderBottom: '1px solid var(--border-default)' }}>
                <th className="px-4 py-3 text-left font-medium sticky left-0" style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--surface-secondary)' }}>#</th>
                <th className="px-4 py-3 text-left font-medium sticky left-8 min-w-[180px]" style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--surface-secondary)' }}>Student</th>
                {categories.map((cat) => (
                  <th key={cat.key} className="px-4 py-3 text-center font-medium min-w-[100px]" style={{ color: 'var(--text-secondary)' }}>
                    <div>{cat.label}</div>
                    <div className="text-xs font-normal" style={{ color: 'var(--text-tertiary)' }}>/ {cat.weight} pts</div>
                  </th>
                ))}
                <th className="px-4 py-3 text-center font-medium min-w-[80px]" style={{ color: 'var(--text-primary)' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr><td colSpan={categories.length + 3} className="px-4 py-12 text-center" style={{ color: 'var(--text-tertiary)' }}>No students in this section</td></tr>
              ) : (
                students.map((student, idx) => {
                  const sid = student.id || student._id;
                  const displayName = student.first_name ? `${student.first_name} ${student.last_name || ''}`.trim() : (student.nameEn || student.name);
                  const isHovered = hoveredRow === sid;
                  return (
                    <tr
                      key={sid}
                      style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: isHovered ? 'var(--surface-hover)' : 'transparent' }}
                      onMouseEnter={() => setHoveredRow(sid)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      <td className="px-4 py-2 sticky left-0" style={{ color: 'var(--text-tertiary)', backgroundColor: isHovered ? 'var(--surface-hover)' : 'var(--surface-primary)' }}>{idx + 1}</td>
                      <td className="px-4 py-2 font-medium sticky left-8" style={{ color: 'var(--text-primary)', backgroundColor: isHovered ? 'var(--surface-hover)' : 'var(--surface-primary)' }}>{displayName}</td>
                      {categories.map((cat) => (
                        <td key={cat.key} className="px-4 py-2 text-center">
                          <input
                            type="number"
                            min="0"
                            max={cat.weight}
                            step="0.5"
                            value={grades[sid]?.[cat.key] ?? ''}
                            onChange={(e) => updateGrade(sid, cat.key, e.target.value)}
                            disabled={locked}
                            className="w-16 px-2 py-1 text-center rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                            style={{
                              backgroundColor: 'var(--surface-secondary)',
                              border: '1px solid var(--border-default)',
                              color: 'var(--text-primary)',
                            }}
                          />
                        </td>
                      ))}
                      <td className="px-4 py-2 text-center font-bold" style={{ color: 'var(--text-primary)' }}>{calcTotal(sid)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
