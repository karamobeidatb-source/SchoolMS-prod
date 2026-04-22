import { useState, useEffect } from 'react';
import api from '../../utils/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Printer, Search, Download } from 'lucide-react';

export default function ReportCardPage() {
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [semester, setSemester] = useState('');
  const [trends, setTrends] = useState([]);
  const [loadingTrends, setLoadingTrends] = useState(false);

  useEffect(() => {
    api.get('/students', { params: { status: 'active' } })
      .then((res) => setStudents(res.data.students || res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedStudent) { setReportData(null); setTrends([]); return; }
    setLoading(true);
    const params = {};
    if (semester) params.semester = semester;
    api.get(`/grades/report/${selectedStudent}`, { params })
      .then((res) => setReportData(res.data))
      .catch(() => setReportData({ subjects: [], comments: '', student: {} }))
      .finally(() => setLoading(false));

    // Fetch grade trends
    setLoadingTrends(true);
    api.get(`/grades/trends/${selectedStudent}`)
      .then((res) => setTrends(res.data.trends || res.data || []))
      .catch(() => setTrends([]))
      .finally(() => setLoadingTrends(false));
  }, [selectedStudent, semester]);

  const filteredStudents = students.filter((s) => {
    const sName = s.first_name ? `${s.first_name} ${s.last_name || ''}` : (s.nameEn || s.name || '');
    return sName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.student_number || s.studentNumber || '').includes(searchQuery);
  });

  const handlePrint = () => window.print();

  const handleDownloadPDF = async () => {
    try {
      const res = await api.get(`/grades/report/${selectedStudent}/pdf`, {
        params: { academic_year: reportData.academicYear, semester },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report-card-${selectedStudent}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {}
  };

  if (loading && !students.length) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold font-heading" style={{ color: 'var(--text-primary)' }}>Report Card</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Generate and view student report cards</p>
        </div>
        {reportData && (
          <div className="flex items-center gap-2 print:hidden">
            <button onClick={handleDownloadPDF} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: 'var(--success-text)', color: '#fff' }}>
              <Download className="w-4 h-4" /> Download PDF
            </button>
            <button onClick={handlePrint} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium">
              <Printer className="w-4 h-4" /> Print / PDF
            </button>
          </div>
        )}
      </div>

      {/* Student Selector and Semester Filter */}
      <div className="card p-4 mb-6 print:hidden">
        <div className="flex items-center gap-4 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
            <input
              type="text"
              placeholder="Search students..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input w-full pl-10 pr-4 py-2 text-sm"
            />
          </div>
          <div>
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              className="input px-3 py-2 text-sm"
            >
              <option value="">All Semesters</option>
              <option value="1">Semester 1</option>
              <option value="2">Semester 2</option>
            </select>
          </div>
        </div>
        <div className="max-h-48 overflow-y-auto space-y-1">
          {filteredStudents.map((s) => {
            const sName = s.first_name ? `${s.first_name} ${s.last_name || ''}`.trim() : (s.nameEn || s.name);
            return (
              <button
                key={s.id || s._id}
                onClick={() => setSelectedStudent(s.id || s._id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedStudent === (s.id || s._id)
                    ? 'font-medium'
                    : ''
                }`}
                style={
                  selectedStudent === (s.id || s._id)
                    ? { backgroundColor: 'var(--accent-subtle)', color: 'var(--accent)' }
                    : { color: 'var(--text-secondary)' }
                }
                onMouseEnter={(e) => { if (selectedStudent !== (s.id || s._id)) e.currentTarget.style.backgroundColor = 'var(--surface-hover)'; }}
                onMouseLeave={(e) => { if (selectedStudent !== (s.id || s._id)) e.currentTarget.style.backgroundColor = ''; }}
              >
                {sName} <span style={{ color: 'var(--text-tertiary)' }} className="ml-2">#{s.student_number || s.studentNumber}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Report Card */}
      {loading && selectedStudent ? (
        <LoadingSpinner />
      ) : reportData ? (
        <>
          <div className="card p-8 print:shadow-none print:p-0 print:border-2" style={{ printBorderColor: 'var(--border-default)' }}>
            {/* Branded Header */}
            <div className="text-center mb-8 pb-6" style={{ borderBottom: '2px solid var(--accent)' }}>
              <div className="mb-2">
                <h2 className="text-2xl font-bold font-heading" style={{ color: 'var(--accent)' }}>SchoolOS Academy</h2>
                <p className="text-xs uppercase tracking-widest mt-1" style={{ color: 'var(--text-secondary)' }}>Excellence in Education</p>
              </div>
              <div className="rounded-lg py-3 px-4 mt-4" style={{ backgroundColor: 'var(--accent-subtle)' }}>
                <h3 className="text-lg font-bold font-heading" style={{ color: 'var(--text-primary)' }}>Official Report Card</h3>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{reportData.academicYear || 'Academic Year'} - {semester ? `Semester ${semester}` : (reportData.semester || 'All Semesters')}</p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm text-left max-w-md mx-auto">
                <div>
                  <p style={{ color: 'var(--text-secondary)' }}>Student Name</p>
                  <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{reportData.student?.nameEn || reportData.student?.name || 'N/A'}</p>
                </div>
                <div>
                  <p style={{ color: 'var(--text-secondary)' }}>Student Number</p>
                  <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{reportData.student?.studentNumber || reportData.student?.student_number || 'N/A'}</p>
                </div>
                <div>
                  <p style={{ color: 'var(--text-secondary)' }}>Grade</p>
                  <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{reportData.student?.gradeName || 'N/A'}</p>
                </div>
                <div>
                  <p style={{ color: 'var(--text-secondary)' }}>Section</p>
                  <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{reportData.student?.sectionName || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Grades Table */}
            <table className="w-full text-sm mb-8">
              <thead>
                <tr style={{ backgroundColor: 'var(--surface-secondary)' }}>
                  <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--text-secondary)' }}>Subject</th>
                  <th className="px-4 py-3 text-center font-medium" style={{ color: 'var(--text-secondary)' }}>Category</th>
                  <th className="px-4 py-3 text-center font-medium" style={{ color: 'var(--text-secondary)' }}>Score</th>
                  <th className="px-4 py-3 text-center font-medium" style={{ color: 'var(--text-secondary)' }}>Max</th>
                  <th className="px-4 py-3 text-center font-medium" style={{ color: 'var(--text-secondary)' }}>Comment</th>
                </tr>
              </thead>
              <tbody>
                {(reportData.subjects || []).length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center" style={{ color: 'var(--text-tertiary)' }}>No grade data available</td></tr>
                ) : (
                  reportData.subjects.map((sub, i) => {
                    const subjectName = sub.subject?.name_en || sub.subject?.name || sub.subject || sub.name || '';
                    const subGrades = sub.grades || [];
                    if (subGrades.length === 0) {
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td className="px-4 py-3 font-medium">{subjectName}</td>
                          <td className="px-4 py-3 text-center" style={{ color: 'var(--text-tertiary)' }} colSpan={4}>No grades</td>
                        </tr>
                      );
                    }
                    return subGrades.map((g, j) => (
                      <tr key={`${i}-${j}`} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        {j === 0 && <td className="px-4 py-3 font-medium" rowSpan={subGrades.length}>{subjectName}</td>}
                        <td className="px-4 py-3 text-center">{g.category || g.title || '-'}</td>
                        <td className="px-4 py-3 text-center font-bold">{g.score ?? '-'}</td>
                        <td className="px-4 py-3 text-center">{g.max_score ?? '-'}</td>
                        {j === 0 && <td className="px-4 py-3 text-center text-sm" style={{ color: 'var(--text-secondary)' }} rowSpan={subGrades.length}>{sub.comment || '-'}</td>}
                      </tr>
                    ));
                  })
                )}
              </tbody>
            </table>

            {/* Comments */}
            <div className="pt-6" style={{ borderTop: '1px solid var(--border-default)' }}>
              <h3 className="text-sm font-semibold font-heading mb-2" style={{ color: 'var(--text-primary)' }}>Teacher Comments</h3>
              <div className="space-y-2">
                {(reportData.subjects || []).filter((s) => s.comment).map((s, i) => (
                  <div key={i} className="text-sm p-3 rounded-lg" style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--surface-secondary)' }}>
                    <span className="font-medium">{s.subject?.name_en || s.subject?.name || s.subject}:</span> {s.comment}
                  </div>
                ))}
                {(reportData.subjects || []).filter((s) => s.comment).length === 0 && (
                  <p className="text-sm p-4 rounded-lg" style={{ color: 'var(--text-tertiary)', backgroundColor: 'var(--surface-secondary)' }}>No comments provided.</p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-4 text-center" style={{ borderTop: '2px solid var(--accent)' }}>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>This is an official document issued by SchoolOS Academy</p>
            </div>
          </div>

          {/* Grade Trends */}
          <div className="card p-6 mt-6 print:hidden">
            <h3 className="text-sm font-semibold font-heading mb-4" style={{ color: 'var(--text-primary)' }}>Grade Trends - Semester Comparison</h3>
            {loadingTrends ? (
              <LoadingSpinner />
            ) : trends.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: 'var(--text-tertiary)' }}>No trend data available</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ backgroundColor: 'var(--surface-secondary)', borderBottom: '1px solid var(--border-default)' }}>
                      <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--text-secondary)' }}>Subject</th>
                      <th className="px-4 py-3 text-center font-medium" style={{ color: 'var(--text-secondary)' }}>Sem 1 Avg</th>
                      <th className="px-4 py-3 text-center font-medium" style={{ color: 'var(--text-secondary)' }}>Sem 2 Avg</th>
                      <th className="px-4 py-3 text-center font-medium" style={{ color: 'var(--text-secondary)' }}>Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trends.map((t, i) => {
                      const sem1 = t.sem1_avg ?? t.semester1 ?? t.sem1 ?? '-';
                      const sem2 = t.sem2_avg ?? t.semester2 ?? t.sem2 ?? '-';
                      const change = (typeof sem1 === 'number' && typeof sem2 === 'number') ? (sem2 - sem1).toFixed(1) : '-';
                      const changeStyle = change !== '-'
                        ? (parseFloat(change) > 0 ? { color: 'var(--success-text)' } : parseFloat(change) < 0 ? { color: 'var(--error-text)' } : { color: 'var(--text-secondary)' })
                        : { color: 'var(--text-secondary)' };
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td className="px-4 py-3 font-medium">{t.subject_name || t.subject || t.name || `Subject ${i + 1}`}</td>
                          <td className="px-4 py-3 text-center">{typeof sem1 === 'number' ? sem1.toFixed(1) : sem1}</td>
                          <td className="px-4 py-3 text-center">{typeof sem2 === 'number' ? sem2.toFixed(1) : sem2}</td>
                          <td className="px-4 py-3 text-center font-medium" style={changeStyle}>
                            {change !== '-' ? (parseFloat(change) > 0 ? `+${change}` : change) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="card p-12 text-center" style={{ color: 'var(--text-tertiary)' }}>
          <p>Select a student to view their report card</p>
        </div>
      )}
    </div>
  );
}
