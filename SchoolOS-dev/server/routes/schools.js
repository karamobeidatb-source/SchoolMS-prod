import { Router } from 'express';
import db, { seedSchoolDefaults } from '../db/schema.js';
import { authenticate, requireSuperAdmin } from '../middleware/auth.js';

const router = Router();

// GET /api/schools  — list all schools (super_admin only)
router.get('/api/schools', authenticate, requireSuperAdmin, (req, res) => {
  try {
    const schools = db.prepare(`
      SELECT s.*,
        (SELECT COUNT(*) FROM users WHERE school_id = s.id AND is_active = 1) as user_count,
        (SELECT COUNT(*) FROM students WHERE school_id = s.id AND status = 'active') as student_count
      FROM schools s
      ORDER BY s.is_active DESC, s.name_en
    `).all();
    res.json(schools);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/schools/:id
router.get('/api/schools/:id', authenticate, requireSuperAdmin, (req, res) => {
  try {
    const school = db.prepare('SELECT * FROM schools WHERE id = ?').get(req.params.id);
    if (!school) return res.status(404).json({ error: 'School not found' });
    res.json(school);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/schools  — create a new school (super_admin only)
router.post('/api/schools', authenticate, requireSuperAdmin, (req, res) => {
  try {
    const { name_en, name_ar, code, phone, address, logo } = req.body;
    if (!name_en || !name_ar) {
      return res.status(400).json({ error: 'name_en and name_ar are required' });
    }

    const result = db.transaction(() => {
      const info = db.prepare(`
        INSERT INTO schools (name_en, name_ar, code, phone, address, logo)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(name_en, name_ar, code || null, phone || null, address || null, logo || null);

      const schoolId = info.lastInsertRowid;
      seedSchoolDefaults(schoolId, { school_name_en: name_en, school_name_ar: name_ar });
      return schoolId;
    })();

    const school = db.prepare('SELECT * FROM schools WHERE id = ?').get(result);
    res.status(201).json(school);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'School code already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/schools/:id
router.put('/api/schools/:id', authenticate, requireSuperAdmin, (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM schools WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'School not found' });

    const { name_en, name_ar, code, phone, address, logo, is_active } = req.body;

    db.prepare(`
      UPDATE schools SET
        name_en = COALESCE(?, name_en),
        name_ar = COALESCE(?, name_ar),
        code = COALESCE(?, code),
        phone = COALESCE(?, phone),
        address = COALESCE(?, address),
        logo = COALESCE(?, logo),
        is_active = COALESCE(?, is_active),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(name_en, name_ar, code, phone, address, logo, is_active, req.params.id);

    const school = db.prepare('SELECT * FROM schools WHERE id = ?').get(req.params.id);
    res.json(school);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'School code already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/schools/:id  — hard delete (requires school to be empty)
router.delete('/api/schools/:id', authenticate, requireSuperAdmin, (req, res) => {
  try {
    const school = db.prepare('SELECT id FROM schools WHERE id = ?').get(req.params.id);
    if (!school) return res.status(404).json({ error: 'School not found' });

    const userCount = db.prepare('SELECT COUNT(*) as c FROM users WHERE school_id = ?').get(req.params.id).c;
    if (userCount > 0) {
      return res.status(400).json({ error: 'Cannot delete a school with users. Deactivate instead.' });
    }

    db.transaction(() => {
      const tables = [
        'settings', 'grade_levels', 'sections', 'subjects', 'subject_assignments',
        'grading_weights', 'bus_stops', 'bus_routes', 'events', 'clubs',
      ];
      for (const t of tables) {
        db.prepare(`DELETE FROM ${t} WHERE school_id = ?`).run(req.params.id);
      }
      db.prepare('DELETE FROM schools WHERE id = ?').run(req.params.id);
    })();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
