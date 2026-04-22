import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Save, X, Upload, User, Trash2, FileText, Search, Users, Link2, Unlink } from 'lucide-react';

const tabs = ['Personal Info', 'Contact Info', 'Medical Info', 'Academic Info', 'Family & Relations', 'Documents', 'Custom Fields'];

export default function StudentForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = id && id !== 'new';
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [grades, setGrades] = useState([]);
  const [sections, setSections] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  // Family & Relations state
  const [family, setFamily] = useState({ parent: null, siblings: [], sibling_group_id: null });
  const [parentSearch, setParentSearch] = useState('');
  const [parentResults, setParentResults] = useState([]);
  const [siblingSearch, setSiblingSearch] = useState('');
  const [siblingResults, setSiblingResults] = useState([]);
  const [savingFamily, setSavingFamily] = useState(false);
  const [form, setForm] = useState({
    first_name: '', last_name: '', first_name_ar: '', last_name_ar: '',
    date_of_birth: '', gender: 'male',
    nationality: 'Jordanian', national_id: '', grade_level_id: '', section_id: '', status: 'active',
    emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relation: 'father',
    address: '',
    blood_type: '', allergies: '', medical_notes: '',
    parent_id: '', sibling_group_id: '',
    moe_number: '',
    custom_fields: {},
  });

  useEffect(() => {
    const fetches = [
      api.get('/grade-levels').catch(() => ({ data: [] })),
      api.get('/sections').catch(() => ({ data: [] })),
    ];
    if (isEdit) fetches.push(api.get(`/students/${id}`));

    Promise.all(fetches)
      .then(([gradeRes, secRes, studRes]) => {
        setGrades(gradeRes.data || []);
        setSections(secRes.data || []);
        if (studRes) {
          const s = studRes.data.student || studRes.data;
          setForm((prev) => ({ ...prev, ...s }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  // Fetch family data when on the family tab
  useEffect(() => {
    if (isEdit && activeTab === 4) {
      api.get(`/students/${id}/family`)
        .then((res) => setFamily(res.data))
        .catch(() => setFamily({ parent: null, siblings: [], sibling_group_id: null }));
    }
  }, [activeTab, id, isEdit]);

  // Fetch documents when on the documents tab
  useEffect(() => {
    if (isEdit && activeTab === 5) {
      api.get(`/students/${id}/documents`)
        .then((res) => setDocuments(res.data.documents || res.data || []))
        .catch(() => setDocuments([]));
    }
  }, [activeTab, id, isEdit]);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const visibleSections = useMemo(() => {
    const filtered = form.grade_level_id
      ? sections.filter((s) => String(s.grade_level_id) === String(form.grade_level_id))
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
  }, [sections, form.grade_level_id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (isEdit) {
        await api.put(`/students/${id}`, form);
      } else {
        await api.post('/students', form);
      }
      navigate('/students');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save student');
    } finally {
      setSaving(false);
    }
  };

  const handleDocUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !isEdit) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('doc_type', 'general');
      await api.post(`/students/${id}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const res = await api.get(`/students/${id}/documents`);
      setDocuments(res.data.documents || res.data || []);
    } catch {
      setError('Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDoc = async (docId) => {
    if (!confirm('Delete this document?')) return;
    try {
      await api.delete(`/students/${id}/documents/${docId}`);
      setDocuments(documents.filter((d) => (d.id || d._id) !== docId));
    } catch {}
  };

  const searchParents = async (q) => {
    setParentSearch(q);
    if (q.length < 2) { setParentResults([]); return; }
    try {
      const res = await api.get('/parents', { params: { search: q } });
      setParentResults(res.data || []);
    } catch { setParentResults([]); }
  };

  const assignParent = async (parentId) => {
    setSavingFamily(true);
    try {
      await api.put(`/students/${id}/parent`, { parent_id: parentId });
      const res = await api.get(`/students/${id}/family`);
      setFamily(res.data);
      setParentSearch('');
      setParentResults([]);
    } catch {}
    setSavingFamily(false);
  };

  const unlinkParent = async () => {
    setSavingFamily(true);
    try {
      await api.put(`/students/${id}/parent`, { parent_id: null });
      setFamily((prev) => ({ ...prev, parent: null }));
    } catch {}
    setSavingFamily(false);
  };

  const searchSiblings = async (q) => {
    setSiblingSearch(q);
    if (q.length < 2) { setSiblingResults([]); return; }
    try {
      const res = await api.get('/students', { params: { search: q, limit: 10 } });
      const students = res.data.students || res.data || [];
      // Exclude current student and already-linked siblings
      const sibIds = family.siblings.map((s) => s.id);
      setSiblingResults(students.filter((s) => s.id != id && !sibIds.includes(s.id)));
    } catch { setSiblingResults([]); }
  };

  const addSibling = async (siblingId) => {
    setSavingFamily(true);
    try {
      const currentSibIds = family.siblings.map((s) => s.id);
      await api.put(`/students/${id}/siblings`, { sibling_ids: [...currentSibIds, siblingId] });
      const res = await api.get(`/students/${id}/family`);
      setFamily(res.data);
      setSiblingSearch('');
      setSiblingResults([]);
    } catch {}
    setSavingFamily(false);
  };

  const removeSibling = async (siblingId) => {
    setSavingFamily(true);
    try {
      const newSibIds = family.siblings.filter((s) => s.id !== siblingId).map((s) => s.id);
      await api.put(`/students/${id}/siblings`, { sibling_ids: newSibIds });
      const res = await api.get(`/students/${id}/family`);
      setFamily(res.data);
    } catch {}
    setSavingFamily(false);
  };

  if (loading) return <LoadingSpinner />;

  const inputClass = 'input w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
  const labelClass = 'label';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-heading" style={{ color: 'var(--text-primary)' }}>{isEdit ? 'Edit Student' : 'Add New Student'}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Fill in the student information below</p>
        </div>
        <button onClick={() => navigate('/students')} className="flex items-center gap-2 px-4 py-2" style={{ color: 'var(--text-secondary)' }}>
          <X className="w-4 h-4" /> Cancel
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg text-sm" style={{ backgroundColor: 'var(--error-subtle)', border: '1px solid var(--error-border)', color: 'var(--error-text)' }}>{error}</div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="card">
          {/* Photo Upload Area */}
          <div className="p-6 flex items-center gap-6" style={{ borderBottom: '1px solid var(--border-default)' }}>
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--surface-secondary)', border: '2px dashed var(--border-default)' }}>
              <User className="w-8 h-8" style={{ color: 'var(--text-tertiary)' }} />
            </div>
            <div>
              <button type="button" className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium">
                <Upload className="w-4 h-4" /> Upload Photo
              </button>
              <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>JPG or PNG, max 2MB</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-6" style={{ borderBottom: '1px solid var(--border-default)' }}>
            <div className="flex gap-6 overflow-x-auto">
              {tabs.map((tab, i) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(i)}
                  className="py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors"
                  style={{
                    borderColor: activeTab === i ? 'var(--accent)' : 'transparent',
                    color: activeTab === i ? 'var(--accent)' : 'var(--text-secondary)',
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {/* Personal Info */}
            {activeTab === 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>First Name (English) *</label>
                  <input className={inputClass} value={form.first_name} onChange={(e) => update('first_name', e.target.value)} required />
                </div>
                <div>
                  <label className={labelClass}>Last Name (English) *</label>
                  <input className={inputClass} value={form.last_name} onChange={(e) => update('last_name', e.target.value)} required />
                </div>
                <div>
                  <label className={labelClass}>First Name (Arabic)</label>
                  <input className={inputClass} value={form.first_name_ar} onChange={(e) => update('first_name_ar', e.target.value)} dir="rtl" />
                </div>
                <div>
                  <label className={labelClass}>Last Name (Arabic)</label>
                  <input className={inputClass} value={form.last_name_ar} onChange={(e) => update('last_name_ar', e.target.value)} dir="rtl" />
                </div>
                <div>
                  <label className={labelClass}>Date of Birth</label>
                  <input type="date" className={inputClass} value={form.date_of_birth?.substring(0, 10) || ''} onChange={(e) => update('date_of_birth', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Gender</label>
                  <select className={inputClass} value={form.gender} onChange={(e) => update('gender', e.target.value)}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Nationality</label>
                  <input className={inputClass} value={form.nationality} onChange={(e) => update('nationality', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>National ID</label>
                  <input className={inputClass} value={form.national_id} onChange={(e) => update('national_id', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Status</label>
                  <select className={inputClass} value={form.status} onChange={(e) => update('status', e.target.value)}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                    <option value="withdrawn">Withdrawn</option>
                    <option value="graduated">Graduated</option>
                  </select>
                </div>
              </div>
            )}

            {/* Contact Info */}
            {activeTab === 1 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Emergency Contact Name *</label>
                  <input className={inputClass} value={form.emergency_contact_name} onChange={(e) => update('emergency_contact_name', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Relation</label>
                  <select className={inputClass} value={form.emergency_contact_relation} onChange={(e) => update('emergency_contact_relation', e.target.value)}>
                    <option value="father">Father</option>
                    <option value="mother">Mother</option>
                    <option value="guardian">Guardian</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Emergency Phone Number</label>
                  <input className={inputClass} value={form.emergency_contact_phone} onChange={(e) => update('emergency_contact_phone', e.target.value)} placeholder="+962 7XX XXX XXX" />
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>Address</label>
                  <textarea className={inputClass} rows={2} value={form.address} onChange={(e) => update('address', e.target.value)} />
                </div>
              </div>
            )}

            {/* Medical Info */}
            {activeTab === 2 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Blood Type</label>
                  <select className={inputClass} value={form.blood_type} onChange={(e) => update('blood_type', e.target.value)}>
                    <option value="">Unknown</option>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Allergies</label>
                  <input className={inputClass} value={form.allergies} onChange={(e) => update('allergies', e.target.value)} placeholder="List any known allergies" />
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>Medical Notes</label>
                  <textarea className={inputClass} rows={3} value={form.medical_notes} onChange={(e) => update('medical_notes', e.target.value)} />
                </div>
              </div>
            )}

            {/* Academic Info */}
            {activeTab === 3 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Grade Level *</label>
                  <select
                    className={inputClass}
                    value={form.grade_level_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, grade_level_id: e.target.value, section_id: '' }))}
                  >
                    <option value="">Select Grade</option>
                    {grades.map((g) => (
                      <option key={g.id || g._id} value={g.id || g._id}>{g.name_en || g.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Section *</label>
                  <select
                    className={`${inputClass} disabled:opacity-50 disabled:cursor-not-allowed`}
                    value={form.section_id}
                    onChange={(e) => update('section_id', e.target.value)}
                    disabled={!form.grade_level_id}
                    title={!form.grade_level_id ? 'Select a Grade Level first' : ''}
                  >
                    <option value="">{form.grade_level_id ? 'Select Section' : 'Select a Grade Level first'}</option>
                    {visibleSections.map((s) => (
                      <option key={s.id || s._id} value={s.id || s._id}>{s.name_en || s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>MOE Number</label>
                  <input className={inputClass} value={form.moe_number || ''} onChange={(e) => update('moe_number', e.target.value)} placeholder="Ministry of Education Number" />
                </div>
              </div>
            )}

            {/* Family & Relations */}
            {activeTab === 4 && (
              <div>
                {!isEdit ? (
                  <div className="text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
                    <Users className="w-10 h-10 mx-auto mb-2" />
                    <p className="text-sm">Save the student first, then you can manage family relationships.</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Parent Section */}
                    <div>
                      <h3 className="text-sm font-semibold font-heading mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <User className="w-4 h-4" /> Parent / Guardian
                      </h3>
                      {family.parent ? (
                        <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: 'var(--accent-subtle)', border: '1px solid var(--accent)' }}>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--accent)' }}>
                              <span className="text-white font-bold text-sm">{(family.parent.first_name || '?')[0]}</span>
                            </div>
                            <div>
                              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{family.parent.first_name} {family.parent.last_name}</p>
                              {(family.parent.first_name_ar || family.parent.last_name_ar) && (
                                <p className="text-xs" style={{ color: 'var(--text-secondary)' }} dir="rtl">{family.parent.first_name_ar} {family.parent.last_name_ar}</p>
                              )}
                              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{family.parent.email} {family.parent.phone ? `· ${family.parent.phone}` : ''}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={unlinkParent}
                            disabled={savingFamily}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm disabled:opacity-60"
                            style={{ color: 'var(--error-text)', border: '1px solid var(--error-border)' }}
                          >
                            <Unlink className="w-3 h-3" /> Unlink
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div className="relative mb-2">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                            <input
                              type="text"
                              value={parentSearch}
                              onChange={(e) => searchParents(e.target.value)}
                              placeholder="Search parents by name or email..."
                              className={`${inputClass} pl-9`}
                            />
                          </div>
                          {parentResults.length > 0 && (
                            <div className="rounded-lg max-h-48 overflow-y-auto" style={{ border: '1px solid var(--border-default)' }}>
                              {parentResults.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => assignParent(p.id)}
                                  disabled={savingFamily}
                                  className="w-full text-left flex items-center justify-between px-3 py-2 last:border-0"
                                  style={{ borderBottom: '1px solid var(--border-subtle)' }}
                                >
                                  <div>
                                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{p.first_name} {p.last_name}</p>
                                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{p.email}</p>
                                  </div>
                                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{p.children_count} children</span>
                                </button>
                              ))}
                            </div>
                          )}
                          {parentSearch.length >= 2 && parentResults.length === 0 && (
                            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>No parents found. Make sure the user has the "parent" role.</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Siblings Section */}
                    <div>
                      <h3 className="text-sm font-semibold font-heading mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <Users className="w-4 h-4" /> Siblings
                        {family.sibling_group_id && (
                          <span className="text-xs font-normal ml-2" style={{ color: 'var(--text-tertiary)' }}>Group: {family.sibling_group_id}</span>
                        )}
                      </h3>
                      {family.siblings.length > 0 ? (
                        <div className="space-y-2 mb-3">
                          {family.siblings.map((sib) => (
                            <div key={sib.id} className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--surface-secondary)', border: '1px solid var(--border-default)' }}>
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--success-subtle)' }}>
                                  <span className="font-medium text-xs" style={{ color: 'var(--success-text)' }}>{(sib.first_name || '?')[0]}</span>
                                </div>
                                <div>
                                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{sib.first_name} {sib.last_name}</p>
                                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                    {sib.grade_name_en || 'N/A'} · {sib.section_name_en || 'N/A'} · <span className="capitalize">{sib.status}</span>
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeSibling(sib.id)}
                                disabled={savingFamily}
                                className="p-1.5 disabled:opacity-60"
                                style={{ color: 'var(--text-tertiary)' }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm mb-3" style={{ color: 'var(--text-tertiary)' }}>No siblings linked yet.</p>
                      )}

                      {/* Add Sibling Search */}
                      <div className="relative mb-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                        <input
                          type="text"
                          value={siblingSearch}
                          onChange={(e) => searchSiblings(e.target.value)}
                          placeholder="Search students to add as sibling..."
                          className={`${inputClass} pl-9`}
                        />
                      </div>
                      {siblingResults.length > 0 && (
                        <div className="rounded-lg max-h-48 overflow-y-auto" style={{ border: '1px solid var(--border-default)' }}>
                          {siblingResults.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => addSibling(s.id)}
                              disabled={savingFamily}
                              className="w-full text-left flex items-center justify-between px-3 py-2 last:border-0"
                              style={{ borderBottom: '1px solid var(--border-subtle)' }}
                            >
                              <div>
                                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{s.first_name} {s.last_name}</p>
                                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{s.student_number} · {s.grade_name_en || 'N/A'}</p>
                              </div>
                              <Link2 className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Documents */}
            {activeTab === 5 && (
              <div>
                {!isEdit ? (
                  <div className="text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
                    <p className="text-sm">Save the student first, then you can upload documents.</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold font-heading" style={{ color: 'var(--text-primary)' }}>Student Documents</h3>
                      <label className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer">
                        <Upload className="w-4 h-4" /> {uploading ? 'Uploading...' : 'Upload Document'}
                        <input type="file" className="hidden" onChange={handleDocUpload} disabled={uploading} />
                      </label>
                    </div>
                    {documents.length === 0 ? (
                      <div className="text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
                        <FileText className="w-10 h-10 mx-auto mb-2" />
                        <p className="text-sm">No documents uploaded yet</p>
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
                                <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:opacity-80" style={{ color: 'var(--accent)' }}>Download</a>
                              )}
                              <button type="button" onClick={() => handleDeleteDoc(doc.id || doc._id)} className="p-1 hover:opacity-80" style={{ color: 'var(--text-tertiary)' }}>
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Custom Fields */}
            {activeTab === 6 && (
              <div className="text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
                <p className="text-sm">Custom fields can be configured in Settings. Any custom fields defined for students will appear here.</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6" style={{ borderTop: '1px solid var(--border-default)' }}>
            <button type="button" onClick={() => navigate('/students')} className="btn-secondary px-4 py-2 rounded-lg text-sm font-medium">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : isEdit ? 'Update Student' : 'Create Student'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
