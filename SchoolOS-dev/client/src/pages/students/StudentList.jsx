import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import LoadingSpinner from '../../components/LoadingSpinner';
import { UserPlus, Download, Filter, GraduationCap, Inbox } from 'lucide-react';

export default function StudentList() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [gradeFilter, setGradeFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showAlumni, setShowAlumni] = useState(false);
  const [grades, setGrades] = useState([]);
  const [sections, setSections] = useState([]);
  const [hoveredRow, setHoveredRow] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api.get('/grade-levels').catch(() => ({ data: [] })),
      api.get('/sections').catch(() => ({ data: [] })),
    ]).then(([gradeRes, secRes]) => {
      setGrades(gradeRes.data || []);
      setSections(secRes.data || []);
    });
  }, []);

  useEffect(() => {
    const effectiveStatus = showAlumni ? 'graduated,transferred' : (statusFilter || undefined);
    setLoading(true);
    api.get('/students', { params: { grade_level_id: gradeFilter || undefined, section_id: sectionFilter || undefined, status: effectiveStatus } })
      .then((studRes) => setStudents(studRes.data.students || studRes.data || []))
      .catch(() => setStudents([]))
      .finally(() => setLoading(false));
  }, [gradeFilter, sectionFilter, statusFilter, showAlumni]);

  const visibleSections = useMemo(() => {
    const filtered = gradeFilter
      ? sections.filter((s) => String(s.grade_level_id) === String(gradeFilter))
      : sections;
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

  const STATUS_META = {
    active:      { variant: 'success', label: 'Active' },
    inactive:    { variant: 'gray',    label: 'Inactive' },
    suspended:   { variant: 'danger',  label: 'Suspended' },
    withdrawn:   { variant: 'warning', label: 'Withdrawn' },
    graduated:   { variant: 'info',    label: 'Graduated' },
    transferred: { variant: 'purple',  label: 'Transferred' },
  };
  const statusBadge = (status) => {
    const meta = STATUS_META[status] || { variant: 'gray', label: status || 'N/A' };
    return <Badge variant={meta.variant}>{meta.label}</Badge>;
  };

  const columns = [
    {
      key: 'photo',
      header: '',
      sortable: false,
      className: 'w-12',
      render: (row) => (
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center font-medium text-xs"
          style={{ backgroundColor: 'var(--accent-subtle)', color: 'var(--accent)' }}
        >
          {row.first_name?.[0] || row.nameEn?.[0] || row.name?.[0] || '?'}
        </div>
      ),
    },
    { key: 'studentNumber', header: 'Student #', accessor: (row) => row.student_number || row.studentNumber || '' },
    {
      key: 'name',
      header: 'Name',
      render: (row) => {
        const nameEn = row.first_name ? `${row.first_name} ${row.last_name || ''}`.trim() : (row.nameEn || row.name || '');
        const nameAr = row.first_name_ar ? `${row.first_name_ar} ${row.last_name_ar || ''}`.trim() : (row.nameAr || '');
        return (
          <div>
            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{nameEn}</p>
            {nameAr && <p className="text-xs" style={{ color: 'var(--text-secondary)' }} dir="rtl">{nameAr}</p>}
          </div>
        );
      },
      accessor: (row) => row.first_name ? `${row.first_name} ${row.last_name || ''}` : (row.nameEn || row.name || ''),
    },
    { key: 'grade', header: 'Grade', accessor: (row) => row.grade_level_name || row.gradeName || row.grade || '' },
    { key: 'section', header: 'Section', accessor: (row) => row.section_name || row.sectionName || row.section || '' },
    { key: 'status', header: 'Status', render: (row) => statusBadge(row.status) },
    {
      key: 'actions',
      header: '',
      sortable: false,
      render: (row) => (
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/students/${row._id || row.id}`); }}
          className="text-sm font-medium"
          style={{ color: 'var(--accent)' }}
        >
          View
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold font-heading" style={{ color: 'var(--text-primary)' }}>{showAlumni ? 'Alumni' : 'Students'}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{students.length} {showAlumni ? 'alumni records' : 'students enrolled'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowAlumni(!showAlumni); setStatusFilter(''); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              showAlumni ? '' : 'btn-secondary'
            }`}
            style={showAlumni ? { backgroundColor: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid var(--accent-subtle)' } : undefined}
          >
            <GraduationCap className="w-4 h-4" /> {showAlumni ? 'Show Active' : 'Show Alumni'}
          </button>
          <button className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium">
            <Download className="w-4 h-4" /> Export
          </button>
          <button
            onClick={() => navigate('/students/new')}
            className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          >
            <UserPlus className="w-4 h-4" /> Add Student
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Filter className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
          <select
            value={gradeFilter}
            onChange={(e) => { setGradeFilter(e.target.value); setSectionFilter(''); }}
            className="input px-3 py-1.5 text-sm"
          >
            <option value="">All Grades</option>
            {grades.map((g) => (
              <option key={g.id || g._id || g.name} value={g.id || g._id}>{g.name_en || g.name}</option>
            ))}
          </select>
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            disabled={!gradeFilter}
            title={!gradeFilter ? 'Select a Grade first' : ''}
            className="input px-3 py-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">{gradeFilter ? 'All Sections' : 'Select a Grade first'}</option>
            {visibleSections.map((s) => (
              <option key={s.id || s._id || s.name} value={s.id || s._id}>{s.name_en || s.name}</option>
            ))}
          </select>
          {!showAlumni && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input px-3 py-1.5 text-sm"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
              <option value="withdrawn">Withdrawn</option>
              <option value="graduated">Graduated</option>
            </select>
          )}
        </div>
      </div>

      <div className="card p-4">
        {loading ? (
          <LoadingSpinner />
        ) : (
          <DataTable
            columns={columns}
            data={students}
            onRowClick={(row) => navigate(`/students/${row._id || row.id}`)}
            emptyMessage={
              <div className="flex flex-col items-center justify-center py-6 gap-2" style={{ color: 'var(--text-tertiary)' }}>
                <Inbox className="w-10 h-10" strokeWidth={1.25} />
                <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No records found</p>
              </div>
            }
          />
        )}
      </div>
    </div>
  );
}
