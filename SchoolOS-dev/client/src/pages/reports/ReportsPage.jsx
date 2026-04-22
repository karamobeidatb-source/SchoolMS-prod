import { useState, useEffect } from 'react';
import api from '../../utils/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import { BarChart3, Download, Filter, Users, ClipboardCheck, GraduationCap, AlertTriangle, Printer } from 'lucide-react';

const reportTypes = [
  { key: 'academic', label: 'Academic', icon: GraduationCap },
  { key: 'attendance', label: 'Attendance', icon: ClipboardCheck },
  { key: 'enrollment', label: 'Enrollment', icon: Users },
];

export default function ReportsPage() {
  const [type, setType] = useState('academic');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gradeFilter, setGradeFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [grades, setGrades] = useState([]);
  const [sections, setSections] = useState([]);

  // Sub-reports
  const [semesterComparison, setSemesterComparison] = useState(null);
  const [loadingSemComp, setLoadingSemComp] = useState(false);
  const [chronicAbsentees, setChronicAbsentees] = useState([]);
  const [loadingChronic, setLoadingChronic] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/grade-levels').catch(() => ({ data: [] })),
      api.get('/sections').catch(() => ({ data: [] })),
    ]).then(([gRes, sRes]) => {
      setGrades(gRes.data || []);
      setSections(sRes.data || []);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    setData(null);

    if (type === 'academic') {
      const params = {};
      if (sectionFilter) params.section_id = sectionFilter;
      api.get('/reports/academic', { params })
        .then((res) => setData(res.data))
        .catch(() => setData(null))
        .finally(() => setLoading(false));
    } else if (type === 'attendance') {
      const params = {};
      if (gradeFilter) params.grade_level_id = gradeFilter;
      if (sectionFilter) params.section_id = sectionFilter;
      if (dateFrom) params.from_date = dateFrom;
      if (dateTo) params.to_date = dateTo;
      api.get('/reports/attendance', { params })
        .then((res) => setData(res.data))
        .catch(() => setData(null))
        .finally(() => setLoading(false));
    } else if (type === 'enrollment') {
      api.get('/reports/enrollment')
        .then((res) => setData(res.data))
        .catch(() => setData(null))
        .finally(() => setLoading(false));
    }
  }, [type, gradeFilter, sectionFilter, dateFrom, dateTo]);

  // Semester comparison for academic
  useEffect(() => {
    if (type === 'academic') {
      setLoadingSemComp(true);
      api.get('/reports/semester-comparison')
        .then((res) => setSemesterComparison(res.data))
        .catch(() => setSemesterComparison(null))
        .finally(() => setLoadingSemComp(false));
    }
  }, [type]);

  // Chronic absenteeism for attendance
  useEffect(() => {
    if (type === 'attendance') {
      setLoadingChronic(true);
      api.get('/reports/chronic-absenteeism')
        .then((res) => setChronicAbsentees(res.data.students || []))
        .catch(() => setChronicAbsentees([]))
        .finally(() => setLoadingChronic(false));
    }
  }, [type]);

  const renderBar = (value, max, color) => {
    const pct = max > 0 ? (value / max) * 100 : 0;
    return (
      <div className="w-full rounded-full h-4" style={{ backgroundColor: 'var(--surface-secondary)' }}>
        <div className={`h-4 rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    );
  };

  const handleExportPDF = () => window.print();

  const handleExportCSV = () => {
    let rows = [];
    if (type === 'academic' && data?.averages) {
      rows = data.averages.map(a => ({
        Subject: a.subject_name_en,
        Code: a.subject_code,
        'Average %': a.average_percent,
        Students: a.student_count,
        Min: a.min_percent ?? '',
        Max: a.max_percent ?? '',
      }));
    } else if (type === 'attendance' && data?.mostAbsent) {
      rows = data.mostAbsent.map(s => ({
        Student: `${s.first_name} ${s.last_name}`,
        ID: s.student_number,
        Grade: s.grade_name_en,
        Section: s.section_name_en,
        Absences: s.absence_count,
      }));
    } else if (type === 'enrollment' && data?.byGrade) {
      rows = data.byGrade.map(g => ({
        Grade: g.name_en,
        Active: g.active,
        Graduated: g.graduated,
        Transferred: g.transferred,
        Withdrawn: g.withdrawn,
        Total: g.total,
      }));
    }
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const csvRows = rows.map(row => headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report_${type}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-amber-500', 'bg-red-500', 'bg-teal-500', 'bg-pink-500', 'bg-indigo-500'];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold font-heading" style={{ color: 'var(--text-primary)' }}>Reports</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Analyze school data and generate reports</p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <button onClick={handleExportPDF} className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button onClick={handleExportCSV} className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Report Type Selector */}
      <div className="flex gap-3 mb-6 print:hidden">
        {reportTypes.map((rt) => (
          <button
            key={rt.key}
            onClick={() => { setType(rt.key); setData(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              type === rt.key ? 'btn-primary' : 'card'
            }`}
            style={type !== rt.key ? { color: 'var(--text-secondary)' } : {}}
          >
            <rt.icon className="w-4 h-4" />
            {rt.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6 print:hidden">
        <div className="flex items-center gap-3 flex-wrap">
          <Filter className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
          {type !== 'enrollment' && (
            <select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)} className="input px-3 py-1.5 rounded-lg text-sm">
              <option value="">All Sections</option>
              {sections.map((s) => <option key={s.id || s._id} value={s.id || s._id}>{s.name_en || s.name}</option>)}
            </select>
          )}
          {type === 'attendance' && (
            <>
              <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} className="input px-3 py-1.5 rounded-lg text-sm">
                <option value="">All Grades</option>
                {grades.map((g) => <option key={g.id || g._id} value={g.id || g._id}>{g.name_en || g.name}</option>)}
              </select>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input px-3 py-1.5 rounded-lg text-sm" placeholder="From" />
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input px-3 py-1.5 rounded-lg text-sm" placeholder="To" />
            </>
          )}
        </div>
      </div>

      {loading ? <LoadingSpinner /> : !data ? (
        <div className="card p-12 text-center" style={{ color: 'var(--text-tertiary)' }}>
          <BarChart3 className="w-10 h-10 mx-auto mb-2" />
          <p className="text-sm">No report data available</p>
        </div>
      ) : (
        <>
          {/* =================== ACADEMIC REPORT =================== */}
          {type === 'academic' && (
            <>
              {/* Summary */}
              {data.averages && data.averages.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  <div className="card p-4 text-center">
                    <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{data.averages.length}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Subjects</p>
                  </div>
                  <div className="card p-4 text-center">
                    <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                      {(data.averages.reduce((s, a) => s + (a.average_percent || 0), 0) / data.averages.length).toFixed(1)}%
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Overall Average</p>
                  </div>
                  <div className="card p-4 text-center">
                    <p className="text-2xl font-bold" style={{ color: 'var(--success-text)' }}>
                      {data.averages.reduce((max, a) => Math.max(max, a.average_percent || 0), 0).toFixed(1)}%
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Highest Subject Avg</p>
                  </div>
                  <div className="card p-4 text-center">
                    <p className="text-2xl font-bold" style={{ color: 'var(--error-text)' }}>
                      {data.averages.reduce((min, a) => Math.min(min, a.average_percent || 100), 100).toFixed(1)}%
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Lowest Subject Avg</p>
                  </div>
                </div>
              )}

              {/* Bar Chart */}
              <div className="card p-6 mb-6">
                <h3 className="text-sm font-semibold font-heading mb-4" style={{ color: 'var(--text-primary)' }}>Subject Averages</h3>
                {(!data.averages || data.averages.length === 0) ? (
                  <div className="text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
                    <BarChart3 className="w-10 h-10 mx-auto mb-2" />
                    <p className="text-sm">No grades data available</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.averages.map((item, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <span className="text-sm w-40 truncate" style={{ color: 'var(--text-secondary)' }}>{item.subject_name_en}</span>
                        <div className="flex-1">{renderBar(item.average_percent || 0, 100, colors[i % colors.length])}</div>
                        <span className="text-sm font-medium w-16 text-right" style={{ color: 'var(--text-primary)' }}>{item.average_percent ?? 0}%</span>
                        <span className="text-xs w-20 text-right" style={{ color: 'var(--text-tertiary)' }}>{item.student_count} students</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Detailed Table */}
              {data.averages && data.averages.length > 0 && (
                <div className="card p-6 mb-6">
                  <h3 className="text-sm font-semibold font-heading mb-4" style={{ color: 'var(--text-primary)' }}>Detailed Breakdown</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ backgroundColor: 'var(--surface-secondary)', borderBottom: '1px solid var(--border-default)' }}>
                          <th className="px-4 py-2 text-left font-medium" style={{ color: 'var(--text-secondary)' }}>Subject</th>
                          <th className="px-4 py-2 text-left font-medium" style={{ color: 'var(--text-secondary)' }}>Code</th>
                          <th className="px-4 py-2 text-center font-medium" style={{ color: 'var(--text-secondary)' }}>Average</th>
                          <th className="px-4 py-2 text-center font-medium" style={{ color: 'var(--text-secondary)' }}>Min</th>
                          <th className="px-4 py-2 text-center font-medium" style={{ color: 'var(--text-secondary)' }}>Max</th>
                          <th className="px-4 py-2 text-center font-medium" style={{ color: 'var(--text-secondary)' }}>Students</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.averages.map((row, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td className="px-4 py-2 font-medium">{row.subject_name_en}</td>
                            <td className="px-4 py-2" style={{ color: 'var(--text-secondary)' }}>{row.subject_code}</td>
                            <td className="px-4 py-2 text-center font-bold">{row.average_percent ?? '-'}%</td>
                            <td className="px-4 py-2 text-center" style={{ color: 'var(--error-text)' }}>{row.min_percent ?? '-'}%</td>
                            <td className="px-4 py-2 text-center" style={{ color: 'var(--success-text)' }}>{row.max_percent ?? '-'}%</td>
                            <td className="px-4 py-2 text-center">{row.student_count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Semester Comparison */}
              <div className="card p-6 mb-6">
                <h3 className="text-sm font-semibold font-heading mb-4" style={{ color: 'var(--text-primary)' }}>Semester Comparison</h3>
                {loadingSemComp ? <LoadingSpinner /> : (
                  !semesterComparison?.subjects || semesterComparison.subjects.length === 0 ? (
                    <p className="text-sm text-center py-4" style={{ color: 'var(--text-tertiary)' }}>No semester comparison data available</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ backgroundColor: 'var(--surface-secondary)', borderBottom: '1px solid var(--border-default)' }}>
                            <th className="px-4 py-2 text-left font-medium" style={{ color: 'var(--text-secondary)' }}>Subject</th>
                            <th className="px-4 py-2 text-center font-medium" style={{ color: 'var(--text-secondary)' }}>Sem 1 Avg</th>
                            <th className="px-4 py-2 text-center font-medium" style={{ color: 'var(--text-secondary)' }}>Sem 2 Avg</th>
                            <th className="px-4 py-2 text-center font-medium" style={{ color: 'var(--text-secondary)' }}>Change</th>
                          </tr>
                        </thead>
                        <tbody>
                          {semesterComparison.subjects.map((subj, i) => {
                            const sem1 = subj.semesters?.['1']?.average_percent;
                            const sem2 = subj.semesters?.['2']?.average_percent;
                            const change = (sem1 != null && sem2 != null) ? (sem2 - sem1).toFixed(1) : null;
                            const changeColor = change != null ? (parseFloat(change) > 0 ? 'var(--success-text)' : parseFloat(change) < 0 ? 'var(--error-text)' : 'var(--text-secondary)') : 'var(--text-tertiary)';
                            return (
                              <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <td className="px-4 py-2 font-medium">{subj.subject_name_en}</td>
                                <td className="px-4 py-2 text-center">{sem1 != null ? `${sem1}%` : '-'}</td>
                                <td className="px-4 py-2 text-center">{sem2 != null ? `${sem2}%` : '-'}</td>
                                <td className="px-4 py-2 text-center font-medium" style={{ color: changeColor }}>
                                  {change != null ? (parseFloat(change) > 0 ? `+${change}%` : `${change}%`) : '-'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )
                )}
              </div>
            </>
          )}

          {/* =================== ATTENDANCE REPORT =================== */}
          {type === 'attendance' && (
            <>
              {/* Summary cards from daily data */}
              {data.daily && data.daily.length > 0 && (() => {
                const totalPresent = data.daily.reduce((s, d) => s + (d.present || 0), 0);
                const totalAbsent = data.daily.reduce((s, d) => s + (d.absent || 0), 0);
                const totalLate = data.daily.reduce((s, d) => s + (d.late || 0), 0);
                const totalExcused = data.daily.reduce((s, d) => s + (d.excused || 0), 0);
                const totalAll = data.daily.reduce((s, d) => s + (d.total || 0), 0);
                const avgRate = totalAll > 0 ? ((totalPresent + totalLate) / totalAll * 100).toFixed(1) : 0;
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
                    <div className="card p-4 text-center">
                      <p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{avgRate}%</p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Attendance Rate</p>
                    </div>
                    <div className="card p-4 text-center">
                      <p className="text-2xl font-bold" style={{ color: 'var(--success-text)' }}>{totalPresent}</p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Present</p>
                    </div>
                    <div className="card p-4 text-center">
                      <p className="text-2xl font-bold" style={{ color: 'var(--error-text)' }}>{totalAbsent}</p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Absent</p>
                    </div>
                    <div className="card p-4 text-center">
                      <p className="text-2xl font-bold" style={{ color: 'var(--warning-text)' }}>{totalLate}</p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Late</p>
                    </div>
                    <div className="card p-4 text-center">
                      <p className="text-2xl font-bold" style={{ color: 'var(--text-secondary)' }}>{totalExcused}</p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Excused</p>
                    </div>
                  </div>
                );
              })()}

              {/* Daily attendance chart */}
              <div className="card p-6 mb-6">
                <h3 className="text-sm font-semibold font-heading mb-4" style={{ color: 'var(--text-primary)' }}>Daily Attendance</h3>
                {(!data.daily || data.daily.length === 0) ? (
                  <div className="text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
                    <BarChart3 className="w-10 h-10 mx-auto mb-2" />
                    <p className="text-sm">No attendance data for the selected period</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ backgroundColor: 'var(--surface-secondary)', borderBottom: '1px solid var(--border-default)' }}>
                          <th className="px-4 py-2 text-left font-medium" style={{ color: 'var(--text-secondary)' }}>Date</th>
                          <th className="px-4 py-2 text-center font-medium" style={{ color: 'var(--success-text)' }}>Present</th>
                          <th className="px-4 py-2 text-center font-medium" style={{ color: 'var(--error-text)' }}>Absent</th>
                          <th className="px-4 py-2 text-center font-medium" style={{ color: 'var(--warning-text)' }}>Late</th>
                          <th className="px-4 py-2 text-center font-medium" style={{ color: 'var(--text-secondary)' }}>Excused</th>
                          <th className="px-4 py-2 text-center font-medium" style={{ color: 'var(--text-secondary)' }}>Total</th>
                          <th className="px-4 py-2 text-center font-medium" style={{ color: 'var(--text-secondary)' }}>Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.daily.map((day, i) => {
                          const rate = day.total > 0 ? (((day.present || 0) + (day.late || 0)) / day.total * 100).toFixed(1) : 0;
                          return (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <td className="px-4 py-2 font-medium">{day.date}</td>
                              <td className="px-4 py-2 text-center" style={{ color: 'var(--success-text)' }}>{day.present || 0}</td>
                              <td className="px-4 py-2 text-center" style={{ color: 'var(--error-text)' }}>{day.absent || 0}</td>
                              <td className="px-4 py-2 text-center" style={{ color: 'var(--warning-text)' }}>{day.late || 0}</td>
                              <td className="px-4 py-2 text-center">{day.excused || 0}</td>
                              <td className="px-4 py-2 text-center">{day.total || 0}</td>
                              <td className="px-4 py-2 text-center font-medium">{rate}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Most Absent Students */}
              {data.mostAbsent && data.mostAbsent.length > 0 && (
                <div className="card p-6 mb-6">
                  <h3 className="text-sm font-semibold font-heading mb-4" style={{ color: 'var(--text-primary)' }}>Most Absent Students</h3>
                  <div className="space-y-3">
                    {data.mostAbsent.map((s, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <span className="text-sm w-48 truncate" style={{ color: 'var(--text-secondary)' }}>{s.first_name} {s.last_name}</span>
                        <span className="text-xs w-24" style={{ color: 'var(--text-tertiary)' }}>{s.grade_name_en || ''}</span>
                        <div className="flex-1">{renderBar(s.absence_count, data.mostAbsent[0]?.absence_count || 1, 'bg-red-500')}</div>
                        <span className="text-sm font-medium w-20 text-right" style={{ color: 'var(--error-text)' }}>{s.absence_count} days</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Chronic Absenteeism */}
              <div className="card p-6 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-5 h-5" style={{ color: 'var(--error-text)' }} />
                  <h3 className="text-sm font-semibold font-heading" style={{ color: 'var(--text-primary)' }}>Chronic Absenteeism (Over 20% Absence Rate)</h3>
                </div>
                {loadingChronic ? <LoadingSpinner /> : chronicAbsentees.length === 0 ? (
                  <p className="text-sm text-center py-4" style={{ color: 'var(--text-tertiary)' }}>No students with chronic absenteeism</p>
                ) : (
                  <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--error-border)' }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ backgroundColor: 'var(--error-subtle)' }}>
                          <th className="px-4 py-2 text-left font-medium" style={{ color: 'var(--error-text)' }}>Student</th>
                          <th className="px-4 py-2 text-left font-medium" style={{ color: 'var(--error-text)' }}>Grade</th>
                          <th className="px-4 py-2 text-left font-medium" style={{ color: 'var(--error-text)' }}>Section</th>
                          <th className="px-4 py-2 text-center font-medium" style={{ color: 'var(--error-text)' }}>Total Records</th>
                          <th className="px-4 py-2 text-center font-medium" style={{ color: 'var(--error-text)' }}>Absent</th>
                          <th className="px-4 py-2 text-center font-medium" style={{ color: 'var(--error-text)' }}>Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chronicAbsentees.map((s, i) => (
                          <tr key={i} style={{ borderTop: '1px solid var(--error-border)' }}>
                            <td className="px-4 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{s.first_name} {s.last_name}</td>
                            <td className="px-4 py-2" style={{ color: 'var(--text-secondary)' }}>{s.grade_name_en || '-'}</td>
                            <td className="px-4 py-2" style={{ color: 'var(--text-secondary)' }}>{s.section_name_en || '-'}</td>
                            <td className="px-4 py-2 text-center">{s.total_records || '-'}</td>
                            <td className="px-4 py-2 text-center font-medium" style={{ color: 'var(--error-text)' }}>{s.absent_count || '-'}</td>
                            <td className="px-4 py-2 text-center">
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: 'var(--error-subtle)', color: 'var(--error-text)' }}>
                                {s.absence_rate != null ? `${s.absence_rate}%` : '-'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* =================== ENROLLMENT REPORT =================== */}
          {type === 'enrollment' && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="card p-4 text-center">
                  <p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{data.totalActive || 0}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Active Students</p>
                </div>
                <div className="card p-4 text-center">
                  <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{data.totalAll || 0}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Total Students</p>
                </div>
                <div className="card p-4 text-center">
                  <p className="text-2xl font-bold" style={{ color: 'var(--success-text)' }}>{data.byGrade?.length || 0}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Grade Levels</p>
                </div>
                <div className="card p-4 text-center">
                  <p className="text-2xl font-bold text-purple-600">{data.bySection?.length || 0}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Sections</p>
                </div>
              </div>

              {/* Enrollment by Grade - Bar chart */}
              <div className="card p-6 mb-6">
                <h3 className="text-sm font-semibold font-heading mb-4" style={{ color: 'var(--text-primary)' }}>Enrollment by Grade</h3>
                {(!data.byGrade || data.byGrade.length === 0) ? (
                  <p className="text-sm text-center py-8" style={{ color: 'var(--text-tertiary)' }}>No grade data</p>
                ) : (
                  <div className="space-y-3">
                    {data.byGrade.map((g, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <span className="text-sm w-32 truncate" style={{ color: 'var(--text-secondary)' }}>{g.name_en}</span>
                        <div className="flex-1">{renderBar(g.active || 0, Math.max(...data.byGrade.map(x => x.active || 0), 1), colors[i % colors.length])}</div>
                        <span className="text-sm font-medium w-20 text-right" style={{ color: 'var(--text-primary)' }}>{g.active || 0} active</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Enrollment by Grade - Table */}
              {data.byGrade && data.byGrade.length > 0 && (
                <div className="card p-6 mb-6">
                  <h3 className="text-sm font-semibold font-heading mb-4" style={{ color: 'var(--text-primary)' }}>Grade Breakdown</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ backgroundColor: 'var(--surface-secondary)', borderBottom: '1px solid var(--border-default)' }}>
                          <th className="px-4 py-2 text-left font-medium" style={{ color: 'var(--text-secondary)' }}>Grade</th>
                          <th className="px-4 py-2 text-center font-medium" style={{ color: 'var(--success-text)' }}>Active</th>
                          <th className="px-4 py-2 text-center font-medium" style={{ color: 'var(--text-secondary)' }}>Inactive</th>
                          <th className="px-4 py-2 text-center font-medium" style={{ color: 'var(--accent)' }}>Graduated</th>
                          <th className="px-4 py-2 text-center font-medium" style={{ color: 'var(--warning-text)' }}>Transferred</th>
                          <th className="px-4 py-2 text-center font-medium" style={{ color: 'var(--error-text)' }}>Withdrawn</th>
                          <th className="px-4 py-2 text-center font-medium" style={{ color: 'var(--text-primary)' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.byGrade.map((g, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td className="px-4 py-2 font-medium">{g.name_en}</td>
                            <td className="px-4 py-2 text-center font-medium" style={{ color: 'var(--success-text)' }}>{g.active || 0}</td>
                            <td className="px-4 py-2 text-center">{g.inactive || 0}</td>
                            <td className="px-4 py-2 text-center">{g.graduated || 0}</td>
                            <td className="px-4 py-2 text-center">{g.transferred || 0}</td>
                            <td className="px-4 py-2 text-center">{g.withdrawn || 0}</td>
                            <td className="px-4 py-2 text-center font-bold">{g.total || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Section Capacity */}
              {data.bySection && data.bySection.length > 0 && (
                <div className="card p-6 mb-6">
                  <h3 className="text-sm font-semibold font-heading mb-4" style={{ color: 'var(--text-primary)' }}>Section Capacity</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ backgroundColor: 'var(--surface-secondary)', borderBottom: '1px solid var(--border-default)' }}>
                          <th className="px-4 py-2 text-left font-medium" style={{ color: 'var(--text-secondary)' }}>Section</th>
                          <th className="px-4 py-2 text-left font-medium" style={{ color: 'var(--text-secondary)' }}>Grade</th>
                          <th className="px-4 py-2 text-center font-medium" style={{ color: 'var(--text-secondary)' }}>Enrolled</th>
                          <th className="px-4 py-2 text-center font-medium" style={{ color: 'var(--text-secondary)' }}>Capacity</th>
                          <th className="px-4 py-2 text-center font-medium" style={{ color: 'var(--text-secondary)' }}>Utilization</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.bySection.map((s, i) => {
                          const util = s.capacity > 0 ? ((s.enrolled / s.capacity) * 100).toFixed(0) : 0;
                          const utilColor = util > 90 ? 'var(--error-text)' : util > 70 ? 'var(--warning-text)' : 'var(--success-text)';
                          return (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <td className="px-4 py-2 font-medium">{s.section_name_en}</td>
                              <td className="px-4 py-2" style={{ color: 'var(--text-secondary)' }}>{s.grade_name_en}</td>
                              <td className="px-4 py-2 text-center">{s.enrolled || 0}</td>
                              <td className="px-4 py-2 text-center">{s.capacity || '-'}</td>
                              <td className="px-4 py-2 text-center font-medium" style={{ color: utilColor }}>{util}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Gender & Nationality */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {data.byGender && data.byGender.length > 0 && (
                  <div className="card p-6">
                    <h3 className="text-sm font-semibold font-heading mb-4" style={{ color: 'var(--text-primary)' }}>By Gender</h3>
                    <div className="space-y-3">
                      {data.byGender.map((g, i) => (
                        <div key={i} className="flex items-center gap-4">
                          <span className="text-sm w-20 capitalize" style={{ color: 'var(--text-secondary)' }}>{g.gender || 'Unknown'}</span>
                          <div className="flex-1">{renderBar(g.count, data.totalActive || 1, i === 0 ? 'bg-blue-500' : 'bg-pink-500')}</div>
                          <span className="text-sm font-medium w-16 text-right" style={{ color: 'var(--text-primary)' }}>{g.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {data.byNationality && data.byNationality.length > 0 && (
                  <div className="card p-6">
                    <h3 className="text-sm font-semibold font-heading mb-4" style={{ color: 'var(--text-primary)' }}>Top Nationalities</h3>
                    <div className="space-y-3">
                      {data.byNationality.map((n, i) => (
                        <div key={i} className="flex items-center gap-4">
                          <span className="text-sm w-28 truncate" style={{ color: 'var(--text-secondary)' }}>{n.nationality || 'Unknown'}</span>
                          <div className="flex-1">{renderBar(n.count, data.byNationality[0]?.count || 1, colors[i % colors.length])}</div>
                          <span className="text-sm font-medium w-12 text-right" style={{ color: 'var(--text-primary)' }}>{n.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Monthly Enrollment Trend */}
              {data.trend && data.trend.length > 0 && (
                <div className="card p-6 mb-6">
                  <h3 className="text-sm font-semibold font-heading mb-4" style={{ color: 'var(--text-primary)' }}>Monthly Enrollment Trend</h3>
                  <div className="space-y-3">
                    {data.trend.map((t, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <span className="text-sm w-24" style={{ color: 'var(--text-secondary)' }}>{t.month}</span>
                        <div className="flex-1">{renderBar(t.count, Math.max(...data.trend.map(x => x.count), 1), 'bg-blue-500')}</div>
                        <span className="text-sm font-medium w-12 text-right" style={{ color: 'var(--text-primary)' }}>{t.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
