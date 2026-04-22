import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useAppSettings } from '../../contexts/AppSettingsContext';
import api from '../../utils/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import Modal from '../../components/Modal';
import {
  School, Plus, Users, GraduationCap, LogIn, Pencil, PowerOff, Power, Trash2,
  Sun, Moon,
} from 'lucide-react';

const EMPTY_FORM = {
  name_en: '', name_ar: '', code: '', phone: '', address: '',
};

export default function SchoolsList() {
  const navigate = useNavigate();
  const { selectSchool, logout } = useAuth();
  const { isDark, toggleTheme } = useAppSettings();
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [hoveredBtn, setHoveredBtn] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/schools');
      setSchools(res.data);
      setErr('');
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to load schools');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (school) => {
    setEditing(school);
    setForm({
      name_en: school.name_en || '',
      name_ar: school.name_ar || '',
      code: school.code || '',
      phone: school.phone || '',
      address: school.address || '',
    });
    setModalOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/schools/${editing.id}`, form);
      } else {
        await api.post('/schools', form);
      }
      setModalOpen(false);
      await load();
    } catch (e2) {
      setErr(e2.response?.data?.error || 'Failed to save school');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (school) => {
    try {
      await api.put(`/schools/${school.id}`, { is_active: school.is_active ? 0 : 1 });
      await load();
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to update status');
    }
  };

  const remove = async (school) => {
    if (!confirm(`Delete "${school.name_en}" permanently? This only works if the school has no users.`)) return;
    try {
      await api.delete(`/schools/${school.id}`);
      await load();
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to delete school');
    }
  };

  const enter = async (school) => {
    if (!school.is_active) return;
    try {
      await selectSchool(school.id);
      navigate('/dashboard');
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to enter school');
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner size="lg" /></div>;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)' }}>
      <header
        className="px-6 py-4 flex items-center justify-between"
        style={{ backgroundColor: 'var(--surface-primary)', borderBottom: '1px solid var(--border-default)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold font-heading" style={{ color: 'var(--text-primary)' }}>SchoolOS — System Admin</h1>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Manage the schools on this system</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="btn-ghost p-2 rounded-lg"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button
            onClick={logout}
            className="text-sm"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--error)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold font-heading" style={{ color: 'var(--text-primary)' }}>Schools</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{schools.length} school{schools.length === 1 ? '' : 's'} on this system</p>
          </div>
          <button
            onClick={openCreate}
            className="btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Add School
          </button>
        </div>

        {err && (
          <div
            className="mb-4 p-3 rounded-lg text-sm"
            style={{ backgroundColor: 'var(--error-subtle)', border: '1px solid var(--error-border)', color: 'var(--error-text)' }}
          >
            {err}
          </div>
        )}

        {schools.length === 0 ? (
          <div
            className="card rounded-xl p-12 text-center"
            style={{ borderStyle: 'dashed' }}
          >
            <School className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
            <h3 className="text-lg font-semibold font-heading mb-1" style={{ color: 'var(--text-primary)' }}>No schools yet</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>Create your first school to get started.</p>
            <button
              onClick={openCreate}
              className="btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Add School
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {schools.map((s) => (
              <div
                key={s.id}
                className={`card rounded-xl p-5 flex flex-col ${!s.is_active ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: 'var(--accent-subtle)' }}
                  >
                    <School className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                  </div>
                  {!s.is_active && (
                    <span
                      className="text-xs px-2 py-0.5 rounded"
                      style={{ backgroundColor: 'var(--surface-hover)', color: 'var(--text-secondary)' }}
                    >
                      Inactive
                    </span>
                  )}
                </div>
                <h3 className="font-semibold font-heading truncate" style={{ color: 'var(--text-primary)' }}>{s.name_en}</h3>
                <p className="text-sm truncate" dir="rtl" style={{ color: 'var(--text-secondary)' }}>{s.name_ar}</p>
                {s.code && <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Code: {s.code}</p>}

                <div className="flex items-center gap-4 mt-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <span className="inline-flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> {s.user_count || 0} users
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <GraduationCap className="w-3.5 h-3.5" /> {s.student_count || 0} students
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-5 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <button
                    onClick={() => enter(s)}
                    disabled={!s.is_active}
                    className="btn-primary flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-40"
                  >
                    <LogIn className="w-3.5 h-3.5" /> Enter
                  </button>
                  <button
                    onClick={() => openEdit(s)}
                    className="btn-ghost p-2 rounded-lg"
                    style={{ color: 'var(--text-secondary)' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => toggleActive(s)}
                    className="btn-ghost p-2 rounded-lg"
                    style={{ color: 'var(--text-secondary)' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    title={s.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {s.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => remove(s)}
                    className="btn-ghost p-2 rounded-lg"
                    style={{ color: 'var(--error)' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--error-subtle)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit School' : 'Create School'}>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label block text-sm font-medium mb-1">Name (English)</label>
            <input
              required
              value={form.name_en}
              onChange={(e) => setForm({ ...form, name_en: e.target.value })}
              className="input w-full px-3 py-2 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="label block text-sm font-medium mb-1">Name (Arabic)</label>
            <input
              required
              dir="rtl"
              value={form.name_ar}
              onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
              className="input w-full px-3 py-2 rounded-lg text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label block text-sm font-medium mb-1">Code</label>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="input w-full px-3 py-2 rounded-lg text-sm"
                placeholder="SCH-001"
              />
            </div>
            <div>
              <label className="label block text-sm font-medium mb-1">Phone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="input w-full px-3 py-2 rounded-lg text-sm"
                placeholder="962..."
              />
            </div>
          </div>
          <div>
            <label className="label block text-sm font-medium mb-1">Address</label>
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="input w-full px-3 py-2 rounded-lg text-sm"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary px-4 py-2 text-sm rounded-lg">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-60"
            >
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create School'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
