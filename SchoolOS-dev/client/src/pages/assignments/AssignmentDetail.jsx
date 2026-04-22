import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import Badge from '../../components/Badge';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, Calendar, Upload, Check, X } from 'lucide-react';

export default function AssignmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [assignment, setAssignment] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submissionText, setSubmissionText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [gradingId, setGradingId] = useState(null);
  const [gradeValue, setGradeValue] = useState('');
  const [feedback, setFeedback] = useState('');

  const fetchAssignment = () => {
    api.get(`/assignments/${id}`)
      .then((res) => {
        const data = res.data.assignment || res.data;
        setAssignment(data);
        setSubmissions(data.submissions || []);
      })
      .catch(() => navigate('/assignments'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAssignment();
  }, [id, navigate]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await api.post(`/assignments/${id}/submit`, { content: submissionText });
      fetchAssignment();
      setSubmissionText('');
    } catch {}
    setSubmitting(false);
  };

  const handleGrade = async (submissionId) => {
    try {
      await api.put(`/submissions/${submissionId}/grade`, { score: parseFloat(gradeValue), feedback });
      fetchAssignment();
      setGradingId(null);
      setGradeValue('');
      setFeedback('');
    } catch {}
  };

  if (loading) return <LoadingSpinner />;
  if (!assignment) return null;

  const isTeacher = hasPermission('assignments.create') || hasPermission('grades.manage');

  return (
    <div>
      <button
        onClick={() => navigate('/assignments')}
        className="flex items-center gap-2 text-sm mb-4"
        style={{ color: 'var(--text-secondary)' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
      >
        <ArrowLeft className="w-4 h-4" /> Back to Assignments
      </button>

      {/* Assignment Info */}
      <div className="card p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold font-heading" style={{ color: 'var(--text-primary)' }}>{assignment.title}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <span>{assignment.subject_name || assignment.subjectName || assignment.subject}</span>
              <span>{assignment.section_name || assignment.sectionName || assignment.section}</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Due: {(assignment.due_date || assignment.dueDate)?.substring(0, 10) || 'No date'}
              </span>
              <span>Max Score: {assignment.max_score || assignment.maxScore || 100}</span>
            </div>
          </div>
          <Badge variant={assignment.status === 'completed' ? 'success' : 'info'}>{assignment.status || 'active'}</Badge>
        </div>
        {assignment.description && (
          <div className="mt-4 text-sm p-4 rounded-lg" style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--surface-secondary)' }}>
            {assignment.description}
          </div>
        )}
        {assignment.attachments?.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Attachments</p>
            <div className="flex flex-wrap gap-2">
              {assignment.attachments.map((att, i) => (
                <a
                  key={i}
                  href={att.url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg text-sm"
                  style={{ backgroundColor: 'var(--surface-secondary)', color: 'var(--accent)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface-hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface-secondary)'; }}
                >
                  {att.name || `Attachment ${i + 1}`}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Student Submission Form */}
      {!isTeacher && (
        <div className="card p-6 mb-6">
          <h3 className="text-sm font-semibold font-heading mb-3" style={{ color: 'var(--text-primary)' }}>Your Submission</h3>
          <textarea
            value={submissionText}
            onChange={(e) => setSubmissionText(e.target.value)}
            rows={4}
            placeholder="Enter your submission or paste a link..."
            className="input w-full px-3 py-2 text-sm mb-3"
          />
          <div className="flex items-center gap-3">
            <button className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium">
              <Upload className="w-4 h-4" /> Attach File
            </button>
            <button onClick={handleSubmit} disabled={submitting || !submissionText} className="btn-primary px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60">
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </div>
      )}

      {/* Submissions List (Teacher View) */}
      {isTeacher && (
        <div className="card p-6">
          <h3 className="text-sm font-semibold font-heading mb-4" style={{ color: 'var(--text-primary)' }}>Submissions ({submissions.length})</h3>
          {submissions.length === 0 ? (
            <p className="text-center py-8" style={{ color: 'var(--text-tertiary)' }}>No submissions yet</p>
          ) : (
            <div className="space-y-4">
              {submissions.map((sub) => (
                <div key={sub._id || sub.id} className="rounded-lg p-4" style={{ border: '1px solid var(--border-default)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{sub.studentName || sub.student}</p>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Submitted: {sub.submittedAt?.substring(0, 16)?.replace('T', ' ') || 'N/A'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {sub.score !== undefined && sub.score !== null ? (
                        <Badge variant="success">{sub.score}/{assignment.max_score || assignment.maxScore || 100}</Badge>
                      ) : (
                        <Badge variant="warning">Ungraded</Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-sm p-3 rounded-lg" style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--surface-secondary)' }}>{sub.content || 'No content'}</p>

                  {/* Grading */}
                  {gradingId === (sub._id || sub.id) ? (
                    <div className="mt-3 flex items-end gap-3">
                      <div>
                        <label className="label block text-xs mb-1">Score</label>
                        <input type="number" value={gradeValue} onChange={(e) => setGradeValue(e.target.value)} max={assignment.max_score || assignment.maxScore || 100} min={0} className="input w-20 px-2 py-1.5 text-sm" />
                      </div>
                      <div className="flex-1">
                        <label className="label block text-xs mb-1">Feedback</label>
                        <input value={feedback} onChange={(e) => setFeedback(e.target.value)} className="input w-full px-2 py-1.5 text-sm" />
                      </div>
                      <button onClick={() => handleGrade(sub._id || sub.id)} className="p-1.5 rounded-lg" style={{ backgroundColor: 'var(--success-text)', color: '#fff' }}><Check className="w-4 h-4" /></button>
                      <button
                        onClick={() => setGradingId(null)}
                        className="p-1.5 rounded-lg"
                        style={{ backgroundColor: 'var(--surface-secondary)', color: 'var(--text-secondary)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface-hover)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface-secondary)'; }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setGradingId(sub._id || sub.id); setGradeValue(sub.score || ''); setFeedback(sub.feedback || ''); }}
                      className="mt-2 text-sm font-medium"
                      style={{ color: 'var(--accent)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                    >
                      {sub.score !== undefined && sub.score !== null ? 'Edit Grade' : 'Grade'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
