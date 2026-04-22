import { Router } from 'express';
import db from '../db/schema.js';
import { authenticate, requireSchool, requirePermission } from '../middleware/auth.js';

const router = Router();

// GET /api/attendance
router.get('/api/attendance', authenticate, requireSchool, requirePermission('attendance.view'), (req, res) => {
  try {
    const { date, student_id, section_id, period, status } = req.query;
    let where = ['a.school_id = ?'];
    let params = [req.schoolId];

    if (date) { where.push('a.date = ?'); params.push(date); }
    if (student_id) { where.push('a.student_id = ?'); params.push(student_id); }
    if (section_id) { where.push('s.section_id = ?'); params.push(section_id); }
    if (period) { where.push('a.period = ?'); params.push(period); }
    if (status) { where.push('a.status = ?'); params.push(status); }

    if (req.user.role_key === 'parent') {
      where.push('s.parent_id = ?');
      params.push(req.user.id);
    }
    if (req.user.role_key === 'student') {
      where.push('s.user_id = ?');
      params.push(req.user.id);
    }

    const records = db.prepare(`
      SELECT a.*, s.first_name, s.last_name, s.student_number,
             s.section_id, sec.name_en as section_name_en
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      LEFT JOIN sections sec ON s.section_id = sec.id
      WHERE ${where.join(' AND ')}
      ORDER BY a.date DESC, s.last_name
    `).all(...params);

    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/attendance
router.post('/api/attendance', authenticate, requireSchool, requirePermission('attendance.mark'), (req, res) => {
  try {
    const { student_id, date, period, status, notes } = req.body;

    if (!student_id || !date || !status) {
      return res.status(400).json({ error: 'student_id, date, and status are required' });
    }

    // Upsert attendance
    const existing = db.prepare(
      'SELECT id FROM attendance WHERE student_id = ? AND date = ? AND period IS ? AND school_id = ?'
    ).get(student_id, date, period || null, req.schoolId);

    if (existing) {
      db.prepare(`
        UPDATE attendance SET status = ?, notes = ?, recorded_by = ?, created_at = datetime('now')
        WHERE id = ? AND school_id = ?
      `).run(status, notes, req.user.id, existing.id, req.schoolId);
      const updated = db.prepare('SELECT * FROM attendance WHERE id = ? AND school_id = ?').get(existing.id, req.schoolId);
      return res.json(updated);
    }

    const result = db.prepare(`
      INSERT INTO attendance (school_id, student_id, date, period, status, notes, recorded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(req.schoolId, student_id, date, period || null, status, notes, req.user.id);

    const record = db.prepare('SELECT * FROM attendance WHERE id = ? AND school_id = ?').get(result.lastInsertRowid, req.schoolId);
    res.status(201).json(record);
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Attendance already recorded for this student/date/period' });
    }
    res.status(500).json({ error: err.message });
  }
});

// POST /api/attendance/bulk
router.post('/api/attendance/bulk', authenticate, requireSchool, requirePermission('attendance.mark'), (req, res) => {
  try {
    const { section_id, date, period, records } = req.body;

    if (!date || !records || !Array.isArray(records)) {
      return res.status(400).json({ error: 'date and records array are required' });
    }

    const upsert = db.prepare(`
      INSERT INTO attendance (school_id, student_id, date, period, status, notes, recorded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(student_id, date, period) DO UPDATE SET
        status = excluded.status, notes = excluded.notes, recorded_by = excluded.recorded_by, created_at = datetime('now')
    `);

    const transaction = db.transaction(() => {
      for (const r of records) {
        upsert.run(req.schoolId, r.student_id, date, period || null, r.status, r.notes || null, req.user.id);
      }
    });

    transaction();
    res.json({ message: 'Attendance recorded', count: records.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/attendance/stats
router.get('/api/attendance/stats', authenticate, requireSchool, requirePermission('attendance.view'), (req, res) => {
  try {
    const { date, section_id, grade_level_id, from_date, to_date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    // Today's stats
    const todayStats = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM attendance
      WHERE date = ? AND school_id = ?
      GROUP BY status
    `).all(targetDate, req.schoolId);

    // By section for today
    let sectionQuery = `
      SELECT sec.id as section_id, sec.name_en as section_name_en, gl.name_en as grade_name_en,
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present,
        COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent,
        COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late,
        COUNT(CASE WHEN a.status = 'excused' THEN 1 END) as excused,
        COUNT(a.id) as total
      FROM sections sec
      JOIN grade_levels gl ON sec.grade_level_id = gl.id
      LEFT JOIN students s ON s.section_id = sec.id AND s.status = 'active' AND s.school_id = ?
      LEFT JOIN attendance a ON a.student_id = s.id AND a.date = ? AND a.school_id = ?
      WHERE sec.is_active = 1 AND sec.school_id = ?
    `;
    let sectionParams = [req.schoolId, targetDate, req.schoolId, req.schoolId];
    if (section_id) { sectionQuery += ' AND sec.id = ?'; sectionParams.push(section_id); }
    if (grade_level_id) { sectionQuery += ' AND sec.grade_level_id = ?'; sectionParams.push(grade_level_id); }
    sectionQuery += ' GROUP BY sec.id ORDER BY gl.order_index, sec.name_en';

    const bySection = db.prepare(sectionQuery).all(...sectionParams);

    // Overall attendance rate
    const totalStudents = db.prepare("SELECT COUNT(*) as count FROM students WHERE status = 'active' AND school_id = ?").get(req.schoolId).count;

    res.json({ date: targetDate, summary: todayStats, bySection, totalStudents });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/attendance/student/:id
router.get('/api/attendance/student/:id', authenticate, requireSchool, requirePermission('attendance.view'), (req, res) => {
  try {
    const { from_date, to_date, month } = req.query;
    let where = ['a.student_id = ?', 'a.school_id = ?'];
    let params = [req.params.id, req.schoolId];

    if (from_date) { where.push('a.date >= ?'); params.push(from_date); }
    if (to_date) { where.push('a.date <= ?'); params.push(to_date); }
    if (month) {
      where.push("strftime('%Y-%m', a.date) = ?");
      params.push(month);
    }

    const records = db.prepare(`
      SELECT a.* FROM attendance a
      WHERE ${where.join(' AND ')}
      ORDER BY a.date DESC
    `).all(...params);

    const summary = db.prepare(`
      SELECT status, COUNT(*) as count FROM attendance a
      WHERE ${where.join(' AND ')}
      GROUP BY status
    `).all(...params);

    res.json({ records, summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
