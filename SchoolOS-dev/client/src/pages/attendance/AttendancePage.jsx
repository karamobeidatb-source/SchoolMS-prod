import { useState, useEffect, useMemo } from 'react';
import api from '../../utils/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Save, CheckCircle, XCircle, Clock, AlertCircle, CheckCheck, Inbox } from 'lucide-react';

const statusConfig = {
  present: { bg: 'var(--success-subtle)', color: 'var(--success-text)', border: 'var(--success-border)', icon: CheckCircle, label: 'Present' },
  absent: { bg: 'var(--error-subtle)', color: 'var(--error-text)', border: 'var(--error-border)', icon: XCircle, label: 'Absent' },
  late: { bg: 'var(--warning-subtle)', color: 'var(--warning-text)', border: 'var(--warning-border)', icon: Clock, label: 'Late' },
  excused: { bg: 'var(--info-subtle)', color: 'var(--info-text)', border: 'var(--info-border)', icon: AlertCircle, label: 'Excused' },
};

export default function AttendancePage() {
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));
  const [grades, setGrades] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [students, setStudents] = useState([]);
  const [records, setRecords] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/grade-levels').catch(() => ({ data: [] })),
      api.get('/sections').catch(() => ({ data: [] })),
    ]).then(([gradeRes, secRes]) => {
      setGrades(gradeRes.data || []);
      setSections(secRes.data || []);
    });
  }, []);

  const visibleSections = useMemo(() => {
    const filtered = selectedGrade
      ? sections.filter((s) => String(s.grade_level_id) === String(selectedGrade))
      : [];
    const seenIds = new Set();
    const seenNames = new Set();
    return filtered.filter((s) => {
      const id = s.id ?? s._id;
      const name = (s.name_en || s.name || '').trim().toLowerCase();
      if (!name) return false;
      if (id != null && seenIds.has(id)) return false;
      if (seenNames.has(name)) return false;
      if (id != null) seenIds.add(id);
      seenNames.add(name);
      return true;
    });
  }, [sections, selectedGrade]);

  useEffect(() => {
    if (!selectedSection) { setStudents([]); setRecords({}); return; }
    setLoading(true);
    Promise.all([
      api.get('/students', { params: { section_id: selectedSection, status: 'active' } }),
      api.get('/attendance', { params: { section_id: selectedSection, date } }),
    ])
      .then(([studRes, attRes]) => {
        const studs = studRes.data.students || studRes.data || [];
        setStudents(studs);
        const recs = {};
        (attRes.data.records || attRes.data || []).forEach((r) => {
          recs[r.student_id || r.student || r.studentId] = r.status;
        });
        studs.forEach((s) => {
          const sid = s._id || s.id;
          if (!recs[sid]) recs[sid] = 'present';
        });
        setRecords(recs);
      })
      .catch(() => { setStudents([]); setRecords({}); })
      .finally(() => setLoading(false));
  }, [selectedSection, date]);

  const setStatus = (studentId, status) => {
    setRecords((prev) => ({ ...prev, [studentId]: status }));
    setSaved(false);
  };

  const markAllPresent = () => {
    const updated = {};
    students.forEach((s) => { updated[s._id || s.id] = 'present'; });
    setRecords(updated);
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = students.map((s) => ({
      student_id: s.id || s._id,
      status: records[s.id || s._id] || 'present',
    }));
    try {
      await api.post('/attendance/bulk', { section_id: selectedSection, date, period: 1, records: payload });
      setSaved(true);
    } catch {}
    setSaving(false);
  };

  const summary = Object.values(records);
  const counts = {
    present: summary.filter((s) => s === 'present').length,
    absent: summary.filter((s) => s === 'absent').length,
    late: summary.filter((s) => s === 'late').length,
    excused: summary.filter((s) => s === 'excused').length,
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold font-heading" style={{ color: 'var(--text-primary)' }}>Attendance</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Mark daily attendance for each section</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={markAllPresent}
            disabled={!selectedSection || students.length === 0}
            className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCheck className="w-4 h-4" /> Mark All Present
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !selectedSection || students.length === 0}
            className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="card p-4 mb-4 flex flex-wrap items-center gap-4">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Grade</label>
          <select
            value={selectedGrade}
            onChange={(e) => { setSelectedGrade(e.target.value); setSelectedSection(''); }}
            className="input px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Grades</option>
            {grades.map((g) => (
              <option key={g.id || g._id} value={g.id || g._id}>{g.name_en || g.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Section</label>
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            disabled={!selectedGrade}
            title={!selectedGrade ? 'Select a Grade first' : ''}
            className="input px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">{selectedGrade ? 'Select Section' : 'Select a Grade first'}</option>
            {visibleSections.map((s) => (
              <option key={s.id || s._id} value={s.id || s._id}>{s.name_en || s.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-4 ml-auto text-sm">
          <span className="font-medium" style={{ color: 'var(--success-text)' }}>{counts.present} Present</span>
          <span className="font-medium" style={{ color: 'var(--error-text)' }}>{counts.absent} Absent</span>
          <span className="font-medium" style={{ color: 'var(--warning-text)' }}>{counts.late} Late</span>
          <span className="font-medium" style={{ color: 'var(--info-text)' }}>{counts.excused} Excused</span>
        </div>
      </div>

      {/* Student List */}
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="card">
          {students.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12" style={{ color: 'var(--text-tertiary)' }}>
              <Inbox className="w-10 h-10" strokeWidth={1.25} />
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                {selectedSection ? 'No students in this section' : 'Select a Grade and Section to load students'}
              </p>
            </div>
          ) : (
            students.map((student, idx) => {
              const sid = student._id || student.id;
              const currentStatus = records[sid] || 'present';
              return (
                <div
                  key={sid}
                  className="flex items-center gap-4 px-4 py-3"
                  style={idx < students.length - 1 ? { borderBottom: '1px solid var(--border-subtle)' } : undefined}
                >
                  <span className="text-sm w-8" style={{ color: 'var(--text-tertiary)' }}>{idx + 1}</span>
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center font-medium text-xs flex-shrink-0"
                    style={{ backgroundColor: 'var(--accent-subtle)', color: 'var(--accent)' }}
                  >
                    {(student.first_name || student.nameEn || student.name || '?')[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{student.first_name ? `${student.first_name} ${student.last_name || ''}`.trim() : (student.nameEn || student.name)}</p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{student.student_number || student.studentNumber || ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {Object.entries(statusConfig).map(([key, cfg]) => {
                      const Icon = cfg.icon;
                      return (
                        <button
                          key={key}
                          onClick={() => setStatus(sid, key)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                          style={{
                            backgroundColor: currentStatus === key ? cfg.bg : 'var(--surface-primary)',
                            color: currentStatus === key ? cfg.color : 'var(--text-tertiary)',
                            border: `1px solid ${currentStatus === key ? cfg.border : 'var(--border-default)'}`,
                          }}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{cfg.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
