import { Router } from 'express';
import db from '../db/schema.js';
import { authenticate, requireSchool, requirePermission } from '../middleware/auth.js';

const router = Router();

// GET /api/transport/manifest/:routeId
router.get('/api/transport/manifest/:routeId', authenticate, requireSchool, requirePermission('transport.view', 'transport.driver'), (req, res) => {
  try {
    const route = db.prepare('SELECT * FROM bus_routes WHERE id = ? AND school_id = ?').get(req.params.routeId, req.schoolId);
    if (!route) return res.status(404).json({ error: 'Route not found' });

    const today = new Date().toISOString().split('T')[0];

    // Get assigned students, excluding those marked absent today
    const students = db.prepare(`
      SELECT sb.id as assignment_id, sb.stop_id,
             s.id as student_id, s.first_name, s.last_name, s.student_number, s.photo,
             bs.name as stop_name, bs.order_index, bs.estimated_time,
             gl.name_en as grade_name_en, sec.name_en as section_name_en,
             CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END as is_absent
      FROM student_bus sb
      JOIN students s ON sb.student_id = s.id
      JOIN bus_stops bs ON sb.stop_id = bs.id
      LEFT JOIN grade_levels gl ON s.grade_level_id = gl.id
      LEFT JOIN sections sec ON s.section_id = sec.id
      LEFT JOIN attendance a ON a.student_id = s.id AND a.date = ? AND a.period IS NULL AND a.school_id = ?
      WHERE sb.school_id = ? AND sb.route_id = ? AND s.status = 'active'
      ORDER BY bs.order_index, s.last_name
    `).all(today, req.schoolId, req.schoolId, req.params.routeId);

    // Filter out absent students for the manifest
    const manifest = students.filter(s => !s.is_absent);
    const absentStudents = students.filter(s => s.is_absent);

    res.json({ route, date: today, manifest, absentStudents, totalAssigned: students.length, totalRiding: manifest.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/transport/routes
router.get('/api/transport/routes', authenticate, requireSchool, requirePermission('transport.view', 'transport.driver'), (req, res) => {
  try {
    const routes = db.prepare(`
      SELECT br.*, u.first_name as driver_first_name, u.last_name as driver_last_name,
             (SELECT COUNT(*) FROM student_bus WHERE route_id = br.id AND school_id = ?) as student_count,
             (SELECT COUNT(*) FROM bus_stops WHERE route_id = br.id AND school_id = ?) as stop_count
      FROM bus_routes br
      LEFT JOIN users u ON br.driver_id = u.id
      WHERE br.school_id = ?
      ORDER BY br.name
    `).all(req.schoolId, req.schoolId, req.schoolId);

    res.json(routes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/transport/routes/:id
router.get('/api/transport/routes/:id', authenticate, requireSchool, requirePermission('transport.view', 'transport.driver'), (req, res) => {
  try {
    const route = db.prepare(`
      SELECT br.*, u.first_name as driver_first_name, u.last_name as driver_last_name, u.phone as driver_phone
      FROM bus_routes br
      LEFT JOIN users u ON br.driver_id = u.id
      WHERE br.id = ? AND br.school_id = ?
    `).get(req.params.id, req.schoolId);

    if (!route) return res.status(404).json({ error: 'Route not found' });

    const stops = db.prepare(`
      SELECT bs.*,
             (SELECT COUNT(*) FROM student_bus WHERE stop_id = bs.id AND school_id = ?) as student_count
      FROM bus_stops bs
      WHERE bs.route_id = ? AND bs.school_id = ?
      ORDER BY bs.order_index
    `).all(req.schoolId, req.params.id, req.schoolId);

    const students = db.prepare(`
      SELECT sb.id as assignment_id, sb.stop_id,
             s.id as student_id, s.first_name, s.last_name, s.student_number,
             bs.name as stop_name,
             gl.name_en as grade_name_en, sec.name_en as section_name_en
      FROM student_bus sb
      JOIN students s ON sb.student_id = s.id
      JOIN bus_stops bs ON sb.stop_id = bs.id
      LEFT JOIN grade_levels gl ON s.grade_level_id = gl.id
      LEFT JOIN sections sec ON s.section_id = sec.id
      WHERE sb.school_id = ? AND sb.route_id = ? AND s.status = 'active'
      ORDER BY bs.order_index, s.last_name
    `).all(req.schoolId, req.params.id);

    res.json({ ...route, stops, students });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transport/routes
router.post('/api/transport/routes', authenticate, requireSchool, requirePermission('transport.manage'), (req, res) => {
  try {
    const { name, driver_id, bus_number, capacity } = req.body;
    if (!name) return res.status(400).json({ error: 'Route name is required' });

    const result = db.prepare(`
      INSERT INTO bus_routes (school_id, name, driver_id, bus_number, capacity)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.schoolId, name, driver_id || null, bus_number, capacity || 40);

    const route = db.prepare('SELECT * FROM bus_routes WHERE id = ? AND school_id = ?').get(result.lastInsertRowid, req.schoolId);
    res.status(201).json(route);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/transport/routes/:id
router.put('/api/transport/routes/:id', authenticate, requireSchool, requirePermission('transport.manage'), (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM bus_routes WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!existing) return res.status(404).json({ error: 'Route not found' });

    const { name, driver_id, bus_number, capacity, is_active } = req.body;

    db.prepare(`
      UPDATE bus_routes SET
        name = COALESCE(?, name), driver_id = COALESCE(?, driver_id),
        bus_number = COALESCE(?, bus_number), capacity = COALESCE(?, capacity),
        is_active = COALESCE(?, is_active)
      WHERE id = ? AND school_id = ?
    `).run(name, driver_id, bus_number, capacity, is_active, req.params.id, req.schoolId);

    const route = db.prepare('SELECT * FROM bus_routes WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    res.json(route);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transport/stops
router.post('/api/transport/stops', authenticate, requireSchool, requirePermission('transport.manage'), (req, res) => {
  try {
    const { route_id, name, name_ar, latitude, longitude, order_index, estimated_time } = req.body;
    if (!route_id || !name || order_index === undefined) {
      return res.status(400).json({ error: 'route_id, name, and order_index are required' });
    }

    // Verify the route belongs to this school
    const route = db.prepare('SELECT id FROM bus_routes WHERE id = ? AND school_id = ?').get(route_id, req.schoolId);
    if (!route) return res.status(404).json({ error: 'Route not found' });

    const result = db.prepare(`
      INSERT INTO bus_stops (school_id, route_id, name, name_ar, latitude, longitude, order_index, estimated_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.schoolId, route_id, name, name_ar, latitude, longitude, order_index, estimated_time);

    const stop = db.prepare('SELECT * FROM bus_stops WHERE id = ? AND school_id = ?').get(result.lastInsertRowid, req.schoolId);
    res.status(201).json(stop);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/transport/stops/:id
router.put('/api/transport/stops/:id', authenticate, requireSchool, requirePermission('transport.manage'), (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM bus_stops WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!existing) return res.status(404).json({ error: 'Stop not found' });

    const { name, name_ar, latitude, longitude, order_index, estimated_time } = req.body;

    db.prepare(`
      UPDATE bus_stops SET
        name = COALESCE(?, name), name_ar = COALESCE(?, name_ar),
        latitude = COALESCE(?, latitude), longitude = COALESCE(?, longitude),
        order_index = COALESCE(?, order_index), estimated_time = COALESCE(?, estimated_time)
      WHERE id = ? AND school_id = ?
    `).run(name, name_ar, latitude, longitude, order_index, estimated_time, req.params.id, req.schoolId);

    const stop = db.prepare('SELECT * FROM bus_stops WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    res.json(stop);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/transport/stops/:id
router.delete('/api/transport/stops/:id', authenticate, requireSchool, requirePermission('transport.manage'), (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM bus_stops WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!existing) return res.status(404).json({ error: 'Stop not found' });

    db.prepare('DELETE FROM student_bus WHERE stop_id = ? AND school_id = ?').run(req.params.id, req.schoolId);
    db.prepare('DELETE FROM bus_stops WHERE id = ? AND school_id = ?').run(req.params.id, req.schoolId);
    res.json({ message: 'Stop deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transport/assign-student
router.post('/api/transport/assign-student', authenticate, requireSchool, requirePermission('transport.manage'), (req, res) => {
  try {
    const { student_id, route_id, stop_id } = req.body;
    if (!student_id || !route_id || !stop_id) {
      return res.status(400).json({ error: 'student_id, route_id, and stop_id are required' });
    }

    // Check if already assigned
    const existing = db.prepare('SELECT id FROM student_bus WHERE student_id = ? AND school_id = ?').get(student_id, req.schoolId);
    if (existing) {
      db.prepare('UPDATE student_bus SET route_id = ?, stop_id = ? WHERE id = ? AND school_id = ?').run(route_id, stop_id, existing.id, req.schoolId);
      const updated = db.prepare('SELECT * FROM student_bus WHERE id = ? AND school_id = ?').get(existing.id, req.schoolId);
      return res.json(updated);
    }

    const result = db.prepare(`
      INSERT INTO student_bus (school_id, student_id, route_id, stop_id) VALUES (?, ?, ?, ?)
    `).run(req.schoolId, student_id, route_id, stop_id);

    const assignment = db.prepare('SELECT * FROM student_bus WHERE id = ? AND school_id = ?').get(result.lastInsertRowid, req.schoolId);
    res.status(201).json(assignment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/transport/assign-student/:id
router.delete('/api/transport/assign-student/:id', authenticate, requireSchool, requirePermission('transport.manage'), (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM student_bus WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!existing) return res.status(404).json({ error: 'Assignment not found' });

    db.prepare('DELETE FROM student_bus WHERE id = ? AND school_id = ?').run(req.params.id, req.schoolId);
    res.json({ message: 'Student removed from route' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transport/tracking - Log bus tracking event
router.post('/api/transport/tracking', authenticate, requireSchool, requirePermission('transport.driver', 'transport.manage'), (req, res) => {
  try {
    const { route_id, event_type, student_id, stop_id, latitude, longitude, notes } = req.body;

    if (!route_id || !event_type) {
      return res.status(400).json({ error: 'route_id and event_type are required' });
    }

    const result = db.prepare(`
      INSERT INTO bus_tracking (school_id, route_id, event_type, student_id, stop_id, latitude, longitude, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.schoolId, route_id, event_type, student_id || null, stop_id || null, latitude || null, longitude || null, notes);

    const tracking = db.prepare('SELECT * FROM bus_tracking WHERE id = ? AND school_id = ?').get(result.lastInsertRowid, req.schoolId);
    res.status(201).json(tracking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/transport/tracking/:routeId - Get today's tracking events for a route
router.get('/api/transport/tracking/:routeId', authenticate, requireSchool, requirePermission('transport.view', 'transport.driver'), (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const events = db.prepare(`
      SELECT bt.*, s.first_name as student_first_name, s.last_name as student_last_name,
             bs.name as stop_name
      FROM bus_tracking bt
      LEFT JOIN students s ON bt.student_id = s.id
      LEFT JOIN bus_stops bs ON bt.stop_id = bs.id
      WHERE bt.school_id = ? AND bt.route_id = ? AND date(bt.created_at) = ?
      ORDER BY bt.created_at DESC
    `).all(req.schoolId, req.params.routeId, today);

    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/transport/waitlist/:routeId - Get students on waitlist (route at capacity)
router.get('/api/transport/waitlist/:routeId', authenticate, requireSchool, requirePermission('transport.view', 'transport.manage'), (req, res) => {
  try {
    const route = db.prepare('SELECT * FROM bus_routes WHERE id = ? AND school_id = ?').get(req.params.routeId, req.schoolId);
    if (!route) return res.status(404).json({ error: 'Route not found' });

    const assignedCount = db.prepare('SELECT COUNT(*) as count FROM student_bus WHERE route_id = ? AND school_id = ?').get(req.params.routeId, req.schoolId).count;

    if (assignedCount <= route.capacity) {
      return res.json({ route_id: route.id, capacity: route.capacity, assigned: assignedCount, waitlist: [] });
    }

    // Get the overflow students (assigned after capacity was reached, ordered by id desc)
    const waitlistStudents = db.prepare(`
      SELECT sb.id as assignment_id, sb.stop_id,
             s.id as student_id, s.first_name, s.last_name, s.student_number,
             bs.name as stop_name,
             gl.name_en as grade_name_en, sec.name_en as section_name_en
      FROM student_bus sb
      JOIN students s ON sb.student_id = s.id
      JOIN bus_stops bs ON sb.stop_id = bs.id
      LEFT JOIN grade_levels gl ON s.grade_level_id = gl.id
      LEFT JOIN sections sec ON s.section_id = sec.id
      WHERE sb.school_id = ? AND sb.route_id = ? AND s.status = 'active'
      ORDER BY sb.id DESC
      LIMIT ?
    `).all(req.schoolId, req.params.routeId, assignedCount - route.capacity);

    res.json({ route_id: route.id, capacity: route.capacity, assigned: assignedCount, waitlist: waitlistStudents });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
