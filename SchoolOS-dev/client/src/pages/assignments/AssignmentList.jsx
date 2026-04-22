import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Plus, Calendar, Filter, List, LayoutGrid, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function AssignmentList() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', subject_id: '', section_id: '', due_date: '', max_score: 100 });
  const [sections, setSections] = useState([]);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // list | calendar
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [completionRate, setCompletionRate] = useState(null);
  const [selectedSectionForRate, setSelectedSectionForRate] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/assignments', { params: { subject_id: subjectFilter || undefined } }),
      api.get('/subjects').catch(() => ({ data: [] })),
      api.get('/sections').catch(() => ({ data: [] })),
    ]).then(([assRes, subRes, secRes]) => {
      setAssignments(assRes.data.assignments || assRes.data || []);
      setSubjects(subRes.data || []);
      const secs = secRes.data || [];
      setSections(secs);
      if (secs.length && !selectedSectionForRate) setSelectedSectionForRate(secs[0].id || secs[0]._id);
    }).catch(() => setAssignments([]))
    .finally(() => setLoading(false));
  }, [subjectFilter, statusFilter]);

  // Fetch completion rate
  useEffect(() => {
    if (!selectedSectionForRate) return;
    api.get('/grades/completion-rate', { params: { section_id: selectedSectionForRate } })
      .then((res) => setCompletionRate(res.data.rate || res.data.completion_rate || res.data || null))
      .catch(() => setCompletionRate(null));
  }, [selectedSectionForRate]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await api.post('/assignments', form);
      setShowCreate(false);
      setForm({ title: '', description: '', subject_id: '', section_id: '', due_date: '', max_score: 100 });
      const res = await api.get('/assignments');
      setAssignments(res.data.assignments || res.data || []);
    } catch {}
    setSaving(false);
  };

  const isOverdue = (dueDate) => {
    const d = dueDate || '';
    return d && new Date(d) < new Date();
  };

  const columns = [
    { key: 'title', header: 'Title', accessor: 'title', render: (r) => <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{r.title}</span> },
    { key: 'subject', header: 'Subject', accessor: (r) => r.subject_name || r.subjectName || r.subject || '' },
    { key: 'section', header: 'Section', accessor: (r) => r.section_name || r.sectionName || r.section || '' },
    {
      key: 'dueDate',
      header: 'Due Date',
      render: (r) => {
        const dd = r.due_date || r.dueDate;
        const overdue = isOverdue(dd) && r.status !== 'completed';
        return (
          <span className="flex items-center gap-1 font-medium" style={{ color: overdue ? 'var(--error-text)' : 'var(--text-secondary)' }}>
            <Calendar className="w-3.5 h-3.5" />
            {dd?.substring(0, 10) || 'No date'}
          </span>
        );
      },
      accessor: (r) => r.due_date || r.dueDate || '',
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => {
        const m = { active: 'info', completed: 'success', draft: 'gray', overdue: 'danger' };
        const status = isOverdue(r.dueDate) && r.status !== 'completed' ? 'overdue' : (r.status || 'active');
        return <Badge variant={m[status] || 'gray'}>{status}</Badge>;
      },
    },
    { key: 'submissions', header: 'Submissions', accessor: (r) => `${r.submissionCount || 0}/${r.totalStudents || 0}` },
  ];

  // Calendar helpers
  const calYear = calendarMonth.getFullYear();
  const calMonth = calendarMonth.getMonth();
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const calDays = [];
  for (let i = 0; i < firstDay; i++) calDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calDays.push(d);

  const getAssignmentsForDay = (day) => {
    if (!day) return [];
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return assignments.filter((a) => {
      const dd = (a.due_date || a.dueDate || '')?.substring(0, 10);
      return dd === dateStr;
    });
  };

  const prevMonth = () => setCalendarMonth(new Date(calYear, calMonth - 1, 1));
  const nextMonth = () => setCalendarMonth(new Date(calYear, calMonth + 1, 1));

  const rateValue = typeof completionRate === 'object' ? (completionRate?.rate ?? completionRate?.percentage ?? 0) : (completionRate ?? 0);
  const ratePercent = typeof rateValue === 'number' ? (rateValue > 1 ? rateValue : rateValue * 100) : 0;

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold font-heading" style={{ color: 'var(--text-primary)' }}>Assignments</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{assignments.length} assignments</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg p-1" style={{ backgroundColor: 'var(--surface-secondary)' }}>
            <button
              onClick={() => setViewMode('list')}
              className="p-1.5 rounded"
              style={viewMode === 'list' ? { backgroundColor: 'var(--surface-primary)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' } : {}}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className="p-1.5 rounded"
              style={viewMode === 'calendar' ? { backgroundColor: 'var(--surface-primary)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' } : {}}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          {hasPermission('assignments.create') && (
            <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium">
              <Plus className="w-4 h-4" /> Create Assignment
            </button>
          )}
        </div>
      </div>

      {/* Completion Rate */}
      <div className="card p-4 mb-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="label text-xs font-medium">Completion Rate for:</label>
            <select
              value={selectedSectionForRate}
              onChange={(e) => setSelectedSectionForRate(e.target.value)}
              className="input px-2 py-1 rounded text-sm"
            >
              {sections.map((s) => <option key={s.id || s._id} value={s.id || s._id}>{s.name_en || s.name}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="flex-1 rounded-full h-4" style={{ backgroundColor: 'var(--surface-secondary)' }}>
                <div
                  className="h-4 rounded-full transition-all"
                  style={{ width: `${Math.min(100, ratePercent)}%`, backgroundColor: 'var(--accent)' }}
                />
              </div>
              <span className="text-sm font-medium w-14 text-right" style={{ color: 'var(--text-primary)' }}>{ratePercent.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-4 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Filter className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
          <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} className="input px-3 py-1.5 text-sm">
            <option value="">All Subjects</option>
            {subjects.map((s) => <option key={s.id || s._id} value={s.id || s._id}>{s.name_en || s.name}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input px-3 py-1.5 text-sm">
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {viewMode === 'list' ? (
        <div className="card p-4">
          <DataTable
            columns={columns}
            data={assignments}
            onRowClick={(row) => navigate(`/assignments/${row._id || row.id}`)}
          />
        </div>
      ) : (
        /* Calendar View */
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={prevMonth}
              className="p-2 rounded-lg"
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="text-sm font-semibold font-heading" style={{ color: 'var(--text-primary)' }}>
              {calendarMonth.toLocaleString('en', { month: 'long', year: 'numeric' })}
            </h3>
            <button
              onClick={nextMonth}
              className="p-2 rounded-lg"
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-px rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--border-default)' }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="px-2 py-2 text-center text-xs font-medium" style={{ backgroundColor: 'var(--surface-secondary)', color: 'var(--text-secondary)' }}>{d}</div>
            ))}
            {calDays.map((day, i) => {
              const dayAssignments = getAssignmentsForDay(day);
              return (
                <div key={i} className="min-h-[80px] px-2 py-1" style={{ backgroundColor: day ? 'var(--surface-primary)' : 'var(--surface-secondary)' }}>
                  {day && (
                    <>
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{day}</span>
                      <div className="mt-1 space-y-1">
                        {dayAssignments.slice(0, 3).map((a, j) => (
                          <div
                            key={j}
                            className="text-xs px-1.5 py-0.5 rounded truncate cursor-pointer"
                            style={{ backgroundColor: 'var(--accent-subtle)', color: 'var(--accent)' }}
                            title={a.title}
                            onClick={() => navigate(`/assignments/${a._id || a.id}`)}
                            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                          >
                            {a.title}
                          </div>
                        ))}
                        {dayAssignments.length > 3 && (
                          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>+{dayAssignments.length - 3} more</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Assignment" size="lg">
        <div className="space-y-4">
          <div>
            <label className="label block text-sm font-medium mb-1">Title *</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input w-full px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="label block text-sm font-medium mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="input w-full px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label block text-sm font-medium mb-1">Subject</label>
              <select value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })} className="input w-full px-3 py-2 text-sm">
                <option value="">Select</option>
                {subjects.map((s) => <option key={s.id || s._id} value={s.id || s._id}>{s.name_en || s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label block text-sm font-medium mb-1">Section</label>
              <select value={form.section_id} onChange={(e) => setForm({ ...form, section_id: e.target.value })} className="input w-full px-3 py-2 text-sm">
                <option value="">Select</option>
                {sections.map((s) => <option key={s.id || s._id} value={s.id || s._id}>{s.name_en || s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label block text-sm font-medium mb-1">Due Date</label>
              <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="input w-full px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="label block text-sm font-medium mb-1">Max Score</label>
              <input type="number" value={form.max_score} onChange={(e) => setForm({ ...form, max_score: e.target.value })} className="input w-full px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowCreate(false)} className="btn-secondary px-4 py-2 rounded-lg text-sm font-medium">Cancel</button>
            <button onClick={handleCreate} disabled={saving} className="btn-primary px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60">{saving ? 'Creating...' : 'Create'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
