import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import Badge from '../../components/Badge';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Edit, CreditCard, Archive, User, BookOpen, ClipboardCheck, FileText, HeartPulse, FolderOpen, Download, Trash2, X, Printer, Users } from 'lucide-react';

const detailTabs = [
  { label: 'Overview', icon: User },
  { label: 'Grades', icon: BookOpen },
  { label: 'Attendance', icon: ClipboardCheck },
  { label: 'Assignments', icon: FileText },
  { label: 'Nurse Log', icon: HeartPulse },
  { label: 'Documents', icon: FolderOpen },
];

export default function StudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [grades, setGrades] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [nurseLog, setNurseLog] = useState([]);
  const [siblings, setSiblings] = useState([]);
  const [family, setFamily] = useState({ parent: null, siblings: [], sibling_group_id: null });
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [showIdCard, setShowIdCard] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [archiveStatus, setArchiveStatus] = useState('graduated');
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    api.get(`/students/${id}`)
      .then((res) => {
        const s = res.data.student || res.data;
        if (s.first_name && !s.nameEn) {
          s.nameEn = `${s.first_name} ${s.last_name || ''}`.trim();
        }
        if (s.first_name_ar && !s.nameAr) {
          s.nameAr = `${s.first_name_ar} ${s.last_name_ar || ''}`.trim();
        }
        setStudent(s);
      })
      .catch(() => navigate('/students'))
      .finally(() => setLoading(false));

    api.get(`/students/${id}/siblings`).then((r) => setSiblings(r.data.siblings || r.data || [])).catch(() => {});
    api.get(`/students/${id}/family`).then((r) => { setFamily(r.data); setSiblings(r.data.siblings || []); }).catch(() => {});
  }, [id, navigate]);

  useEffect(() => {
    if (!student) return;
    if (activeTab === 1) {
      api.get(`/grades/report/${id}`)
        .then((r) => {
          const allGrades = [];
          (r.data.subjects || []).forEach((subj) => {
            (subj.grades || []).forEach((g) => {
              allGrades.push({ ...g, subjectName: subj.subject?.name_en || subj.subject?.name || subj.subject });
            });
          });
          setGrades(allGrades);
        })
        .catch(() => setGrades([]));
    }
    if (activeTab === 2) {
      api.get(`/attendance/student/${id}`)
        .then((r) => setAttendance(r.data.records || r.data || []))
        .catch(() => setAttendance([]));
    }
    if (activeTab === 3) {
      api.get('/assignments', { params: { student_id: id } })
        .then((r) => setAssignments(r.data.assignments || r.data || []))
        .catch(() => setAssignments([]));
    }
    if (activeTab === 4) {
      api.get(`/nurse-log/student/${id}`)
        .then((r) => setNurseLog(r.data.entries || r.data || []))
        .catch(() => setNurseLog([]));
    }
    if (activeTab === 5) {
      api.get(`/students/${id}/documents`)
        .then((r) => setDocuments(r.data.documents || r.data || []))
        .catch(() => setDocuments([]));
    }
  }, [activeTab, id, student]);

  const handleDocUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
    } catch {}
    setUploading(false);
  };

  const handleDeleteDoc = async (docId) => {
    if (!confirm('Delete this document?')) return;
    try {
      await api.delete(`/students/${id}/documents/${docId}`);
      setDocuments(documents.filter((d) => (d.id || d._id) !== docId));
    } catch {}
  };

  const handleIdCard = async () => {
    setShowIdCard(true);
  };

  const handleDownloadIdCardPDF = async () => {
    try {
      const res = await api.get(`/students/${id}/id-card-pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `id-card-${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {}
  };

  const handleArchive = async () => {
    setArchiving(true);
    try {
      await api.post(`/students/${id}/archive`, { status: archiveStatus });
      setShowArchive(false);
      navigate('/students');
    } catch {}
    setArchiving(false);
  };

  if (loading) return <LoadingSpinner />;
  if (!student) return null;

  const statusMap = { active: 'success', inactive: 'gray', suspended: 'danger', graduated: 'info', transferred: 'info', withdrawn: 'warning' };
  const displayName = student.nameEn || student.name || '';
  const displayNameAr = student.nameAr || '';

  return (
    <div>
      {/* Profile Header */}
      <div className="card p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <div className="w-20 h-20 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--accent-subtle)' }}>
            <span className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{(displayName || '?')[0]}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-3 flex-wrap">
              <h1 className="text-2xl font-bold font-heading" style={{ color: 'var(--text-primary)' }}>{displayName}</h1>
              <Badge variant={statusMap[student.status] || 'gray'}>{student.status}</Badge>
            </div>
            {displayNameAr && <p className="mt-1" style={{ color: 'var(--text-secondary)' }} dir="rtl">{displayNameAr}</p>}
            <div className="flex flex-wrap gap-4 mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <span>ID: {student.student_number || student.studentNumber || 'N/A'}</span>
              <span>Grade: {student.grade_name_en || student.grade_level_name || student.gradeName || 'N/A'}</span>
              <span>Section: {student.section_name_en || student.section_name || student.sectionName || 'N/A'}</span>
              {family.parent && <span>Parent: {family.parent.first_name} {family.parent.last_name}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => navigate(`/students/${id}/edit`)} className="btn-secondary flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium">
              <Edit className="w-4 h-4" /> Edit
            </button>
            <button onClick={handleIdCard} className="btn-secondary flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium">
              <CreditCard className="w-4 h-4" /> ID Card
            </button>
            <button onClick={() => setShowArchive(true)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium" style={{ border: '1px solid var(--border-default)', color: 'var(--error-text)' }}>
              <Archive className="w-4 h-4" /> Archive
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="px-6" style={{ borderBottom: '1px solid var(--border-default)' }}>
          <div className="flex gap-6 overflow-x-auto">
            {detailTabs.map((tab, i) => (
              <button
                key={tab.label}
                onClick={() => setActiveTab(i)}
                className="flex items-center gap-2 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors"
                style={{
                  borderColor: activeTab === i ? 'var(--accent)' : 'transparent',
                  color: activeTab === i ? 'var(--accent)' : 'var(--text-secondary)',
                }}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {/* Overview */}
          {activeTab === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-semibold font-heading mb-3" style={{ color: 'var(--text-primary)' }}>Personal Information</h3>
                <dl className="space-y-2 text-sm">
                  {[
                    ['Date of Birth', (student.date_of_birth || student.dateOfBirth)?.substring(0, 10)],
                    ['Gender', student.gender],
                    ['Nationality', student.nationality],
                    ['National ID', student.national_id || student.nationalId],
                    ['MOE Number', student.moe_number || student.moeNumber],
                    ['Blood Type', student.blood_type || student.bloodType],
                  ].map(([label, val]) => (
                    <div key={label} className="flex">
                      <dt className="w-36" style={{ color: 'var(--text-secondary)' }}>{label}</dt>
                      <dd className="capitalize" style={{ color: 'var(--text-primary)' }}>{val || 'N/A'}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div>
                <h3 className="text-sm font-semibold font-heading mb-3" style={{ color: 'var(--text-primary)' }}>Contact Information</h3>
                <dl className="space-y-2 text-sm">
                  {[
                    ['Emergency Contact', student.emergency_contact_name || student.parentName],
                    ['Relation', student.emergency_contact_relation || student.parentRelation],
                    ['Phone', student.emergency_contact_phone || student.parentPhone],
                    ['Address', student.address],
                  ].map(([label, val]) => (
                    <div key={label} className="flex">
                      <dt className="w-36" style={{ color: 'var(--text-secondary)' }}>{label}</dt>
                      <dd className="capitalize" style={{ color: 'var(--text-primary)' }}>{val || 'N/A'}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              {(student.medical_notes || student.allergies) && (
                <div className="md:col-span-2">
                  <h3 className="text-sm font-semibold font-heading mb-3" style={{ color: 'var(--text-primary)' }}>Medical Information</h3>
                  <dl className="space-y-2 text-sm">
                    {[
                      ['Allergies', student.allergies],
                      ['Medical Notes', student.medical_notes || student.medicalConditions],
                    ].map(([label, val]) => val && (
                      <div key={label} className="flex">
                        <dt className="w-36" style={{ color: 'var(--text-secondary)' }}>{label}</dt>
                        <dd style={{ color: 'var(--text-primary)' }}>{val}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
              {/* Family & Relations */}
              {(family.parent || siblings.length > 0) && (
                <div className="md:col-span-2">
                  <h3 className="text-sm font-semibold font-heading mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <Users className="w-4 h-4" /> Family & Relations
                  </h3>
                  <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
                    {/* Parent */}
                    {family.parent && (
                      <div className="p-4" style={{ backgroundColor: 'var(--accent-subtle)', borderBottom: '1px solid var(--border-default)' }}>
                        <p className="text-xs font-medium uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>Parent / Guardian</p>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--accent)' }}>
                            <span className="text-white font-bold text-sm">{(family.parent.first_name || '?')[0]}</span>
                          </div>
                          <div>
                            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{family.parent.first_name} {family.parent.last_name}</p>
                            {(family.parent.first_name_ar || family.parent.last_name_ar) && (
                              <p className="text-xs" style={{ color: 'var(--text-secondary)' }} dir="rtl">{family.parent.first_name_ar} {family.parent.last_name_ar}</p>
                            )}
                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{family.parent.email}{family.parent.phone ? ` · ${family.parent.phone}` : ''}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Siblings */}
                    {siblings.length > 0 && (
                      <div className="p-4">
                        <p className="text-xs font-medium uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>Siblings ({siblings.length})</p>
                        <div className="flex gap-2 flex-wrap">
                          {siblings.map((sib) => {
                            const sibName = sib.first_name ? `${sib.first_name} ${sib.last_name || ''}`.trim() : (sib.nameEn || sib.name);
                            return (
                              <button
                                key={sib.id || sib._id}
                                onClick={() => navigate(`/students/${sib.id || sib._id}`)}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
                                style={{ backgroundColor: 'var(--surface-secondary)', border: '1px solid var(--border-default)' }}
                              >
                                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--success-subtle)' }}>
                                  <span className="text-xs font-medium" style={{ color: 'var(--success-text)' }}>{(sibName || '?')[0]}</span>
                                </div>
                                <div className="text-left">
                                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{sibName}</p>
                                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{sib.grade_name_en || ''}{sib.section_name_en ? ` · ${sib.section_name_en}` : ''}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Grades */}
          {activeTab === 1 && (
            <div>
              {grades.length === 0 ? (
                <p className="text-center py-8" style={{ color: 'var(--text-tertiary)' }}>No grade records found</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                      <th className="text-left py-2 font-medium" style={{ color: 'var(--text-secondary)' }}>Subject</th>
                      <th className="text-left py-2 font-medium" style={{ color: 'var(--text-secondary)' }}>Category</th>
                      <th className="text-left py-2 font-medium" style={{ color: 'var(--text-secondary)' }}>Score</th>
                      <th className="text-left py-2 font-medium" style={{ color: 'var(--text-secondary)' }}>Max</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grades.map((g, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td className="py-2">{g.subjectName || g.subject_name || g.subject}</td>
                        <td className="py-2">{g.category}</td>
                        <td className="py-2 font-medium">{g.score}</td>
                        <td className="py-2" style={{ color: 'var(--text-secondary)' }}>{g.max_score || g.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Attendance */}
          {activeTab === 2 && (
            <div>
              {attendance.length === 0 ? (
                <p className="text-center py-8" style={{ color: 'var(--text-tertiary)' }}>No attendance records found</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                      <th className="text-left py-2 font-medium" style={{ color: 'var(--text-secondary)' }}>Date</th>
                      <th className="text-left py-2 font-medium" style={{ color: 'var(--text-secondary)' }}>Status</th>
                      <th className="text-left py-2 font-medium" style={{ color: 'var(--text-secondary)' }}>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map((a, i) => {
                      const colors = { present: 'success', absent: 'danger', late: 'warning', excused: 'info' };
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td className="py-2">{a.date?.substring(0, 10)}</td>
                          <td className="py-2"><Badge variant={colors[a.status] || 'gray'}>{a.status}</Badge></td>
                          <td className="py-2" style={{ color: 'var(--text-secondary)' }}>{a.notes || a.note || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Assignments */}
          {activeTab === 3 && (
            <div>
              {assignments.length === 0 ? (
                <p className="text-center py-8" style={{ color: 'var(--text-tertiary)' }}>No assignments found</p>
              ) : (
                <div className="space-y-3">
                  {assignments.map((a, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg" style={{ border: '1px solid var(--border-default)' }}>
                      <div>
                        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{a.title}</p>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{a.subject_name || a.subjectName || a.subject} - Due: {(a.due_date || a.dueDate)?.substring(0, 10)}</p>
                      </div>
                      <Badge variant={a.submitted ? 'success' : 'warning'}>{a.submitted ? 'Submitted' : 'Pending'}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Nurse Log */}
          {activeTab === 4 && (
            <div>
              {nurseLog.length === 0 ? (
                <p className="text-center py-8" style={{ color: 'var(--text-tertiary)' }}>No nurse log entries</p>
              ) : (
                <div className="space-y-3">
                  {nurseLog.map((n, i) => (
                    <div key={i} className="p-3 rounded-lg" style={{ border: '1px solid var(--border-default)' }}>
                      <div className="flex items-center justify-between">
                        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{n.incident_type || n.type || n.reason}</p>
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{(n.created_at || n.date)?.substring(0, 10)}</span>
                      </div>
                      <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{n.description || n.notes}</p>
                      {n.action_taken && <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Action: {n.action_taken}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Documents */}
          {activeTab === 5 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold font-heading" style={{ color: 'var(--text-primary)' }}>Student Documents</h3>
                <label className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer">
                  <FolderOpen className="w-4 h-4" /> {uploading ? 'Uploading...' : 'Upload Document'}
                  <input type="file" className="hidden" onChange={handleDocUpload} disabled={uploading} />
                </label>
              </div>
              {documents.length === 0 ? (
                <div className="text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
                  <FolderOpen className="w-10 h-10 mx-auto mb-2" />
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
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm font-medium hover:opacity-80" style={{ color: 'var(--accent)' }}>
                            <Download className="w-4 h-4" /> Download
                          </a>
                        )}
                        <button onClick={() => handleDeleteDoc(doc.id || doc._id)} className="p-1 hover:opacity-80" style={{ color: 'var(--text-tertiary)' }}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ID Card Modal */}
      {showIdCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowIdCard(false)} />
          <div className="relative rounded-xl shadow-xl max-w-md w-full mx-4" style={{ backgroundColor: 'var(--surface-primary)' }}>
            <div className="flex items-center justify-between p-4 print:hidden" style={{ borderBottom: '1px solid var(--border-default)' }}>
              <h3 className="font-semibold font-heading" style={{ color: 'var(--text-primary)' }}>Student ID Card</h3>
              <div className="flex items-center gap-2">
                <button onClick={handleDownloadIdCardPDF} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-white" style={{ backgroundColor: 'var(--success-text)' }}>
                  <Download className="w-4 h-4" /> Download PDF
                </button>
                <button onClick={() => window.print()} className="btn-primary flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm">
                  <Printer className="w-4 h-4" /> Print
                </button>
                <button onClick={() => setShowIdCard(false)} className="p-1" style={{ color: 'var(--text-tertiary)' }}>
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6" id="id-card-print">
              <div className="rounded-xl p-5" style={{ border: '2px solid var(--accent)' }}>
                <div className="text-center pb-3 mb-4" style={{ borderBottom: '1px solid var(--accent-subtle)' }}>
                  <h2 className="text-lg font-bold font-heading" style={{ color: 'var(--accent)' }}>SchoolOS Academy</h2>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Official Student Identification Card</p>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-20 h-24 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--surface-secondary)', border: '1px solid var(--border-default)' }}>
                    <User className="w-10 h-10" style={{ color: 'var(--text-tertiary)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{displayName}</p>
                    {displayNameAr && <p className="text-sm" style={{ color: 'var(--text-secondary)' }} dir="rtl">{displayNameAr}</p>}
                    <div className="mt-2 space-y-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      <p><span className="font-medium">Student #:</span> {student.student_number || student.studentNumber || 'N/A'}</p>
                      <p><span className="font-medium">Grade:</span> {student.grade_name_en || student.grade_level_name || student.gradeName || 'N/A'}</p>
                      <p><span className="font-medium">Section:</span> {student.section_name_en || student.section_name || student.sectionName || 'N/A'}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--accent-subtle)' }}>
                  <div className="rounded-lg p-3 text-center" style={{ backgroundColor: 'var(--surface-secondary)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>QR Code Data</p>
                    <p className="text-xs font-mono break-all" style={{ color: 'var(--text-secondary)' }}>
                      STU:{student.student_number || student.studentNumber || id}|{displayName}|{student.grade_name_en || student.gradeName || ''}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Archive Confirmation Modal */}
      {showArchive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowArchive(false)} />
          <div className="relative rounded-xl shadow-xl max-w-sm w-full mx-4 p-6" style={{ backgroundColor: 'var(--surface-primary)' }}>
            <h3 className="text-lg font-semibold font-heading mb-2" style={{ color: 'var(--text-primary)' }}>Archive Student</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              Are you sure you want to archive <strong>{displayName}</strong>? This will mark the student as inactive.
            </p>
            <div className="mb-4">
              <label className="label">Archive Reason</label>
              <select
                value={archiveStatus}
                onChange={(e) => setArchiveStatus(e.target.value)}
                className="input w-full px-3 py-2 rounded-lg text-sm"
              >
                <option value="graduated">Graduated</option>
                <option value="transferred">Transferred</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setShowArchive(false)} className="btn-secondary flex-1 px-4 py-2 rounded-lg text-sm font-medium">
                Cancel
              </button>
              <button
                onClick={handleArchive}
                disabled={archiving}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60"
                style={{ backgroundColor: 'var(--error-text)' }}
              >
                {archiving ? 'Archiving...' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
