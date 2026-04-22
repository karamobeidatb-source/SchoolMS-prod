import { useState, useEffect } from 'react';
import api from '../../utils/api';
import Modal from '../../components/Modal';
import Badge from '../../components/Badge';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Bus, MapPin, Users, Clock, Edit, Trash2, AlertTriangle, Radio, Bell } from 'lucide-react';

export default function TransportPage() {
  const { hasPermission } = useAuth();
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState({ name: '', bus_number: '', capacity: '', driver_id: '' });
  const [assignStudentId, setAssignStudentId] = useState('');
  const [trackingEvents, setTrackingEvents] = useState([]);
  const [loadingTracking, setLoadingTracking] = useState(false);

  useEffect(() => {
    api.get('/transport/routes')
      .then((res) => setRoutes(res.data.routes || res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedRoute) return;
    const routeId = selectedRoute._id || selectedRoute.id;
    api.get(`/transport/routes/${routeId}`)
      .then((res) => setSelectedRoute(res.data.route || res.data))
      .catch(() => {});

    // Fetch tracking events
    setLoadingTracking(true);
    api.get(`/transport/tracking/${routeId}`)
      .then((res) => setTrackingEvents(res.data.events || res.data || []))
      .catch(() => setTrackingEvents([]))
      .finally(() => setLoadingTracking(false));
  }, [selectedRoute?._id || selectedRoute?.id]);

  const handleSaveRoute = async () => {
    try {
      const payload = { name: form.name, bus_number: form.bus_number, capacity: form.capacity ? parseInt(form.capacity) : undefined, driver_id: form.driver_id || undefined };
      if (form._id) {
        await api.put(`/transport/routes/${form._id}`, payload);
      } else {
        await api.post('/transport/routes', payload);
      }
      const res = await api.get('/transport/routes');
      setRoutes(res.data.routes || res.data || []);
      setShowForm(false);
      setForm({ name: '', bus_number: '', capacity: '', driver_id: '' });
    } catch {}
  };

  const handleDeleteRoute = async (id) => {
    if (!confirm('Delete this route?')) return;
    try {
      await api.delete(`/transport/routes/${id}`);
      setRoutes(routes.filter((r) => (r._id || r.id) !== id));
      if (selectedRoute && (selectedRoute._id || selectedRoute.id) === id) setSelectedRoute(null);
    } catch {}
  };

  const handleAssignStudent = async () => {
    if (!assignStudentId || !selectedRoute) return;
    try {
      await api.post('/transport/assign-student', { student_id: assignStudentId, route_id: selectedRoute.id || selectedRoute._id });
      const res = await api.get(`/transport/routes/${selectedRoute.id || selectedRoute._id}`);
      setSelectedRoute(res.data.route || res.data);
      setShowAssign(false);
      setAssignStudentId('');
    } catch {}
  };

  const openEdit = (route) => {
    setForm({
      _id: route.id || route._id,
      name: route.name || '',
      bus_number: route.bus_number || route.vehicle || '',
      capacity: route.capacity || '',
      driver_id: route.driver_id || route.driver || '',
    });
    setShowForm(true);
  };

  if (loading) return <LoadingSpinner />;

  const isDriver = hasPermission('transport.driver') && !hasPermission('transport.manage');

  const routeStudentCount = selectedRoute?.students?.length || 0;
  const routeCapacity = selectedRoute?.capacity || 0;
  const isRouteFull = routeCapacity > 0 && routeStudentCount >= routeCapacity;

  // Format tracking event message
  const formatEvent = (evt) => {
    const time = (evt.timestamp || evt.time || evt.created_at || '')?.substring(11, 16) || '';
    const type = evt.event_type || evt.type || '';
    const student = evt.student_name || evt.studentName || '';
    const location = evt.location || evt.stop || '';

    if (type === 'departed') return { text: `Bus departed${location ? ` from ${location}` : ''}`, time, icon: 'bus' };
    if (type === 'arriving') return { text: `Bus arriving at ${location || 'stop'}`, time, icon: 'pin' };
    if (type === 'boarded') return { text: `${student || 'Student'} boarded${location ? ` at ${location}` : ''}`, time, icon: 'user' };
    if (type === 'dropped_off') return { text: `${student || 'Student'} dropped off${location ? ` at ${location}` : ''}`, time, icon: 'user' };
    return { text: evt.message || `${type} event`, time, icon: 'bell' };
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold font-heading" style={{ color: 'var(--text-primary)' }}>Transportation</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{routes.length} routes configured</p>
        </div>
        {!isDriver && (
          <button onClick={() => { setForm({ name: '', bus_number: '', capacity: '', driver_id: '' }); setShowForm(true); }} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" /> Add Route
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Route List */}
        <div className="lg:col-span-1 space-y-3">
          {routes.length === 0 ? (
            <div className="card p-8 text-center" style={{ color: 'var(--text-tertiary)' }}>
              <Bus className="w-10 h-10 mx-auto mb-2" />
              <p className="text-sm">No routes configured</p>
            </div>
          ) : (
            routes.map((route) => (
              <button
                key={route._id || route.id}
                onClick={() => setSelectedRoute(route)}
                className={`w-full text-left card p-4 transition-colors ${
                  selectedRoute && (selectedRoute._id || selectedRoute.id) === (route._id || route.id) ? 'ring-2 ring-blue-500' : 'hover:shadow-md'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--accent-subtle)' }}>
                      <Bus className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                    </div>
                    <div>
                      <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{route.name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{route.bus_number || route.vehicle || 'No vehicle'}</p>
                    </div>
                  </div>
                  <div className="text-right text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <p>{route.stops?.length || 0} stops</p>
                    <p>{route.students?.length || 0} students</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Route Detail */}
        <div className="lg:col-span-2">
          {selectedRoute ? (
            <div className="space-y-4">
              <div className="card p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold font-heading" style={{ color: 'var(--text-primary)' }}>{selectedRoute.name}</h2>
                    {isRouteFull && (
                      <Badge variant="danger">Route Full</Badge>
                    )}
                  </div>
                  {!isDriver && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(selectedRoute)} className="p-2" style={{ color: 'var(--text-tertiary)' }}><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteRoute(selectedRoute._id || selectedRoute.id)} className="p-2" style={{ color: 'var(--text-tertiary)' }}><Trash2 className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--surface-secondary)' }}>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Driver</p>
                    <p className="text-sm font-medium mt-1" style={{ color: 'var(--text-primary)' }}>{selectedRoute.driver_name || selectedRoute.driverName || selectedRoute.driver || 'Unassigned'}</p>
                  </div>
                  <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--surface-secondary)' }}>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Bus Number</p>
                    <p className="text-sm font-medium mt-1" style={{ color: 'var(--text-primary)' }}>{selectedRoute.bus_number || selectedRoute.vehicle || 'N/A'}</p>
                  </div>
                  <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--surface-secondary)' }}>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Students / Capacity</p>
                    <p className={`text-sm font-medium mt-1`} style={{ color: isRouteFull ? 'var(--error-text)' : 'var(--text-primary)' }}>
                      {routeStudentCount} / {routeCapacity || 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Waitlist indicator */}
                {isRouteFull && (
                  <div className="mb-4 p-3 rounded-lg flex items-center gap-2 text-sm" style={{ backgroundColor: 'var(--warning-subtle)', border: '1px solid var(--warning-border)', color: 'var(--warning-text)' }}>
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>This route is at full capacity. New students will be placed on a waitlist.</span>
                  </div>
                )}

                {/* Stops */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold font-heading mb-3" style={{ color: 'var(--text-primary)' }}>Stops</h3>
                  {(selectedRoute.stops || []).length === 0 ? (
                    <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No stops defined</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedRoute.stops.map((stop, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium" style={{ backgroundColor: 'var(--accent-subtle)', color: 'var(--accent)' }}>{i + 1}</div>
                          <MapPin className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
                          <span style={{ color: 'var(--text-secondary)' }}>{stop.name || stop}</span>
                          {(stop.estimated_time || stop.time) && <span className="ml-auto flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}><Clock className="w-3 h-3" />{stop.estimated_time || stop.time}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Students */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold font-heading" style={{ color: 'var(--text-primary)' }}>Assigned Students</h3>
                    {!isDriver && (
                      <button onClick={() => { setShowAssign(true); api.get('/students', { params: { status: 'active' } }).then(r => setStudents(r.data.students || r.data || [])).catch(() => {}); }} className="text-sm font-medium" style={{ color: 'var(--accent)' }}>
                        + Assign Student
                      </button>
                    )}
                  </div>
                  {(selectedRoute.students || []).length === 0 ? (
                    <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No students assigned</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedRoute.students.map((s, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm p-2 rounded-lg" style={{ backgroundColor: 'var(--surface-secondary)' }}>
                          <Users className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                          <span style={{ color: 'var(--text-secondary)' }}>{s.first_name ? `${s.first_name} ${s.last_name || ''}`.trim() : (s.nameEn || s.name || s)}</span>
                          {s.stop && <span className="ml-auto text-xs" style={{ color: 'var(--text-tertiary)' }}>{s.stop}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* GPS Tracking Placeholder */}
              <div className="card p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Radio className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                  <h3 className="text-sm font-semibold font-heading" style={{ color: 'var(--text-primary)' }}>GPS Tracking</h3>
                </div>
                <div className="rounded-lg h-48 flex items-center justify-center text-sm border-2 border-dashed" style={{ backgroundColor: 'var(--surface-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-tertiary)' }}>
                  <div className="text-center">
                    <MapPin className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-tertiary)' }} />
                    <p>Live GPS tracking will be available when connected to the bus tracking device</p>
                  </div>
                </div>
              </div>

              {/* Tracking Events Timeline */}
              <div className="card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                  <h3 className="text-sm font-semibold font-heading" style={{ color: 'var(--text-primary)' }}>Today's Tracking Events</h3>
                </div>
                {loadingTracking ? (
                  <LoadingSpinner />
                ) : trackingEvents.length === 0 ? (
                  <p className="text-sm text-center py-4" style={{ color: 'var(--text-tertiary)' }}>No tracking events today</p>
                ) : (
                  <div className="space-y-0">
                    {trackingEvents.map((evt, i) => {
                      const formatted = formatEvent(evt);
                      return (
                        <div key={i} className="flex items-start gap-3 relative">
                          {i < trackingEvents.length - 1 && (
                            <div className="absolute left-[11px] top-6 w-0.5 h-full" style={{ backgroundColor: 'var(--border-default)' }} />
                          )}
                          <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 z-10" style={{ backgroundColor: 'var(--accent-subtle)' }}>
                            {formatted.icon === 'bus' && <Bus className="w-3 h-3" style={{ color: 'var(--accent)' }} />}
                            {formatted.icon === 'pin' && <MapPin className="w-3 h-3" style={{ color: 'var(--accent)' }} />}
                            {formatted.icon === 'user' && <Users className="w-3 h-3" style={{ color: 'var(--accent)' }} />}
                            {formatted.icon === 'bell' && <Bell className="w-3 h-3" style={{ color: 'var(--accent)' }} />}
                          </div>
                          <div className="pb-4">
                            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{formatted.text}</p>
                            {formatted.time && <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{formatted.time}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Notification Log */}
              {trackingEvents.length > 0 && (
                <div className="card p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Bell className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                    <h3 className="text-sm font-semibold font-heading" style={{ color: 'var(--text-primary)' }}>Notification Log</h3>
                  </div>
                  <div className="space-y-2">
                    {trackingEvents.map((evt, i) => {
                      const formatted = formatEvent(evt);
                      return (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--accent-subtle)' }}>
                          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--accent-subtle)' }}>
                            <Bell className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{formatted.text}{formatted.time ? ` at ${formatted.time}` : ''}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="card p-12 text-center" style={{ color: 'var(--text-tertiary)' }}>
              <Bus className="w-12 h-12 mx-auto mb-3" />
              <p>Select a route to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Route Form Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={form._id ? 'Edit Route' : 'Add Route'}>
        <div className="space-y-4">
          <div>
            <label className="label">Route Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input w-full px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="label">Bus Number</label>
            <input value={form.bus_number} onChange={(e) => setForm({ ...form, bus_number: e.target.value })} className="input w-full px-3 py-2 text-sm" placeholder="e.g., Bus #5" />
          </div>
          <div>
            <label className="label">Capacity</label>
            <input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} className="input w-full px-3 py-2 text-sm" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowForm(false)} className="btn-secondary px-4 py-2 rounded-lg text-sm font-medium">Cancel</button>
            <button onClick={handleSaveRoute} className="btn-primary px-4 py-2 rounded-lg text-sm font-medium">Save</button>
          </div>
        </div>
      </Modal>

      {/* Assign Student Modal */}
      <Modal open={showAssign} onClose={() => setShowAssign(false)} title="Assign Student to Route">
        <div className="space-y-3">
          <select value={assignStudentId} onChange={(e) => setAssignStudentId(e.target.value)} className="input w-full px-3 py-2 text-sm">
            <option value="">Select Student</option>
            {students.map((s) => {
              const sName = s.first_name ? `${s.first_name} ${s.last_name || ''}`.trim() : (s.nameEn || s.name);
              return <option key={s.id || s._id} value={s.id || s._id}>{sName}</option>;
            })}
          </select>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowAssign(false)} className="btn-secondary px-4 py-2 rounded-lg text-sm font-medium">Cancel</button>
            <button onClick={handleAssignStudent} disabled={!assignStudentId} className="btn-primary px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60">Assign</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
