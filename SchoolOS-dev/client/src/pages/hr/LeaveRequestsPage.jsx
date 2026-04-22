import { useState, useEffect } from 'react';
import api from '../../utils/api';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Check, X, Calendar, Filter } from 'lucide-react';

export default function LeaveRequestsPage() {
  const { hasPermission } = useAuth();
  const canApprove = hasPermission('leave.approve');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState('list');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ leave_type: 'annual', start_date: '', end_date: '', reason: '' });

  useEffect(() => {
    api.get('/leave-requests', { params: { status: statusFilter || undefined } })
      .then((res) => setRequests(res.data.requests || res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await api.post('/leave-requests', form);
      const res = await api.get('/leave-requests');
      setRequests(res.data.requests || res.data || []);
      setShowCreate(false);
      setForm({ leave_type: 'annual', start_date: '', end_date: '', reason: '' });
    } catch {}
    setSaving(false);
  };

  const handleApprove = async (id) => {
    try {
      await api.put(`/leave-requests/${id}`, { status: 'approved' });
      const res = await api.get('/leave-requests', { params: { status: statusFilter || undefined } });
      setRequests(res.data.requests || res.data || []);
    } catch {}
  };

  const handleReject = async (id) => {
    try {
      await api.put(`/leave-requests/${id}`, { status: 'rejected' });
      const res = await api.get('/leave-requests', { params: { status: statusFilter || undefined } });
      setRequests(res.data.requests || res.data || []);
    } catch {}
  };

  const statusColors = { pending: 'warning', approved: 'success', rejected: 'danger' };
  const typeColors = { annual: 'info', sick: 'danger', personal: 'purple', maternity: 'success', other: 'gray' };

  const columns = [
    {
      key: 'staff',
      header: 'Staff Member',
      accessor: (r) => r.user_name || r.staffName || r.staff || '',
      render: (r) => <span className="font-medium">{r.user_name || r.staffName || r.staff || 'N/A'}</span>,
    },
    { key: 'type', header: 'Type', render: (r) => <Badge variant={typeColors[r.leave_type || r.type] || 'gray'}>{r.leave_type || r.type}</Badge>, accessor: (r) => r.leave_type || r.type || '' },
    { key: 'startDate', header: 'From', accessor: (r) => (r.start_date || r.startDate)?.substring(0, 10) || '' },
    { key: 'endDate', header: 'To', accessor: (r) => (r.end_date || r.endDate)?.substring(0, 10) || '' },
    {
      key: 'days',
      header: 'Days',
      accessor: (r) => {
        if (r.days) return r.days;
        const sd = r.start_date || r.startDate;
        const ed = r.end_date || r.endDate;
        if (sd && ed) {
          const diff = (new Date(ed) - new Date(sd)) / (1000 * 60 * 60 * 24) + 1;
          return Math.max(1, Math.round(diff));
        }
        return '-';
      },
    },
    { key: 'status', header: 'Status', render: (r) => <Badge variant={statusColors[r.status] || 'gray'}>{r.status}</Badge>, accessor: 'status' },
    ...(canApprove ? [{
      key: 'actions',
      header: 'Actions',
      sortable: false,
      render: (r) => r.status === 'pending' ? (
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); handleApprove(r._id || r.id); }} className="p-1.5 rounded-lg" style={{ backgroundColor: 'var(--success-subtle)', color: 'var(--success-text)' }} title="Approve">
            <Check className="w-4 h-4" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); handleReject(r._id || r.id); }} className="p-1.5 rounded-lg" style={{ backgroundColor: 'var(--error-subtle)', color: 'var(--error-text)' }} title="Reject">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : null,
    }] : []),
  ];

  // Calendar view - show approved leaves
  const approvedLeaves = requests.filter((r) => r.status === 'approved');

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold font-heading" style={{ color: 'var(--text-primary)' }}>Leave Requests</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{requests.length} requests</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg p-1" style={{ backgroundColor: 'var(--surface-secondary)' }}>
            <button onClick={() => setViewMode('list')} className="px-3 py-1 rounded text-sm" style={viewMode === 'list' ? { backgroundColor: 'var(--surface-primary)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' } : {}}>{viewMode === 'list' ? 'List' : 'List'}</button>
            <button onClick={() => setViewMode('calendar')} className="px-3 py-1 rounded text-sm" style={viewMode === 'calendar' ? { backgroundColor: 'var(--surface-primary)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' } : {}}>Calendar</button>
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" /> Submit Request
          </button>
        </div>
      </div>

      {viewMode === 'list' ? (
        <>
          <div className="card p-4 mb-4">
            <div className="flex items-center gap-3">
              <Filter className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input px-3 py-1.5 rounded-lg text-sm">
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
          <div className="card p-4">
            <DataTable columns={columns} data={requests} emptyMessage="No leave requests found" />
          </div>
        </>
      ) : (
        <div className="card p-6">
          <h3 className="text-sm font-semibold font-heading mb-4" style={{ color: 'var(--text-primary)' }}>Approved Leaves Calendar</h3>
          {approvedLeaves.length === 0 ? (
            <div className="text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
              <Calendar className="w-10 h-10 mx-auto mb-2" />
              <p className="text-sm">No approved leaves to display</p>
            </div>
          ) : (
            <div className="space-y-3">
              {approvedLeaves.map((leave) => (
                <div key={leave._id || leave.id} className="flex items-center gap-4 p-3 rounded-lg" style={{ backgroundColor: 'var(--success-subtle)', border: '1px solid var(--success-border)' }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--success-subtle)' }}>
                    <Calendar className="w-5 h-5" style={{ color: 'var(--success-text)' }} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{leave.user_name || leave.staffName || leave.staff}</p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{(leave.start_date || leave.startDate)?.substring(0, 10)} to {(leave.end_date || leave.endDate)?.substring(0, 10)}</p>
                  </div>
                  <Badge variant={typeColors[leave.leave_type || leave.type] || 'gray'}>{leave.leave_type || leave.type}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Submit Request Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Submit Leave Request">
        <div className="space-y-4">
          <div>
            <label className="label">Leave Type</label>
            <select value={form.leave_type} onChange={(e) => setForm({ ...form, leave_type: e.target.value })} className="input w-full px-3 py-2 rounded-lg text-sm">
              <option value="annual">Annual Leave</option>
              <option value="sick">Sick Leave</option>
              <option value="personal">Personal Leave</option>
              <option value="maternity">Maternity Leave</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Start Date *</label>
              <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="input w-full px-3 py-2 rounded-lg text-sm" />
            </div>
            <div>
              <label className="label">End Date *</label>
              <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="input w-full px-3 py-2 rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="label">Reason</label>
            <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={3} className="input w-full px-3 py-2 rounded-lg text-sm" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowCreate(false)} className="btn-secondary px-4 py-2 rounded-lg text-sm font-medium">Cancel</button>
            <button onClick={handleCreate} disabled={saving} className="btn-primary px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60">{saving ? 'Submitting...' : 'Submit'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
