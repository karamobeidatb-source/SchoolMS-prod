import { useState, useEffect } from 'react';
import api from '../../utils/api';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Plus, Edit, Briefcase, Calendar, FolderOpen, FileText, Star, Upload, Trash2, Download, FileDown } from 'lucide-react';

export default function StaffPage() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detailTab, setDetailTab] = useState('info'); // info | documents | reviews
  const [form, setForm] = useState({
    user_id: '', employee_number: '', department: '', position: '',
    hire_date: '', contract_type: '', salary: '', bank_account: '',
  });

  // Documents
  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Performance Reviews
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 3, strengths: '', improvements: '', goals: '', period: '' });
  const [savingReview, setSavingReview] = useState(false);

  // Payroll
  const [payrollMonth, setPayrollMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    api.get('/staff')
      .then((res) => setStaff(res.data.staff || res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Fetch documents/reviews when tab changes
  useEffect(() => {
    if (!selectedStaff) return;
    const staffId = selectedStaff.id || selectedStaff._id;
    const userId = selectedStaff.user_id || selectedStaff.user?.id || selectedStaff.user?._id || staffId;

    if (detailTab === 'documents') {
      setLoadingDocs(true);
      api.get(`/staff/${staffId}/documents`)
        .then((res) => setDocuments(res.data.documents || res.data || []))
        .catch(() => setDocuments([]))
        .finally(() => setLoadingDocs(false));
    }

    if (detailTab === 'reviews') {
      setLoadingReviews(true);
      api.get('/performance-reviews', { params: { user_id: userId } })
        .then((res) => setReviews(res.data.reviews || res.data || []))
        .catch(() => setReviews([]))
        .finally(() => setLoadingReviews(false));
    }
  }, [selectedStaff, detailTab]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (form._id) {
        await api.put(`/staff/${form._id}`, form);
      } else {
        await api.post('/staff', form);
      }
      const res = await api.get('/staff');
      setStaff(res.data.staff || res.data || []);
      setShowForm(false);
    } catch {}
    setSaving(false);
  };

  const openEdit = (s) => {
    setForm({
      _id: s.id || s._id,
      user_id: s.user_id || '',
      employee_number: s.employee_number || '',
      department: s.department || '',
      position: s.position || '',
      hire_date: (s.hire_date || s.joiningDate)?.substring(0, 10) || '',
      contract_type: s.contract_type || '',
      salary: s.salary || '',
      bank_account: s.bank_account || '',
    });
    setShowForm(true);
  };

  const handleDocUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedStaff) return;
    setUploading(true);
    try {
      const staffId = selectedStaff.id || selectedStaff._id;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('doc_type', 'general');
      await api.post(`/staff/${staffId}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const res = await api.get(`/staff/${staffId}/documents`);
      setDocuments(res.data.documents || res.data || []);
    } catch {}
    setUploading(false);
  };

  const handleDeleteDoc = async (docId) => {
    if (!selectedStaff || !confirm('Delete this document?')) return;
    try {
      const staffId = selectedStaff.id || selectedStaff._id;
      await api.delete(`/staff/${staffId}/documents/${docId}`);
      setDocuments(documents.filter((d) => (d.id || d._id) !== docId));
    } catch {}
  };

  const handleCreateReview = async () => {
    if (!selectedStaff) return;
    setSavingReview(true);
    const userId = selectedStaff.user_id || selectedStaff.user?.id || selectedStaff.user?._id || selectedStaff.id || selectedStaff._id;
    try {
      await api.post('/performance-reviews', { ...reviewForm, user_id: userId, rating: parseInt(reviewForm.rating) });
      const res = await api.get('/performance-reviews', { params: { user_id: userId } });
      setReviews(res.data.reviews || res.data || []);
      setShowReviewForm(false);
      setReviewForm({ rating: 3, strengths: '', improvements: '', goals: '', period: '' });
    } catch {}
    setSavingReview(false);
  };

  const roleColors = {
    teacher: 'info', admin: 'purple', principal: 'success', nurse: 'warning', driver: 'gray', accountant: 'gray',
  };

  const getStaffName = (r) => {
    if (r.user?.first_name) return `${r.user.first_name} ${r.user.last_name || ''}`.trim();
    if (r.first_name) return `${r.first_name} ${r.last_name || ''}`.trim();
    return r.name || r.user?.name || '?';
  };

  const renderStars = (rating) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star key={s} className={`w-4 h-4 ${s <= rating ? 'fill-current' : ''}`} style={{ color: s <= rating ? 'var(--warning-text)' : 'var(--border-default)' }} />
        ))}
      </div>
    );
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (r) => {
        const name = getStaffName(r);
        const email = r.user?.email || r.email || '';
        return (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center font-medium text-xs" style={{ backgroundColor: 'var(--accent-subtle)', color: 'var(--accent)' }}>{(name || '?')[0]}</div>
            <div>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{name}</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{email}</p>
            </div>
          </div>
        );
      },
      accessor: (r) => getStaffName(r),
    },
    { key: 'position', header: 'Position', accessor: (r) => r.position || r.role || '' },
    { key: 'department', header: 'Department', accessor: 'department' },
    { key: 'employee_number', header: 'Employee #', accessor: (r) => r.employee_number || '' },
    { key: 'hire_date', header: 'Hired', accessor: (r) => (r.hire_date || r.joiningDate)?.substring(0, 10) || 'N/A' },
    {
      key: 'actions',
      header: '',
      sortable: false,
      render: (r) => (
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} style={{ color: 'var(--accent)' }} className="hover:opacity-80">
          <Edit className="w-4 h-4" />
        </button>
      ),
    },
  ];

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold font-heading" style={{ color: 'var(--text-primary)' }}>Staff & HR</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{staff.length} staff members</p>
        </div>
        <button onClick={() => { setForm({ user_id: '', employee_number: '', department: '', position: '', hire_date: '', contract_type: '', salary: '', bank_account: '' }); setShowForm(true); }} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> Add Staff
        </button>
      </div>

      <div className="card p-4">
        <DataTable
          columns={columns}
          data={staff}
          onRowClick={(row) => { setSelectedStaff(row); setDetailTab('info'); }}
        />
      </div>

      {/* Staff Detail Modal */}
      <Modal open={!!selectedStaff} onClose={() => { setSelectedStaff(null); setDetailTab('info'); }} title="Staff Profile" size="lg">
        {selectedStaff && (
          <div>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl" style={{ backgroundColor: 'var(--accent-subtle)', color: 'var(--accent)' }}>{(getStaffName(selectedStaff) || '?')[0]}</div>
              <div>
                <h3 className="text-lg font-semibold font-heading" style={{ color: 'var(--text-primary)' }}>{getStaffName(selectedStaff)}</h3>
                <Badge variant="info">{selectedStaff.position || selectedStaff.role || 'Staff'}</Badge>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 mb-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
              <button onClick={() => setDetailTab('info')} className="pb-2 text-sm font-medium border-b-2" style={{ borderColor: detailTab === 'info' ? 'var(--accent)' : 'transparent', color: detailTab === 'info' ? 'var(--accent)' : 'var(--text-secondary)' }}>
                Profile
              </button>
              <button onClick={() => setDetailTab('documents')} className="pb-2 text-sm font-medium border-b-2 flex items-center gap-1" style={{ borderColor: detailTab === 'documents' ? 'var(--accent)' : 'transparent', color: detailTab === 'documents' ? 'var(--accent)' : 'var(--text-secondary)' }}>
                <FolderOpen className="w-3.5 h-3.5" /> Documents
              </button>
              <button onClick={() => setDetailTab('reviews')} className="pb-2 text-sm font-medium border-b-2 flex items-center gap-1" style={{ borderColor: detailTab === 'reviews' ? 'var(--accent)' : 'transparent', color: detailTab === 'reviews' ? 'var(--accent)' : 'var(--text-secondary)' }}>
                <Star className="w-3.5 h-3.5" /> Reviews
              </button>
            </div>

            {/* Info Tab */}
            {detailTab === 'info' && (
              <>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {[
                    ['Email', selectedStaff.user?.email || selectedStaff.email],
                    ['Employee #', selectedStaff.employee_number],
                    ['Department', selectedStaff.department],
                    ['Position', selectedStaff.position],
                    ['Contract Type', selectedStaff.contract_type],
                    ['Salary', selectedStaff.salary],
                    ['Hire Date', (selectedStaff.hire_date || selectedStaff.joiningDate)?.substring(0, 10)],
                  ].map(([label, val]) => (
                    <div key={label} className="rounded-lg p-3" style={{ backgroundColor: 'var(--surface-secondary)' }}>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</p>
                      <p className="text-sm font-medium mt-1" style={{ color: 'var(--text-primary)' }}>{val || 'N/A'}</p>
                    </div>
                  ))}
                </div>

                <h4 className="text-sm font-semibold font-heading mb-3" style={{ color: 'var(--text-primary)' }}>Leave Balance</h4>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="rounded-lg p-3 text-center" style={{ backgroundColor: 'var(--success-subtle)' }}>
                    <p className="text-lg font-bold" style={{ color: 'var(--success-text)' }}>{selectedStaff.leaveBalance?.annual ?? 14}</p>
                    <p className="text-xs" style={{ color: 'var(--success-text)' }}>Annual</p>
                  </div>
                  <div className="rounded-lg p-3 text-center" style={{ backgroundColor: 'var(--accent-subtle)' }}>
                    <p className="text-lg font-bold" style={{ color: 'var(--accent)' }}>{selectedStaff.leaveBalance?.sick ?? 10}</p>
                    <p className="text-xs" style={{ color: 'var(--accent)' }}>Sick</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-purple-700">{selectedStaff.leaveBalance?.personal ?? 3}</p>
                    <p className="text-xs text-purple-600">Personal</p>
                  </div>
                </div>

                <div className="mb-4">
                  <h4 className="text-sm font-semibold font-heading mb-3" style={{ color: 'var(--text-primary)' }}>Payroll Slip</h4>
                  <div className="flex items-center gap-3">
                    <input
                      type="month"
                      value={payrollMonth}
                      onChange={(e) => setPayrollMonth(e.target.value)}
                      className="input px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={async () => {
                        const userId = selectedStaff.user_id || selectedStaff.user?.id || selectedStaff.user?._id || selectedStaff.id || selectedStaff._id;
                        try {
                          const res = await api.get(`/payroll/slip/${userId}`, {
                            params: { month: payrollMonth },
                            responseType: 'blob',
                          });
                          const url = window.URL.createObjectURL(new Blob([res.data]));
                          const link = document.createElement('a');
                          link.href = url;
                          link.setAttribute('download', `payroll-slip-${userId}-${payrollMonth}.pdf`);
                          document.body.appendChild(link);
                          link.click();
                          link.remove();
                          window.URL.revokeObjectURL(url);
                        } catch {}
                      }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white"
                      style={{ backgroundColor: 'var(--success-text)' }}
                    >
                      <FileDown className="w-4 h-4" /> Download Payroll Slip
                    </button>
                  </div>
                </div>

                <button onClick={() => { openEdit(selectedStaff); setSelectedStaff(null); }} className="btn-secondary w-full py-2 rounded-lg text-sm font-medium">Edit Profile</button>
              </>
            )}

            {/* Documents Tab */}
            {detailTab === 'documents' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold font-heading" style={{ color: 'var(--text-primary)' }}>Staff Documents</h4>
                  <label className="btn-secondary flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer">
                    <Upload className="w-4 h-4" /> {uploading ? 'Uploading...' : 'Upload'}
                    <input type="file" className="hidden" onChange={handleDocUpload} disabled={uploading} />
                  </label>
                </div>
                {loadingDocs ? (
                  <LoadingSpinner />
                ) : documents.length === 0 ? (
                  <div className="text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
                    <FolderOpen className="w-10 h-10 mx-auto mb-2" />
                    <p className="text-sm">No documents uploaded</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <div key={doc.id || doc._id} className="flex items-center justify-between p-3 rounded-lg" style={{ border: '1px solid var(--border-default)' }}>
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
                          <div>
                            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{doc.file_name || doc.name || 'Document'}</p>
                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{doc.doc_type || doc.type || 'general'} - {(doc.created_at || doc.uploaded_at || '')?.substring(0, 10)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {doc.file_url && (
                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm hover:opacity-80" style={{ color: 'var(--accent)' }}>
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button onClick={() => handleDeleteDoc(doc.id || doc._id)} className="p-1 hover:opacity-80" style={{ color: 'var(--text-tertiary)' }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Reviews Tab */}
            {detailTab === 'reviews' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold font-heading" style={{ color: 'var(--text-primary)' }}>Performance Reviews</h4>
                  <button
                    onClick={() => setShowReviewForm(!showReviewForm)}
                    className="btn-primary flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium"
                  >
                    <Plus className="w-3 h-3" /> New Review
                  </button>
                </div>

                {showReviewForm && (
                  <div className="rounded-lg p-4 mb-4 space-y-3" style={{ backgroundColor: 'var(--surface-secondary)' }}>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label text-xs">Rating</label>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setReviewForm({ ...reviewForm, rating: s })}
                              className="p-0.5"
                            >
                              <Star className={`w-6 h-6 ${s <= reviewForm.rating ? 'fill-current' : ''}`} style={{ color: s <= reviewForm.rating ? 'var(--warning-text)' : 'var(--border-default)' }} />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="label text-xs">Period</label>
                        <input value={reviewForm.period} onChange={(e) => setReviewForm({ ...reviewForm, period: e.target.value })} className="input w-full px-3 py-2 rounded-lg text-sm" placeholder="e.g., Q1 2026" />
                      </div>
                    </div>
                    <div>
                      <label className="label text-xs">Strengths</label>
                      <textarea value={reviewForm.strengths} onChange={(e) => setReviewForm({ ...reviewForm, strengths: e.target.value })} rows={2} className="input w-full px-3 py-2 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="label text-xs">Areas for Improvement</label>
                      <textarea value={reviewForm.improvements} onChange={(e) => setReviewForm({ ...reviewForm, improvements: e.target.value })} rows={2} className="input w-full px-3 py-2 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="label text-xs">Goals</label>
                      <textarea value={reviewForm.goals} onChange={(e) => setReviewForm({ ...reviewForm, goals: e.target.value })} rows={2} className="input w-full px-3 py-2 rounded-lg text-sm" />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setShowReviewForm(false)} className="btn-secondary px-3 py-1.5 rounded-lg text-xs">Cancel</button>
                      <button onClick={handleCreateReview} disabled={savingReview} className="btn-primary px-3 py-1.5 rounded-lg text-xs disabled:opacity-60">{savingReview ? 'Saving...' : 'Submit'}</button>
                    </div>
                  </div>
                )}

                {loadingReviews ? (
                  <LoadingSpinner />
                ) : reviews.length === 0 ? (
                  <p className="text-sm text-center py-8" style={{ color: 'var(--text-tertiary)' }}>No performance reviews</p>
                ) : (
                  <div className="space-y-3">
                    {reviews.map((review, i) => (
                      <div key={i} className="p-4 rounded-lg" style={{ border: '1px solid var(--border-default)' }}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {renderStars(review.rating || 0)}
                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{review.period || (review.created_at || review.date || '')?.substring(0, 10)}</span>
                          </div>
                        </div>
                        {review.strengths && (
                          <div className="mb-2">
                            <p className="text-xs font-medium" style={{ color: 'var(--success-text)' }}>Strengths</p>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{review.strengths}</p>
                          </div>
                        )}
                        {review.improvements && (
                          <div className="mb-2">
                            <p className="text-xs font-medium" style={{ color: 'var(--warning-text)' }}>Improvements</p>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{review.improvements}</p>
                          </div>
                        )}
                        {review.goals && (
                          <div>
                            <p className="text-xs font-medium" style={{ color: 'var(--accent)' }}>Goals</p>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{review.goals}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Staff Form Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={form._id ? 'Edit Staff' : 'Add Staff'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Employee Number</label>
              <input value={form.employee_number} onChange={(e) => setForm({ ...form, employee_number: e.target.value })} className="input w-full px-3 py-2 rounded-lg text-sm" />
            </div>
            <div>
              <label className="label">Position</label>
              <input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} className="input w-full px-3 py-2 rounded-lg text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Department</label>
              <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="input w-full px-3 py-2 rounded-lg text-sm" />
            </div>
            <div>
              <label className="label">Hire Date</label>
              <input type="date" value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} className="input w-full px-3 py-2 rounded-lg text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Contract Type</label>
              <input value={form.contract_type} onChange={(e) => setForm({ ...form, contract_type: e.target.value })} className="input w-full px-3 py-2 rounded-lg text-sm" placeholder="e.g., Full-time" />
            </div>
            <div>
              <label className="label">Salary</label>
              <input type="number" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} className="input w-full px-3 py-2 rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="label">Bank Account</label>
            <input value={form.bank_account} onChange={(e) => setForm({ ...form, bank_account: e.target.value })} className="input w-full px-3 py-2 rounded-lg text-sm" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowForm(false)} className="btn-secondary px-4 py-2 rounded-lg text-sm font-medium">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
