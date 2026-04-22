import { useState, useEffect } from 'react';
import api from '../../utils/api';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Save, Plus, Edit, Trash2, Shield } from 'lucide-react';

const settingsTabs = ['General', 'Grade Levels', 'Sections', 'Subjects', 'Users', 'Roles & Permissions'];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // General settings
  const [general, setGeneral] = useState({});

  // CRUD lists
  const [grades, setGrades] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [editForm, setEditForm] = useState({});
  const [editType, setEditType] = useState('');

  // Permissions view
  const [selectedRole, setSelectedRole] = useState(null);
  const [rolePermissions, setRolePermissions] = useState([]);
  const [allPermissions, setAllPermissions] = useState([]);

  // Hover states for action buttons
  const [hoveredEdit, setHoveredEdit] = useState(null);
  const [hoveredDelete, setHoveredDelete] = useState(null);
  const [hoveredRoleItem, setHoveredRoleItem] = useState(null);
  const [hoveredPermLabel, setHoveredPermLabel] = useState(null);

  useEffect(() => {
    loadTabData();
  }, [activeTab]);

  const loadTabData = () => {
    setLoading(true);
    const endpoints = [
      () => api.get('/settings').then((r) => {
        // Convert array of { key, value } to object
        const settings = {};
        (Array.isArray(r.data) ? r.data : []).forEach((s) => { settings[s.key] = s.value; });
        setGeneral(settings);
      }).catch(() => {}),
      () => api.get('/grade-levels').then((r) => setGrades(r.data || [])).catch(() => {}),
      () => api.get('/sections').then((r) => setSections(r.data || [])).catch(() => {}),
      () => api.get('/subjects').then((r) => setSubjects(r.data || [])).catch(() => {}),
      () => api.get('/users').then((r) => setUsers(r.data.users || r.data || [])).catch(() => {}),
      () => Promise.all([
        api.get('/roles').then((r) => setRoles(Array.isArray(r.data) ? r.data : (r.data.roles || []))).catch(() => {}),
        api.get('/permissions').then((r) => setAllPermissions(Array.isArray(r.data) ? r.data : (r.data.permissions || []))).catch(() => {}),
      ]),
    ];
    endpoints[activeTab]().finally(() => setLoading(false));
  };

  const saveGeneral = async () => {
    setSaving(true);
    try { await api.put('/settings', { settings: general }); } catch {}
    setSaving(false);
  };

  const openCreateModal = (type, title, defaults = {}) => {
    setEditType(type);
    setModalTitle(title);
    setEditForm({ ...defaults, _editId: defaults.id || defaults._id || null });
    setShowModal(true);
  };

  const handleModalSave = async () => {
    setSaving(true);
    const endpoints = {
      grade: { create: '/grade-levels', update: (id) => `/grade-levels/${id}` },
      section: { create: '/sections', update: (id) => `/sections/${id}` },
      subject: { create: '/subjects', update: (id) => `/subjects/${id}` },
      user: { create: '/users', update: (id) => `/users/${id}` },
    };
    try {
      const ep = endpoints[editType];
      if (editForm._editId) {
        await api.put(ep.update(editForm._editId), editForm);
      } else {
        await api.post(ep.create, editForm);
      }
      setShowModal(false);
      loadTabData();
    } catch {}
    setSaving(false);
  };

  const handleDelete = async (type, id) => {
    if (!confirm('Are you sure you want to delete this?')) return;
    const endpoints = { grade: '/grade-levels', section: '/sections', subject: '/subjects', user: '/users' };
    try {
      await api.delete(`${endpoints[type]}/${id}`);
      loadTabData();
    } catch {}
  };

  const handleRolePermissionToggle = async (perm) => {
    if (!selectedRole) return;
    const current = [...rolePermissions];
    const permId = typeof perm === 'object' ? perm.id : perm;
    const idx = current.indexOf(permId);
    if (idx >= 0) current.splice(idx, 1);
    else current.push(permId);
    setRolePermissions(current);
    try {
      await api.put(`/roles/${selectedRole.id || selectedRole._id}/permissions`, { permission_ids: current });
    } catch {}
  };

  const inputClass = 'input';

  const crudActions = (type, item) => {
    const itemKey = item.id || item._id;
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); openCreateModal(type, `Edit ${type}`, item); }}
          className="p-1.5"
          style={{ color: hoveredEdit === `${type}-${itemKey}` ? 'var(--accent)' : 'var(--text-tertiary)' }}
          onMouseEnter={() => setHoveredEdit(`${type}-${itemKey}`)}
          onMouseLeave={() => setHoveredEdit(null)}
        >
          <Edit className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleDelete(type, itemKey); }}
          className="p-1.5"
          style={{ color: hoveredDelete === `${type}-${itemKey}` ? 'var(--error)' : 'var(--text-tertiary)' }}
          onMouseEnter={() => setHoveredDelete(`${type}-${itemKey}`)}
          onMouseLeave={() => setHoveredDelete(null)}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    );
  };

  return (
    <div>
      <h1 className="text-2xl font-bold font-heading mb-6" style={{ color: 'var(--text-primary)' }}>Settings</h1>

      <div className="card">
        <div className="px-6" style={{ borderBottom: '1px solid var(--border-default)' }}>
          <div className="flex gap-6 overflow-x-auto">
            {settingsTabs.map((tab, i) => (
              <button
                key={tab}
                onClick={() => setActiveTab(i)}
                className="py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors"
                style={
                  activeTab === i
                    ? { color: 'var(--accent)', borderColor: 'var(--accent)' }
                    : { color: 'var(--text-secondary)', borderColor: 'transparent' }
                }
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {loading ? <LoadingSpinner /> : (
            <>
              {/* General */}
              {activeTab === 0 && (
                <div className="max-w-2xl space-y-4">
                  <div>
                    <label className="label">School Name</label>
                    <input className={inputClass} value={general.schoolName || ''} onChange={(e) => setGeneral({ ...general, schoolName: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Academic Year</label>
                      <input className={inputClass} value={general.academicYear || ''} onChange={(e) => setGeneral({ ...general, academicYear: e.target.value })} placeholder="e.g., 2025-2026" />
                    </div>
                    <div>
                      <label className="label">Current Semester</label>
                      <select className={inputClass} value={general.semester || ''} onChange={(e) => setGeneral({ ...general, semester: e.target.value })}>
                        <option value="">Select</option>
                        <option value="1">First Semester</option>
                        <option value="2">Second Semester</option>
                      </select>
                    </div>
                  </div>
                  <button onClick={saveGeneral} disabled={saving} className="btn-primary flex items-center gap-2">
                    <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              )}

              {/* Grade Levels */}
              {activeTab === 1 && (
                <div>
                  <div className="flex justify-end mb-4">
                    <button onClick={() => openCreateModal('grade', 'Add Grade Level', { name_en: '', name_ar: '', order_index: grades.length + 1 })} className="btn-primary flex items-center gap-2">
                      <Plus className="w-4 h-4" /> Add Grade
                    </button>
                  </div>
                  <DataTable
                    columns={[
                      { key: 'order', header: '#', accessor: (r) => r.order_index || r.order || '', className: 'w-16' },
                      { key: 'name', header: 'Name', accessor: (r) => r.name_en || r.name || '' },
                      { key: 'nameAr', header: 'Arabic Name', accessor: (r) => r.name_ar || r.nameAr || '' },
                      { key: 'actions', header: '', sortable: false, className: 'w-24', render: (r) => crudActions('grade', r) },
                    ]}
                    data={grades}
                    searchable={false}
                  />
                </div>
              )}

              {/* Sections */}
              {activeTab === 2 && (
                <div>
                  <div className="flex justify-end mb-4">
                    <button onClick={() => openCreateModal('section', 'Add Section', { name_en: '', name_ar: '', grade_level_id: '', capacity: 30 })} className="btn-primary flex items-center gap-2">
                      <Plus className="w-4 h-4" /> Add Section
                    </button>
                  </div>
                  <DataTable
                    columns={[
                      { key: 'name', header: 'Name', accessor: (r) => r.name_en || r.name || '' },
                      { key: 'grade', header: 'Grade', accessor: (r) => r.grade_level_name || r.gradeName || r.grade || '' },
                      { key: 'capacity', header: 'Capacity', accessor: 'capacity' },
                      { key: 'actions', header: '', sortable: false, className: 'w-24', render: (r) => crudActions('section', r) },
                    ]}
                    data={sections}
                    searchable={false}
                  />
                </div>
              )}

              {/* Subjects */}
              {activeTab === 3 && (
                <div>
                  <div className="flex justify-end mb-4">
                    <button onClick={() => openCreateModal('subject', 'Add Subject', { name_en: '', name_ar: '', code: '' })} className="btn-primary flex items-center gap-2">
                      <Plus className="w-4 h-4" /> Add Subject
                    </button>
                  </div>
                  <DataTable
                    columns={[
                      { key: 'code', header: 'Code', accessor: 'code', className: 'w-24' },
                      { key: 'name', header: 'Name', accessor: (r) => r.name_en || r.name || '' },
                      { key: 'nameAr', header: 'Arabic Name', accessor: (r) => r.name_ar || r.nameAr || '' },
                      { key: 'actions', header: '', sortable: false, className: 'w-24', render: (r) => crudActions('subject', r) },
                    ]}
                    data={subjects}
                    searchable={false}
                  />
                </div>
              )}

              {/* Users */}
              {activeTab === 4 && (
                <div>
                  <div className="flex justify-end mb-4">
                    <button onClick={() => openCreateModal('user', 'Add User', { first_name: '', last_name: '', first_name_ar: '', last_name_ar: '', email: '', password: '', phone: '', role_id: '' })} className="btn-primary flex items-center gap-2">
                      <Plus className="w-4 h-4" /> Add User
                    </button>
                  </div>
                  <DataTable
                    columns={[
                      {
                        key: 'name',
                        header: 'Name',
                        accessor: (r) => r.first_name ? `${r.first_name} ${r.last_name || ''}` : (r.name || ''),
                        render: (r) => <span className="font-medium">{r.first_name ? `${r.first_name} ${r.last_name || ''}`.trim() : (r.name || '')}</span>,
                      },
                      { key: 'email', header: 'Email', accessor: 'email' },
                      { key: 'role', header: 'Role', render: (r) => <Badge variant="info">{r.role_name || r.role || 'N/A'}</Badge>, accessor: (r) => r.role_name || r.role || '' },
                      { key: 'status', header: 'Status', render: (r) => <Badge variant={r.active !== false ? 'success' : 'gray'}>{r.active !== false ? 'Active' : 'Inactive'}</Badge> },
                      { key: 'actions', header: '', sortable: false, className: 'w-24', render: (r) => crudActions('user', r) },
                    ]}
                    data={users}
                  />
                </div>
              )}

              {/* Roles & Permissions */}
              {activeTab === 5 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-1">
                    <h3 className="text-sm font-semibold font-heading mb-3" style={{ color: 'var(--text-primary)' }}>Roles</h3>
                    <div className="space-y-2">
                      {roles.map((role) => {
                        const roleId = role.id || role._id;
                        const isSelected = selectedRole && (selectedRole.id || selectedRole._id) === roleId;
                        const isHovered = hoveredRoleItem === roleId;
                        return (
                          <button
                            key={roleId}
                            onClick={() => {
                              setSelectedRole(role);
                              const permIds = (role.permissions || []).map((p) => typeof p === 'object' ? p.id : p);
                              setRolePermissions(permIds);
                            }}
                            className="w-full text-left p-3 rounded-lg transition-colors"
                            style={
                              isSelected
                                ? { border: '1px solid var(--accent)', backgroundColor: 'var(--accent-subtle)' }
                                : { border: '1px solid var(--border-default)', backgroundColor: isHovered ? 'var(--surface-hover)' : 'transparent' }
                            }
                            onMouseEnter={() => setHoveredRoleItem(roleId)}
                            onMouseLeave={() => setHoveredRoleItem(null)}
                          >
                            <div className="flex items-center gap-2">
                              <Shield className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                              <span className="font-medium text-sm">{role.label_en || role.name || role.key}</span>
                            </div>
                            {(role.label_ar || role.description) && <p className="text-xs mt-1 ml-6" style={{ color: 'var(--text-secondary)' }}>{role.label_ar || role.description}</p>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="lg:col-span-2">
                    {selectedRole ? (
                      <div>
                        <h3 className="text-sm font-semibold font-heading mb-4" style={{ color: 'var(--text-primary)' }}>Permissions for: {selectedRole.label_en || selectedRole.name || selectedRole.key}</h3>
                        <div className="space-y-2">
                          {(allPermissions.length > 0 ? allPermissions : [
                            'dashboard.principal', 'students.view', 'students.create', 'students.edit',
                            'attendance.view', 'attendance.mark', 'grades.view', 'grades.manage',
                            'timetable.view', 'timetable.manage', 'assignments.view', 'assignments.create',
                            'messages.send', 'transport.view', 'transport.manage', 'transport.driver',
                            'events.view', 'events.manage', 'clubs.view', 'clubs.manage',
                            'nurse.view', 'nurse.manage', 'staff.view', 'staff.manage',
                            'leave.request', 'leave.approve', 'reports.academic', 'reports.attendance',
                            'settings.manage', 'roles.manage', 'users.manage',
                          ]).map((perm) => {
                            const permId = typeof perm === 'object' ? perm.id : perm;
                            const permKey = typeof perm === 'object' ? (perm.key || perm.name) : perm;
                            return (
                              <label
                                key={permId}
                                className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer"
                                style={{ backgroundColor: hoveredPermLabel === permId ? 'var(--surface-hover)' : 'transparent' }}
                                onMouseEnter={() => setHoveredPermLabel(permId)}
                                onMouseLeave={() => setHoveredPermLabel(null)}
                              >
                                <input
                                  type="checkbox"
                                  checked={rolePermissions.includes(permId)}
                                  onChange={() => handleRolePermissionToggle(perm)}
                                  className="w-4 h-4 text-blue-600 rounded"
                                />
                                <span className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>{permKey}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12" style={{ color: 'var(--text-tertiary)' }}>
                        <Shield className="w-10 h-10 mx-auto mb-2" />
                        <p className="text-sm">Select a role to view and edit its permissions</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* CRUD Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={modalTitle}>
        <div className="space-y-4">
          {editType === 'grade' && (
            <>
              <div>
                <label className="label">Name (English) *</label>
                <input className={inputClass} value={editForm.name_en || ''} onChange={(e) => setEditForm({ ...editForm, name_en: e.target.value })} placeholder="e.g., Grade 1" />
              </div>
              <div>
                <label className="label">Name (Arabic)</label>
                <input className={inputClass} value={editForm.name_ar || ''} onChange={(e) => setEditForm({ ...editForm, name_ar: e.target.value })} dir="rtl" />
              </div>
              <div>
                <label className="label">Order</label>
                <input type="number" className={inputClass} value={editForm.order_index || ''} onChange={(e) => setEditForm({ ...editForm, order_index: parseInt(e.target.value) })} />
              </div>
            </>
          )}
          {editType === 'section' && (
            <>
              <div>
                <label className="label">Name (English) *</label>
                <input className={inputClass} value={editForm.name_en || ''} onChange={(e) => setEditForm({ ...editForm, name_en: e.target.value })} placeholder="e.g., Section A" />
              </div>
              <div>
                <label className="label">Name (Arabic)</label>
                <input className={inputClass} value={editForm.name_ar || ''} onChange={(e) => setEditForm({ ...editForm, name_ar: e.target.value })} dir="rtl" />
              </div>
              <div>
                <label className="label">Grade Level</label>
                <select className={inputClass} value={editForm.grade_level_id || ''} onChange={(e) => setEditForm({ ...editForm, grade_level_id: e.target.value })}>
                  <option value="">Select Grade</option>
                  {grades.map((g) => <option key={g.id || g._id} value={g.id || g._id}>{g.name_en || g.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Capacity</label>
                <input type="number" className={inputClass} value={editForm.capacity || ''} onChange={(e) => setEditForm({ ...editForm, capacity: parseInt(e.target.value) })} />
              </div>
            </>
          )}
          {editType === 'subject' && (
            <>
              <div>
                <label className="label">Code</label>
                <input className={inputClass} value={editForm.code || ''} onChange={(e) => setEditForm({ ...editForm, code: e.target.value })} placeholder="e.g., MATH" />
              </div>
              <div>
                <label className="label">Name (English) *</label>
                <input className={inputClass} value={editForm.name_en || ''} onChange={(e) => setEditForm({ ...editForm, name_en: e.target.value })} />
              </div>
              <div>
                <label className="label">Name (Arabic)</label>
                <input className={inputClass} value={editForm.name_ar || ''} onChange={(e) => setEditForm({ ...editForm, name_ar: e.target.value })} dir="rtl" />
              </div>
            </>
          )}
          {editType === 'user' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">First Name *</label>
                  <input className={inputClass} value={editForm.first_name || ''} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} />
                </div>
                <div>
                  <label className="label">Last Name *</label>
                  <input className={inputClass} value={editForm.last_name || ''} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">First Name (Arabic)</label>
                  <input className={inputClass} value={editForm.first_name_ar || ''} onChange={(e) => setEditForm({ ...editForm, first_name_ar: e.target.value })} dir="rtl" />
                </div>
                <div>
                  <label className="label">Last Name (Arabic)</label>
                  <input className={inputClass} value={editForm.last_name_ar || ''} onChange={(e) => setEditForm({ ...editForm, last_name_ar: e.target.value })} dir="rtl" />
                </div>
              </div>
              <div>
                <label className="label">Email *</label>
                <input type="email" className={inputClass} value={editForm.email || ''} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
              </div>
              {!editForm._editId && (
                <div>
                  <label className="label">Password *</label>
                  <input type="password" className={inputClass} value={editForm.password || ''} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} />
                </div>
              )}
              <div>
                <label className="label">Phone</label>
                <input className={inputClass} value={editForm.phone || ''} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
              </div>
              <div>
                <label className="label">Role</label>
                <select className={inputClass} value={editForm.role_id || ''} onChange={(e) => setEditForm({ ...editForm, role_id: e.target.value })}>
                  <option value="">Select Role</option>
                  {roles.length > 0 ? roles.map((r) => <option key={r.id || r._id} value={r.id || r._id}>{r.label_en || r.name || r.key}</option>) : (
                    <>
                      <option value="1">Principal</option>
                      <option value="2">Admin</option>
                      <option value="3">Teacher</option>
                      <option value="4">Nurse</option>
                      <option value="5">Driver</option>
                    </>
                  )}
                </select>
              </div>
            </>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleModalSave} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
