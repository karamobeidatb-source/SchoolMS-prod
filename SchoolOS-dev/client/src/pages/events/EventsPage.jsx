import { useState, useEffect } from 'react';
import api from '../../utils/api';
import Modal from '../../components/Modal';
import Badge from '../../components/Badge';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Plus, Calendar, MapPin, Users, List, LayoutGrid, Clock, Check, Image, FileCheck, Bell, Trash2 } from 'lucide-react';

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('grid');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', event_type: 'general', start_date: '', end_date: '', location: '', max_participants: '' });
  const [saving, setSaving] = useState(false);
  const [detailTab, setDetailTab] = useState('info'); // info | gallery | permissions
  const [gallery, setGallery] = useState([]);
  const [permissionSlips, setPermissionSlips] = useState([]);
  const [loadingGallery, setLoadingGallery] = useState(false);
  const [loadingSlips, setLoadingSlips] = useState(false);
  const [reminders, setReminders] = useState([]);
  const [loadingReminders, setLoadingReminders] = useState(false);
  const [savingReminder, setSavingReminder] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = () => {
    api.get('/events')
      .then((res) => setEvents(res.data.events || res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      await api.post('/events', form);
      fetchEvents();
      setShowCreate(false);
      setForm({ title: '', description: '', event_type: 'general', start_date: '', end_date: '', location: '', max_participants: '' });
    } catch {}
    setSaving(false);
  };

  const handleRSVP = async (eventId) => {
    try {
      await api.post(`/events/${eventId}/rsvp`, { status: 'accepted' });
      fetchEvents();
      if (selectedEvent && (selectedEvent._id || selectedEvent.id) === eventId) {
        const res = await api.get(`/events/${eventId}`);
        setSelectedEvent(res.data.event || res.data);
      }
    } catch {}
  };

  // Fetch gallery, permission slips, and reminders when opening detail modal
  useEffect(() => {
    if (!selectedEvent) { setDetailTab('info'); setGallery([]); setPermissionSlips([]); setReminders([]); return; }
    const eventId = selectedEvent._id || selectedEvent.id;

    if (detailTab === 'gallery') {
      setLoadingGallery(true);
      api.get(`/events/${eventId}/media`)
        .then((res) => setGallery(res.data.media || res.data || []))
        .catch(() => setGallery([]))
        .finally(() => setLoadingGallery(false));
    }

    if (detailTab === 'permissions') {
      setLoadingSlips(true);
      api.get(`/events/${eventId}/permission-slips`)
        .then((res) => setPermissionSlips(res.data.slips || res.data || []))
        .catch(() => setPermissionSlips([]))
        .finally(() => setLoadingSlips(false));
    }

    if (detailTab === 'reminders') {
      fetchReminders(eventId);
    }
  }, [selectedEvent, detailTab]);

  const fetchReminders = (eventId) => {
    setLoadingReminders(true);
    api.get(`/events/${eventId}/reminders`)
      .then((res) => setReminders(res.data.reminders || res.data || []))
      .catch(() => setReminders([]))
      .finally(() => setLoadingReminders(false));
  };

  const handleCreateReminder = async (type, hoursBeforeEvent) => {
    if (!selectedEvent) return;
    const eventId = selectedEvent._id || selectedEvent.id;
    const eventStart = new Date(selectedEvent.start_date || selectedEvent.date);
    const remindAt = new Date(eventStart.getTime() - hoursBeforeEvent * 60 * 60 * 1000).toISOString();
    setSavingReminder(true);
    try {
      await api.post(`/events/${eventId}/reminders`, { remind_at: remindAt, type });
      fetchReminders(eventId);
    } catch {}
    setSavingReminder(false);
  };

  const handleDeleteReminder = async (reminderId) => {
    if (!selectedEvent) return;
    try {
      await api.delete(`/event-reminders/${reminderId}`);
      fetchReminders(selectedEvent._id || selectedEvent.id);
    } catch {}
  };

  const handleSignSlip = async (slipId) => {
    if (!selectedEvent) return;
    try {
      await api.post(`/events/${selectedEvent._id || selectedEvent.id}/permission-slips/${slipId}/sign`);
      const res = await api.get(`/events/${selectedEvent._id || selectedEvent.id}/permission-slips`);
      setPermissionSlips(res.data.slips || res.data || []);
    } catch {}
  };

  const typeColors = {
    general: 'info', academic: 'purple', sports: 'success', cultural: 'warning', meeting: 'gray', trip: 'info',
  };

  const getEventType = (event) => event.event_type || event.type || 'general';
  const getEventDate = (event) => (event.start_date || event.date || '')?.substring(0, 10);
  const isTrip = (event) => getEventType(event) === 'trip';

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold font-heading" style={{ color: 'var(--text-primary)' }}>Events</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{events.length} events</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg p-1" style={{ backgroundColor: 'var(--surface-secondary)' }}>
            <button onClick={() => setView('grid')} className={`p-1.5 rounded`} style={view === 'grid' ? { backgroundColor: 'var(--surface-primary)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' } : {}}><LayoutGrid className="w-4 h-4" /></button>
            <button onClick={() => setView('list')} className={`p-1.5 rounded`} style={view === 'list' ? { backgroundColor: 'var(--surface-primary)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' } : {}}><List className="w-4 h-4" /></button>
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" /> Create Event
          </button>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="card p-12 text-center" style={{ color: 'var(--text-tertiary)' }}>
          <Calendar className="w-12 h-12 mx-auto mb-3" />
          <p>No events scheduled</p>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((event) => (
            <div key={event._id || event.id} className="card p-5 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedEvent(event)}>
              <div className="flex items-start justify-between mb-3">
                <Badge variant={typeColors[getEventType(event)] || 'gray'}>{getEventType(event)}</Badge>
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{getEventDate(event)}</span>
              </div>
              <h3 className="font-semibold font-heading mb-2" style={{ color: 'var(--text-primary)' }}>{event.title}</h3>
              <p className="text-sm line-clamp-2 mb-3" style={{ color: 'var(--text-secondary)' }}>{event.description || 'No description'}</p>
              <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {event.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{event.location}</span>}
                <span className="flex items-center gap-1"><Users className="w-3 h-3" />{event.rsvps?.length || event.participants?.length || 0}</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleRSVP(event._id || event.id); }}
                className="mt-4 w-full py-2 rounded-lg text-sm font-medium transition-colors"
                style={event.isAttending
                  ? { backgroundColor: 'var(--success-subtle)', color: 'var(--success-text)', border: '1px solid var(--success-border)' }
                  : { backgroundColor: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid var(--accent)' }
                }
              >
                {event.isAttending ? <span className="flex items-center justify-center gap-1"><Check className="w-4 h-4" /> Attending</span> : 'RSVP'}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="card divide-y" style={{ '--tw-divide-opacity': 1 }}>
          {events.map((event) => (
            <div key={event._id || event.id} className="flex items-center gap-4 px-4 py-4 cursor-pointer" style={{ borderBottom: '1px solid var(--border-subtle)' }} onClick={() => setSelectedEvent(event)}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-secondary)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
            >
              <div className="w-12 h-12 rounded-lg flex flex-col items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--accent-subtle)' }}>
                <span className="text-xs" style={{ color: 'var(--accent)' }}>{new Date(event.start_date || event.date).toLocaleString('en', { month: 'short' })}</span>
                <span className="text-lg font-bold" style={{ color: 'var(--accent)' }}>{new Date(event.start_date || event.date).getDate()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{event.title}</p>
                <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <Badge variant={typeColors[getEventType(event)] || 'gray'}>{getEventType(event)}</Badge>
                  {event.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{event.location}</span>}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleRSVP(event._id || event.id); }}
                className="px-4 py-1.5 rounded-lg text-xs font-medium"
                style={event.isAttending
                  ? { backgroundColor: 'var(--success-subtle)', color: 'var(--success-text)' }
                  : { backgroundColor: 'var(--accent-subtle)', color: 'var(--accent)' }
                }
              >
                {event.isAttending ? 'Attending' : 'RSVP'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Event Detail Modal */}
      <Modal open={!!selectedEvent} onClose={() => setSelectedEvent(null)} title={selectedEvent?.title || 'Event'} size="lg">
        {selectedEvent && (
          <div>
            {/* Tabs */}
            <div className="flex gap-4 mb-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
              <button
                onClick={() => setDetailTab('info')}
                className="pb-2 text-sm font-medium border-b-2"
                style={detailTab === 'info' ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : { borderColor: 'transparent', color: 'var(--text-secondary)' }}
              >
                Details
              </button>
              <button
                onClick={() => setDetailTab('gallery')}
                className="pb-2 text-sm font-medium border-b-2 flex items-center gap-1"
                style={detailTab === 'gallery' ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : { borderColor: 'transparent', color: 'var(--text-secondary)' }}
              >
                <Image className="w-3.5 h-3.5" /> Gallery
              </button>
              <button
                onClick={() => setDetailTab('reminders')}
                className="pb-2 text-sm font-medium border-b-2 flex items-center gap-1"
                style={detailTab === 'reminders' ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : { borderColor: 'transparent', color: 'var(--text-secondary)' }}
              >
                <Bell className="w-3.5 h-3.5" /> Reminders
              </button>
              {isTrip(selectedEvent) && (
                <button
                  onClick={() => setDetailTab('permissions')}
                  className="pb-2 text-sm font-medium border-b-2 flex items-center gap-1"
                  style={detailTab === 'permissions' ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : { borderColor: 'transparent', color: 'var(--text-secondary)' }}
                >
                  <FileCheck className="w-3.5 h-3.5" /> Permission Slips
                </button>
              )}
            </div>

            {/* Info Tab */}
            {detailTab === 'info' && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <Badge variant={typeColors[getEventType(selectedEvent)] || 'gray'}>{getEventType(selectedEvent)}</Badge>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{(selectedEvent.start_date || selectedEvent.date)?.substring(0, 10)}</span>
                  {selectedEvent.end_date && <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>to {selectedEvent.end_date?.substring(0, 10)}</span>}
                </div>
                <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>{selectedEvent.description || 'No description'}</p>
                {selectedEvent.location && (
                  <div className="flex items-center gap-2 text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                    <MapPin className="w-4 h-4" /> {selectedEvent.location}
                  </div>
                )}

                {/* Reminder notice */}
                <button
                  onClick={() => setDetailTab('reminders')}
                  className="flex items-center gap-2 p-3 rounded-lg text-sm mb-4 w-full text-left transition-colors"
                  style={{ backgroundColor: 'var(--accent-subtle)', border: '1px solid var(--accent)', color: 'var(--accent)' }}
                >
                  <Bell className="w-4 h-4 flex-shrink-0" />
                  <span>Manage reminders for this event</span>
                </button>

                <div>
                  <h4 className="text-sm font-semibold font-heading mb-2" style={{ color: 'var(--text-primary)' }}>RSVPs ({selectedEvent.rsvps?.length || selectedEvent.participants?.length || 0})</h4>
                  {(selectedEvent.rsvps || selectedEvent.participants || []).length === 0 ? (
                    <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No RSVPs yet</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {(selectedEvent.rsvps || selectedEvent.participants || []).map((p, i) => (
                        <span key={i} className="px-2 py-1 rounded text-xs" style={{ backgroundColor: 'var(--surface-secondary)', color: 'var(--text-secondary)' }}>{p.user_name || p.name || p.status || p}</span>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Gallery Tab */}
            {detailTab === 'gallery' && (
              <div>
                {loadingGallery ? (
                  <LoadingSpinner />
                ) : gallery.length === 0 ? (
                  <div className="text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
                    <Image className="w-10 h-10 mx-auto mb-2" />
                    <p className="text-sm">No photos uploaded yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {gallery.map((media, i) => (
                      <div key={i} className="aspect-square rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--surface-secondary)' }}>
                        {media.url || media.file_url ? (
                          <img src={media.url || media.file_url} alt={media.name || `Photo ${i + 1}`} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--text-tertiary)' }}>
                            <Image className="w-8 h-8" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Reminders Tab */}
            {detailTab === 'reminders' && (
              <div>
                {/* Quick preset buttons */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <button
                    onClick={() => handleCreateReminder('24h_before', 24)}
                    disabled={savingReminder}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-60 transition-colors"
                    style={{ backgroundColor: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid var(--accent)' }}
                  >
                    <Plus className="w-3.5 h-3.5" /> 24 hours before
                  </button>
                  <button
                    onClick={() => handleCreateReminder('1h_before', 1)}
                    disabled={savingReminder}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-60 transition-colors"
                    style={{ backgroundColor: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid var(--accent)' }}
                  >
                    <Plus className="w-3.5 h-3.5" /> 1 hour before
                  </button>
                </div>

                {loadingReminders ? (
                  <LoadingSpinner />
                ) : reminders.length === 0 ? (
                  <div className="text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
                    <Bell className="w-10 h-10 mx-auto mb-2" />
                    <p className="text-sm">No reminders set for this event</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {reminders.map((reminder) => (
                      <div key={reminder.id || reminder._id} className="flex items-center justify-between p-3 rounded-lg" style={{ border: '1px solid var(--border-default)' }}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--accent-subtle)' }}>
                            <Bell className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                          </div>
                          <div>
                            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{reminder.type || 'Reminder'}</p>
                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                              <Clock className="w-3 h-3 inline mr-1" />
                              {new Date(reminder.remind_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteReminder(reminder.id || reminder._id)}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: 'var(--text-tertiary)' }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--error-text)'; e.currentTarget.style.backgroundColor = 'var(--error-subtle)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.backgroundColor = ''; }}
                          title="Delete reminder"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Permission Slips Tab */}
            {detailTab === 'permissions' && (
              <div>
                {loadingSlips ? (
                  <LoadingSpinner />
                ) : permissionSlips.length === 0 ? (
                  <div className="text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
                    <FileCheck className="w-10 h-10 mx-auto mb-2" />
                    <p className="text-sm">No permission slips for this event</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {permissionSlips.map((slip, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg" style={{ border: '1px solid var(--border-default)' }}>
                        <div>
                          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{slip.student_name || slip.studentName || 'Student'}</p>
                          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            Status: <Badge variant={slip.signed || slip.approved ? 'success' : 'warning'}>{slip.signed || slip.approved ? 'Signed' : 'Pending'}</Badge>
                          </p>
                        </div>
                        {!slip.signed && !slip.approved && (
                          <button
                            onClick={() => handleSignSlip(slip.id || slip._id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                            style={{ backgroundColor: 'var(--success-text)' }}
                          >
                            Sign / Approve
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Create Event Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Event">
        <div className="space-y-4">
          <div>
            <label className="label">Title *</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input w-full px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="input w-full px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Type</label>
              <select value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })} className="input w-full px-3 py-2 text-sm">
                <option value="general">General</option>
                <option value="academic">Academic</option>
                <option value="sports">Sports</option>
                <option value="cultural">Cultural</option>
                <option value="meeting">Meeting</option>
                <option value="trip">Trip</option>
              </select>
            </div>
            <div>
              <label className="label">Location</label>
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="input w-full px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Start Date/Time</label>
              <input type="datetime-local" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="input w-full px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="label">End Date/Time</label>
              <input type="datetime-local" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="input w-full px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowCreate(false)} className="btn-secondary px-4 py-2 rounded-lg text-sm font-medium">Cancel</button>
            <button onClick={handleCreate} disabled={saving} className="btn-primary px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60">{saving ? 'Creating...' : 'Create'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
