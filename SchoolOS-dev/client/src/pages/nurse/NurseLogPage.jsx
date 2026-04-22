import { useState, useEffect } from 'react';
import api from '../../utils/api';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Plus, HeartPulse, Filter, Search, Bell } from 'lucide-react';

export default function NurseLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [dateFilter, setDateFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [students, setStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    student_id: '', incident_type: 'illness', description: '', action_taken: '', parent_notified: false,
  });

  useEffect(() => {
    api.get('/nurse-log', { params: { date: dateFilter || undefined, incident_type: typeFilter || undefined } })
      .then((res) => setLogs(res.data.entries || res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dateFilter, typeFilter]);

  const searchStudents = async (q) => {
    setStudentSearch(q);
    if (q.length < 2) { setStudents([]); return; }
    try {
      const res = await api.get('/students', { params: { search: q, status: 'active' } });
      setStudents(res.data.students || res.data || []);
    } catch { setStudents([]); }
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      await api.post('/nurse-log', form);
      const res = await api.get('/nurse-log');
      setLogs(res.data.entries || res.data || []);
      setShowCreate(false);
      setForm({ student_id: '', incident_type: 'illness', description: '', action_taken: '', parent_notified: false });
      setStudentSearch('');
    } catch {}
    setSaving(false);
  };

  const typeMap = {
    illness: 'danger', injury: 'warning', medication: 'info', checkup: 'success', other: 'gray',
  };

  const columns = [
    { key: 'date', header: 'Date', accessor: (r) => (r.created_at || r.date)?.substring(0, 10) || '' },
    { key: 'student', header: 'Student', accessor: (r) => r.student_name || r.studentName || r.student || '', render: (r) => <span className="font-medium">{r.student_name || r.studentName || r.student || 'N/A'}</span> },
    { key: 'type', header: 'Type', render: (r) => <Badge variant={typeMap[r.incident_type || r.type] || 'gray'}>{r.incident_type || r.type}</Badge>, accessor: (r) => r.incident_type || r.type || '' },
    { key: 'description', header: 'Description', accessor: (r) => r.description || '' },
    { key: 'treatment', header: 'Action Taken', accessor: (r) => r.action_taken || r.treatment || '-' },
    {
      key: 'notified',
      header: 'Parent Notified',
      render: (r) => (r.parent_notified || r.parentNotified) ? <Badge variant="success">Yes</Badge> : <Badge variant="gray">No</Badge>,
    },
  ];

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold font-heading" style={{ color: 'var(--text-primary)' }}>Nurse Log</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{logs.length} entries</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> New Entry
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Filter className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
          <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="input px-3 py-1.5 rounded-lg text-sm" />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input px-3 py-1.5 rounded-lg text-sm">
            <option value="">All Types</option>
            <option value="illness">Illness</option>
            <option value="injury">Injury</option>
            <option value="medication">Medication</option>
            <option value="checkup">Checkup</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      <div className="card p-4">
        <DataTable columns={columns} data={logs} emptyMessage="No nurse log entries found" />
      </div>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Nurse Log Entry" size="lg">
        <div className="space-y-4">
          <div>
            <label className="label">Student *</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
              <input
                value={studentSearch}
                onChange={(e) => searchStudents(e.target.value)}
                placeholder="Search student..."
                className="input w-full pl-10 pr-4 py-2 rounded-lg text-sm"
              />
            </div>
            {students.length > 0 && (
              <div className="mt-1 rounded-lg max-h-32 overflow-y-auto" style={{ border: '1px solid var(--border-default)' }}>
                {students.map((s) => (
                  <button
                    key={s._id || s.id}
                    onClick={() => { const sName = s.first_name ? `${s.first_name} ${s.last_name || ''}`.trim() : (s.nameEn || s.name); setForm({ ...form, student_id: s.id || s._id }); setStudentSearch(sName); setStudents([]); }}
                    className="w-full text-left px-3 py-2 text-sm hover:opacity-80"
                    style={{ backgroundColor: 'var(--surface-secondary)' }}
                  >
                    {s.first_name ? `${s.first_name} ${s.last_name || ''}`.trim() : (s.nameEn || s.name)} <span style={{ color: 'var(--text-tertiary)' }}>#{s.student_number || s.studentNumber}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Type</label>
              <select value={form.incident_type} onChange={(e) => setForm({ ...form, incident_type: e.target.value })} className="input w-full px-3 py-2 rounded-lg text-sm">
                <option value="illness">Illness</option>
                <option value="injury">Injury</option>
                <option value="medication">Medication</option>
                <option value="checkup">Checkup</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div />
          </div>
          <div>
            <label className="label">Description *</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="input w-full px-3 py-2 rounded-lg text-sm" />
          </div>
          <div>
            <label className="label">Action Taken</label>
            <textarea value={form.action_taken} onChange={(e) => setForm({ ...form, action_taken: e.target.value })} rows={2} className="input w-full px-3 py-2 rounded-lg text-sm" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.parent_notified} onChange={(e) => setForm({ ...form, parent_notified: e.target.checked })} className="w-4 h-4 rounded" style={{ accentColor: 'var(--accent)' }} />
            <Bell className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Notify parent/guardian</span>
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowCreate(false)} className="btn-secondary px-4 py-2 rounded-lg text-sm font-medium">Cancel</button>
            <button onClick={handleCreate} disabled={saving} className="btn-primary px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60">{saving ? 'Saving...' : 'Save Entry'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
