import { Router } from 'express';
import db from '../db/schema.js';
import { authenticate, requireSchool, requirePermission } from '../middleware/auth.js';

const router = Router();

// GET /api/nurse-log
router.get('/api/nurse-log', authenticate, requireSchool, requirePermission('nurse.view'), (req, res) => {
  try {
    const { student_id, date, incident_type, from_date, to_date, page = 1, limit = 25 } = req.query;
    const offset = (page - 1) * limit;
    let where = ['nl.school_id = ?'];
    let params = [req.schoolId];

    if (student_id) { where.push('nl.student_id = ?'); params.push(student_id); }
    if (date) { where.push("date(nl.created_at) = ?"); params.push(date); }
    if (incident_type) { where.push('nl.incident_type = ?'); params.push(incident_type); }
    if (from_date) { where.push("date(nl.created_at) >= ?"); params.push(from_date); }
    if (to_date) { where.push("date(nl.created_at) <= ?"); params.push(to_date); }

    const whereClause = where.join(' AND ');
    const total = db.prepare(`SELECT COUNT(*) as count FROM nurse_log nl WHERE ${whereClause}`).get(...params).count;

    const entries = db.prepare(`
      SELECT nl.*, s.first_name as student_first_name, s.last_name as student_last_name,
             s.student_number, s.grade_level_id,
             gl.name_en as grade_name_en, sec.name_en as section_name_en,
             u.first_name as recorded_by_first_name, u.last_name as recorded_by_last_name
      FROM nurse_log nl
      JOIN students s ON nl.student_id = s.id
      LEFT JOIN grade_levels gl ON s.grade_level_id = gl.id
      LEFT JOIN sections sec ON s.section_id = sec.id
      JOIN users u ON nl.recorded_by = u.id
      WHERE ${whereClause}
      ORDER BY nl.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, Number(limit), Number(offset));

    res.json({ entries, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/nurse-log
router.post('/api/nurse-log', authenticate, requireSchool, requirePermission('nurse.manage'), (req, res) => {
  try {
    const { student_id, incident_type, description, action_taken, parent_notified } = req.body;

    if (!student_id || !description) {
      return res.status(400).json({ error: 'student_id and description are required' });
    }

    const result = db.prepare(`
      INSERT INTO nurse_log (school_id, student_id, recorded_by, incident_type, description, action_taken, parent_notified)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(req.schoolId, student_id, req.user.id, incident_type, description, action_taken, parent_notified ? 1 : 0);

    const entry = db.prepare(`
      SELECT nl.*, s.first_name as student_first_name, s.last_name as student_last_name, s.student_number
      FROM nurse_log nl
      JOIN students s ON nl.student_id = s.id
      WHERE nl.id = ? AND nl.school_id = ?
    `).get(result.lastInsertRowid, req.schoolId);

    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/nurse-log/:id
router.put('/api/nurse-log/:id', authenticate, requireSchool, requirePermission('nurse.manage'), (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM nurse_log WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!existing) return res.status(404).json({ error: 'Nurse log entry not found' });

    const { incident_type, description, action_taken, parent_notified } = req.body;

    db.prepare(`
      UPDATE nurse_log SET
        incident_type = COALESCE(?, incident_type), description = COALESCE(?, description),
        action_taken = COALESCE(?, action_taken), parent_notified = COALESCE(?, parent_notified)
      WHERE id = ? AND school_id = ?
    `).run(incident_type, description, action_taken, parent_notified !== undefined ? (parent_notified ? 1 : 0) : null, req.params.id, req.schoolId);

    const entry = db.prepare('SELECT * FROM nurse_log WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/nurse-log/student/:id
router.get('/api/nurse-log/student/:id', authenticate, requireSchool, requirePermission('nurse.view'), (req, res) => {
  try {
    const student = db.prepare(`
      SELECT s.*, gl.name_en as grade_name_en, sec.name_en as section_name_en
      FROM students s
      LEFT JOIN grade_levels gl ON s.grade_level_id = gl.id
      LEFT JOIN sections sec ON s.section_id = sec.id
      WHERE s.id = ? AND s.school_id = ?
    `).get(req.params.id, req.schoolId);

    if (!student) return res.status(404).json({ error: 'Student not found' });

    const entries = db.prepare(`
      SELECT nl.*, u.first_name as recorded_by_first_name, u.last_name as recorded_by_last_name
      FROM nurse_log nl
      JOIN users u ON nl.recorded_by = u.id
      WHERE nl.student_id = ? AND nl.school_id = ?
      ORDER BY nl.created_at DESC
    `).all(req.params.id, req.schoolId);

    // Summary
    const summary = db.prepare(`
      SELECT incident_type, COUNT(*) as count
      FROM nurse_log WHERE student_id = ? AND school_id = ?
      GROUP BY incident_type
    `).all(req.params.id, req.schoolId);

    res.json({ student, entries, summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
