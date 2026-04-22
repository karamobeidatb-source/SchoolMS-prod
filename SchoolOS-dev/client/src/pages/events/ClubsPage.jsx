import { useState, useEffect } from 'react';
import api from '../../utils/api';
import Modal from '../../components/Modal';
import Badge from '../../components/Badge';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Plus, Trophy, Users, Calendar, UserPlus, UserMinus, Shield } from 'lucide-react';

export default function ClubsPage() {
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClub, setSelectedClub] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', name_ar: '', description: '', supervisor_id: '', meeting_schedule: '', max_members: '' });
  const [saving, setSaving] = useState(false);

  // Sports teams
  const [sportsTeams, setSportsTeams] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [fixtures, setFixtures] = useState([]);
  const [loadingFixtures, setLoadingFixtures] = useState(false);
  const [showFixtureForm, setShowFixtureForm] = useState(false);
  const [fixtureForm, setFixtureForm] = useState({ date: '', opponent: '', score: '', result: '' });
  const [savingFixture, setSavingFixture] = useState(false);

  useEffect(() => {
    fetchClubs();
    fetchSportsTeams();
  }, []);

  const fetchClubs = () => {
    api.get('/clubs')
      .then((res) => setClubs(res.data.clubs || res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const fetchSportsTeams = () => {
    setLoadingTeams(true);
    api.get('/sports-teams')
      .then((res) => setSportsTeams(res.data.teams || res.data || []))
      .catch(() => setSportsTeams([]))
      .finally(() => setLoadingTeams(false));
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      if (form._id) {
        await api.put(`/clubs/${form._id}`, form);
      } else {
        await api.post('/clubs', form);
      }
      fetchClubs();
      setShowCreate(false);
      setForm({ name: '', name_ar: '', description: '', supervisor_id: '', meeting_schedule: '', max_members: '' });
    } catch {}
    setSaving(false);
  };

  const handleJoinLeave = async (clubId, isMember) => {
    try {
      if (isMember) {
        await api.delete(`/clubs/${clubId}/leave/me`);
      } else {
        await api.post(`/clubs/${clubId}/join`, {});
      }
      fetchClubs();
      if (selectedClub && (selectedClub._id || selectedClub.id) === clubId) {
        const res = await api.get(`/clubs/${clubId}`);
        setSelectedClub(res.data.club || res.data);
      }
    } catch {}
  };

  const openEdit = (club) => {
    setForm({
      _id: club.id || club._id,
      name: club.name || '',
      name_ar: club.name_ar || '',
      description: club.description || '',
      supervisor_id: club.supervisor_id || club.supervisor || '',
      meeting_schedule: club.meeting_schedule || club.schedule || '',
      max_members: club.max_members || club.maxMembers || '',
    });
    setShowCreate(true);
  };

  const handleViewFixtures = async (team) => {
    setSelectedTeam(team);
    setLoadingFixtures(true);
    const teamId = team._id || team.id;
    api.get(`/sports-teams/${teamId}/fixtures`)
      .then((res) => setFixtures(res.data.fixtures || res.data || []))
      .catch(() => setFixtures([]))
      .finally(() => setLoadingFixtures(false));
  };

  const handleAddFixture = async () => {
    if (!selectedTeam) return;
    setSavingFixture(true);
    try {
      const teamId = selectedTeam._id || selectedTeam.id;
      await api.post(`/sports-teams/${teamId}/fixtures`, fixtureForm);
      const res = await api.get(`/sports-teams/${teamId}/fixtures`);
      setFixtures(res.data.fixtures || res.data || []);
      setShowFixtureForm(false);
      setFixtureForm({ date: '', opponent: '', score: '', result: '' });
    } catch {}
    setSavingFixture(false);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold font-heading" style={{ color: 'var(--text-primary)' }}>Clubs</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{clubs.length} active clubs</p>
        </div>
        <button onClick={() => { setForm({ name: '', name_ar: '', description: '', supervisor_id: '', meeting_schedule: '', max_members: '' }); setShowCreate(true); }} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> Create Club
        </button>
      </div>

      {clubs.length === 0 ? (
        <div className="card p-12 text-center" style={{ color: 'var(--text-tertiary)' }}>
          <Trophy className="w-12 h-12 mx-auto mb-3" />
          <p>No clubs yet. Create the first one!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clubs.map((club) => (
            <div key={club._id || club.id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--accent-subtle)' }}>
                  <Trophy className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                </div>
                <Badge variant="purple">{club.members?.length || 0} members</Badge>
              </div>
              <h3 className="font-semibold font-heading mb-1" style={{ color: 'var(--text-primary)' }}>{club.name}</h3>
              <p className="text-sm line-clamp-2 mb-3" style={{ color: 'var(--text-secondary)' }}>{club.description || 'No description'}</p>
              <div className="flex items-center gap-3 text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>
                {(club.supervisor_name || club.supervisorName) && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{club.supervisor_name || club.supervisorName}</span>}
                {(club.meeting_schedule || club.schedule) && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{club.meeting_schedule || club.schedule}</span>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setSelectedClub(club)} className="btn-secondary flex-1 py-2 text-center rounded-lg text-sm font-medium">
                  Details
                </button>
                <button
                  onClick={() => handleJoinLeave(club._id || club.id, club.isMember)}
                  className="flex-1 py-2 text-center rounded-lg text-sm font-medium"
                  style={club.isMember
                    ? { backgroundColor: 'var(--error-subtle)', color: 'var(--error-text)', border: '1px solid var(--error-border)' }
                    : { backgroundColor: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid var(--accent)' }
                  }
                >
                  {club.isMember ? (
                    <span className="flex items-center justify-center gap-1"><UserMinus className="w-3.5 h-3.5" /> Leave</span>
                  ) : (
                    <span className="flex items-center justify-center gap-1"><UserPlus className="w-3.5 h-3.5" /> Join</span>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sports Teams Section */}
      <div className="mt-10">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5" style={{ color: 'var(--success-text)' }} />
          <h2 className="text-lg font-bold font-heading" style={{ color: 'var(--text-primary)' }}>Sports Teams</h2>
        </div>
        {loadingTeams ? (
          <LoadingSpinner />
        ) : sportsTeams.length === 0 ? (
          <div className="card p-8 text-center" style={{ color: 'var(--text-tertiary)' }}>
            <Shield className="w-10 h-10 mx-auto mb-2" />
            <p className="text-sm">No sports teams configured</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sportsTeams.map((team) => (
              <div key={team._id || team.id} className="card p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--success-subtle)' }}>
                    <Shield className="w-5 h-5" style={{ color: 'var(--success-text)' }} />
                  </div>
                  <Badge variant="success">{team.sport || 'Sport'}</Badge>
                </div>
                <h3 className="font-semibold font-heading mb-1" style={{ color: 'var(--text-primary)' }}>{team.name || team.team_name}</h3>
                <div className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
                  {(team.coach_name || team.coach) && <p>Coach: {team.coach_name || team.coach}</p>}
                  {team.members_count != null && <p>{team.members_count} players</p>}
                </div>
                <button
                  onClick={() => handleViewFixtures(team)}
                  className="w-full py-2 text-center rounded-lg text-sm font-medium"
                  style={{ border: '1px solid var(--success-border)', color: 'var(--success-text)' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--success-subtle)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
                >
                  View Fixtures
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Club Detail Modal */}
      <Modal open={!!selectedClub} onClose={() => setSelectedClub(null)} title={selectedClub?.name || 'Club'} size="lg">
        {selectedClub && (
          <div>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>{selectedClub.description || 'No description'}</p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--surface-secondary)' }}>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Supervisor</p>
                <p className="text-sm font-medium mt-1">{selectedClub.supervisor_name || selectedClub.supervisorName || selectedClub.supervisor || 'N/A'}</p>
              </div>
              <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--surface-secondary)' }}>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Schedule</p>
                <p className="text-sm font-medium mt-1">{selectedClub.meeting_schedule || selectedClub.schedule || 'N/A'}</p>
              </div>
            </div>
            <h4 className="text-sm font-semibold font-heading mb-2" style={{ color: 'var(--text-primary)' }}>Members ({selectedClub.members?.length || 0})</h4>
            {(selectedClub.members || []).length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No members yet</p>
            ) : (
              <div className="space-y-2">
                {selectedClub.members.map((m, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm p-2 rounded-lg" style={{ backgroundColor: 'var(--surface-secondary)' }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium" style={{ backgroundColor: 'var(--accent-subtle)', color: 'var(--accent)' }}>{(m.name || m)[0]}</div>
                    <span>{m.name || m}</span>
                    {m.role && <Badge variant="info">{m.role}</Badge>}
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => { openEdit(selectedClub); setSelectedClub(null); }} className="btn-secondary mt-4 w-full py-2 rounded-lg text-sm font-medium">Edit Club</button>
          </div>
        )}
      </Modal>

      {/* Fixtures Modal */}
      <Modal open={!!selectedTeam} onClose={() => { setSelectedTeam(null); setFixtures([]); }} title={`${selectedTeam?.name || 'Team'} - Fixtures`} size="lg">
        {selectedTeam && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Sport: {selectedTeam.sport || 'N/A'} | Coach: {selectedTeam.coach_name || selectedTeam.coach || 'N/A'}</p>
              <button
                onClick={() => setShowFixtureForm(!showFixtureForm)}
                className="btn-primary flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium"
              >
                <Plus className="w-3 h-3" /> Add Fixture
              </button>
            </div>

            {showFixtureForm && (
              <div className="rounded-lg p-4 mb-4 space-y-3" style={{ backgroundColor: 'var(--surface-secondary)' }}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label text-xs">Date</label>
                    <input type="date" value={fixtureForm.date} onChange={(e) => setFixtureForm({ ...fixtureForm, date: e.target.value })} className="input w-full px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="label text-xs">Opponent</label>
                    <input value={fixtureForm.opponent} onChange={(e) => setFixtureForm({ ...fixtureForm, opponent: e.target.value })} className="input w-full px-3 py-2 text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label text-xs">Score</label>
                    <input value={fixtureForm.score} onChange={(e) => setFixtureForm({ ...fixtureForm, score: e.target.value })} className="input w-full px-3 py-2 text-sm" placeholder="e.g., 3-1" />
                  </div>
                  <div>
                    <label className="label text-xs">Result</label>
                    <select value={fixtureForm.result} onChange={(e) => setFixtureForm({ ...fixtureForm, result: e.target.value })} className="input w-full px-3 py-2 text-sm">
                      <option value="">Select</option>
                      <option value="win">Win</option>
                      <option value="loss">Loss</option>
                      <option value="draw">Draw</option>
                      <option value="upcoming">Upcoming</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowFixtureForm(false)} className="btn-secondary px-3 py-1.5 rounded-lg text-xs">Cancel</button>
                  <button onClick={handleAddFixture} disabled={savingFixture} className="btn-primary px-3 py-1.5 rounded-lg text-xs disabled:opacity-60">{savingFixture ? 'Saving...' : 'Add'}</button>
                </div>
              </div>
            )}

            {loadingFixtures ? (
              <LoadingSpinner />
            ) : fixtures.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: 'var(--text-tertiary)' }}>No fixtures recorded</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ backgroundColor: 'var(--surface-secondary)', borderBottom: '1px solid var(--border-default)' }}>
                      <th className="px-4 py-2 text-left font-medium" style={{ color: 'var(--text-secondary)' }}>Date</th>
                      <th className="px-4 py-2 text-left font-medium" style={{ color: 'var(--text-secondary)' }}>Opponent</th>
                      <th className="px-4 py-2 text-center font-medium" style={{ color: 'var(--text-secondary)' }}>Score</th>
                      <th className="px-4 py-2 text-center font-medium" style={{ color: 'var(--text-secondary)' }}>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fixtures.map((f, i) => {
                      const resultColors = { win: 'success', loss: 'danger', draw: 'warning', upcoming: 'info' };
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td className="px-4 py-2">{(f.date || '')?.substring(0, 10)}</td>
                          <td className="px-4 py-2 font-medium">{f.opponent || 'TBD'}</td>
                          <td className="px-4 py-2 text-center">{f.score || '-'}</td>
                          <td className="px-4 py-2 text-center">
                            <Badge variant={resultColors[f.result] || 'gray'}>{f.result || 'N/A'}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Create/Edit Club Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={form._id ? 'Edit Club' : 'Create Club'}>
        <div className="space-y-4">
          <div>
            <label className="label">Club Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input w-full px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="input w-full px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Meeting Schedule</label>
              <input value={form.meeting_schedule} onChange={(e) => setForm({ ...form, meeting_schedule: e.target.value })} className="input w-full px-3 py-2 text-sm" placeholder="e.g., Tuesdays 3-4 PM" />
            </div>
            <div>
              <label className="label">Max Members</label>
              <input type="number" value={form.max_members} onChange={(e) => setForm({ ...form, max_members: e.target.value })} className="input w-full px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowCreate(false)} className="btn-secondary px-4 py-2 rounded-lg text-sm font-medium">Cancel</button>
            <button onClick={handleCreate} disabled={saving} className="btn-primary px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
