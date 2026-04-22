import { useState, useEffect, useMemo } from 'react';
import api from '../../utils/api';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Filter, AlertTriangle, Download, Printer, Inbox } from 'lucide-react';

const statusLabels = { present: 'Present', absent: 'Absent', late: 'Late', excused: 'Excused' };

export default function AttendanceReports() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [grades, setGrades] = useState([]);
  const [sections, setSections] = useState([]);
  const [summary, setSummary] = useState({ present: 0, absent: 0, late: 0, total: 0 });
  const [chronicAbsentees, setChronicAbsentees] = useState([]);
  const [loadingChronic, setLoadingChronic] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/grade-levels').catch(() => ({ data: [] })),
      api.get('/sections').catch(() => ({ data: [] })),
    ]).then(([gradeRes, secRes]) => {
      setGrades(gradeRes.data || []);
      setSections(secRes.data || []);
    });
    setLoadingChronic(true);
    api.get('/reports/chronic-absenteeism')
      .then((res) => setChronicAbsentees(res.data.students || res.data || []))
      .catch(() => setChronicAbsentees([]))
      .finally(() => setLoadingChronic(false));
  }, []);

  const visibleSections = useMemo(() => {
    const filtered = gradeFilter
      ? sections.filter((s) => String(s.grade_level_id) === String(gradeFilter))
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
  }, [sections, gradeFilter]);

  useEffect(() => {
    setLoading(true);
    api.get('/reports/attendance', { params: { from_date: dateFrom || undefined, to_date: dateTo || undefined, grade_level_id: gradeFilter || undefined, section_id: sectionFilter || undefined } })
      .then((res) => {
        const data = res.data.records || res.data || [];
        setRecords(data);
        const total = data.length;
        const present = data.filter((r) => r.status === 'present').length;
        const absent = data.filter((r) => r.status === 'absent').length;
        const late = data.filter((r) => r.status === 'late').length;
        setSummary({ present, absent, late, total });
      })
      .catch(() => { setRecords([]); setSummary({ present: 0, absent: 0, late: 0, total: 0 }); })
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo, gradeFilter, sectionFilter]);

  const pct = (n) => summary.total > 0 ? ((n / summary.total) * 100).toFixed(1) : '0.0';

  const handleExportPDF = () => window.print();

  const handleExportCSV = () => {
    const headers = ['Date', 'Student', 'Section', 'Status', 'Note'];
    const rows = records.map((r) => [
      r.date?.substring(0, 10) || '',
      r.studentName || r.student || '',
      r.sectionName || r.section || '',
      r.status || '',
      r.note || '',
    ]);
    const csv = [headers.join(','), ...rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'attendance_report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns = [
    { key: 'date', header: 'Date', accessor: (r) => r.date?.substring(0, 10) || '' },
    { key: 'student', header: 'Student', accessor: (r) => r.studentName || r.student || '' },
    { key: 'section', header: 'Section', accessor: (r) => r.sectionName || r.section || '' },
    {
      key: 'status',
      header: 'Status',
      render: (r) => {
        const m = { present: 'success', absent: 'danger', late: 'warning', excused: 'info' };
        return <Badge variant={m[r.status] || 'gray'}>{statusLabels[r.status] || r.status}</Badge>;
      },
      accessor: 'status',
    },
    { key: 'note', header: 'Note', accessor: (r) => r.note || '-' },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-1">
        <div>
          <h1 className="text-2xl font-bold font-heading" style={{ color: 'var(--text-primary)' }}>Attendance Reports</h1>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>View and analyze attendance data</p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <button onClick={handleExportPDF} className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium">
            <Printer className="w-4 h-4" /> Export PDF
          </button>
          <button onClick={handleExportCSV} className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold" style={{ color: 'var(--success-text)' }}>{pct(summary.present)}%</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Present</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold" style={{ color: 'var(--error-text)' }}>{pct(summary.absent)}%</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Absent</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold" style={{ color: 'var(--warning-text)' }}>{pct(summary.late)}%</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Late</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{summary.total}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Total Records</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-4 print:hidden">
        <div className="flex items-center gap-3 flex-wrap">
          <Filter className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input px-3 py-1.5 text-sm" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input px-3 py-1.5 text-sm" />
          <select value={gradeFilter} onChange={(e) => { setGradeFilter(e.target.value); setSectionFilter(''); }} className="input px-3 py-1.5 text-sm">
            <option value="">All Grades</option>
            {grades.map((g) => <option key={g.id || g._id} value={g.id || g._id}>{g.name_en || g.name}</option>)}
          </select>
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            disabled={!gradeFilter}
            title={!gradeFilter ? 'Select a Grade first' : ''}
            className="input px-3 py-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">{gradeFilter ? 'All Sections' : 'Select a Grade first'}</option>
            {visibleSections.map((s) => <option key={s.id || s._id} value={s.id || s._id}>{s.name_en || s.name}</option>)}
          </select>
        </div>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="card p-4">
          <DataTable
            columns={columns}
            data={records}
            emptyMessage={
              <div className="flex flex-col items-center justify-center py-6 gap-2" style={{ color: 'var(--text-tertiary)' }}>
                <Inbox className="w-10 h-10" strokeWidth={1.25} />
                <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No attendance records found for the selected filters</p>
              </div>
            }
          />
        </div>
      )}

      {/* Chronic Absenteeism Section */}
      <div className="card mt-6 p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5" style={{ color: 'var(--error)' }} />
          <h3 className="text-sm font-semibold font-heading" style={{ color: 'var(--text-primary)' }}>Chronic Absenteeism (Over 20% Absence Rate)</h3>
        </div>
        {loadingChronic ? (
          <LoadingSpinner />
        ) : chronicAbsentees.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: 'var(--text-tertiary)' }}>No students with chronic absenteeism detected.</p>
        ) : (
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--error-border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--error-subtle)' }}>
                  <th className="px-4 py-2 text-left font-medium" style={{ color: 'var(--error-text)' }}>Student</th>
                  <th className="px-4 py-2 text-left font-medium" style={{ color: 'var(--error-text)' }}>Grade</th>
                  <th className="px-4 py-2 text-center font-medium" style={{ color: 'var(--error-text)' }}>Total Days</th>
                  <th className="px-4 py-2 text-center font-medium" style={{ color: 'var(--error-text)' }}>Absent Days</th>
                  <th className="px-4 py-2 text-center font-medium" style={{ color: 'var(--error-text)' }}>Absence Rate</th>
                </tr>
              </thead>
              <tbody>
                {chronicAbsentees.map((s, i) => {
                  const name = s.student_name || s.studentName || s.name || 'Unknown';
                  const rate = s.absence_rate || s.absenceRate || s.rate || 0;
                  return (
                    <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <td className="px-4 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{name}</td>
                      <td className="px-4 py-2" style={{ color: 'var(--text-secondary)' }}>{s.grade || s.grade_name || 'N/A'}</td>
                      <td className="px-4 py-2 text-center">{s.total_days || s.totalDays || '-'}</td>
                      <td className="px-4 py-2 text-center font-medium" style={{ color: 'var(--error-text)' }}>{s.absent_days || s.absentDays || '-'}</td>
                      <td className="px-4 py-2 text-center">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: 'var(--error-subtle)', color: 'var(--error-text)' }}>
                          {typeof rate === 'number' ? `${(rate * 100).toFixed(1)}%` : `${rate}%`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
