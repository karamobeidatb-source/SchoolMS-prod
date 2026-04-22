import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db/schema.js';
import { authenticate, requireSchool, requirePermission, normalizePhone } from '../middleware/auth.js';

const router = Router();

// ====== SETTINGS ======

// GET /api/settings
router.get('/api/settings', authenticate, requireSchool, (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM settings WHERE school_id = ?').all(req.schoolId);
    const result = {};
    for (const s of settings) {
      result[s.key] = s.value;
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings
router.put('/api/settings', authenticate, requireSchool, requirePermission('settings.manage'), (req, res) => {
  try {
    const upsert = db.prepare('INSERT INTO settings (school_id, key, value) VALUES (?, ?, ?) ON CONFLICT(school_id, key) DO UPDATE SET value = excluded.value');

    const transaction = db.transaction(() => {
      for (const [key, value] of Object.entries(req.body)) {
        upsert.run(req.schoolId, key, String(value));
      }
    });

    transaction();

    const settings = db.prepare('SELECT * FROM settings WHERE school_id = ?').all(req.schoolId);
    const result = {};
    for (const s of settings) {
      result[s.key] = s.value;
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====== ROLES & PERMISSIONS ======

// GET /api/roles
router.get('/api/roles', authenticate, (req, res) => {
  try {
    const roles = db.prepare('SELECT * FROM roles ORDER BY id').all();

    const rolesWithPermissions = roles.map(role => {
      const permissions = db.prepare(`
        SELECT p.* FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        WHERE rp.role_id = ?
        ORDER BY p.module, p.key
      `).all(role.id);
      return { ...role, permissions };
    });

    res.json(rolesWithPermissions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/roles/:id/permissions
router.put('/api/roles/:id/permissions', authenticate, requirePermission('roles.manage'), (req, res) => {
  try {
    const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(req.params.id);
    if (!role) return res.status(404).json({ error: 'Role not found' });

    const { permission_ids } = req.body;
    if (!Array.isArray(permission_ids)) {
      return res.status(400).json({ error: 'permission_ids must be an array' });
    }

    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(req.params.id);
      const insert = db.prepare('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
      for (const permId of permission_ids) {
        insert.run(req.params.id, permId);
      }
    });

    transaction();

    const permissions = db.prepare(`
      SELECT p.* FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = ?
    `).all(req.params.id);

    res.json({ ...role, permissions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/permissions
router.get('/api/permissions', authenticate, (req, res) => {
  try {
    const permissions = db.prepare('SELECT * FROM permissions ORDER BY module, key').all();
    res.json(permissions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====== GRADE LEVELS ======

// GET /api/grade-levels
router.get('/api/grade-levels', authenticate, requireSchool, (req, res) => {
  try {
    const gradeLevels = db.prepare(`
      SELECT gl.*,
        (SELECT COUNT(*) FROM students WHERE grade_level_id = gl.id AND status = 'active' AND school_id = ?) as student_count,
        (SELECT COUNT(*) FROM sections WHERE grade_level_id = gl.id AND is_active = 1 AND school_id = ?) as section_count
      FROM grade_levels gl
      WHERE gl.school_id = ?
      ORDER BY gl.order_index
    `).all(req.schoolId, req.schoolId, req.schoolId);
    res.json(gradeLevels);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/grade-levels
router.post('/api/grade-levels', authenticate, requireSchool, requirePermission('grade_levels.manage'), (req, res) => {
  try {
    const { name_en, name_ar, order_index } = req.body;
    if (!name_en || !name_ar || order_index === undefined) {
      return res.status(400).json({ error: 'name_en, name_ar, and order_index are required' });
    }

    const result = db.prepare('INSERT INTO grade_levels (school_id, name_en, name_ar, order_index) VALUES (?, ?, ?, ?)').run(req.schoolId, name_en, name_ar, order_index);
    const gradeLevel = db.prepare('SELECT * FROM grade_levels WHERE id = ? AND school_id = ?').get(result.lastInsertRowid, req.schoolId);
    res.status(201).json(gradeLevel);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/grade-levels/:id
router.put('/api/grade-levels/:id', authenticate, requireSchool, requirePermission('grade_levels.manage'), (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM grade_levels WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!existing) return res.status(404).json({ error: 'Grade level not found' });

    const { name_en, name_ar, order_index, is_active } = req.body;

    db.prepare(`
      UPDATE grade_levels SET
        name_en = COALESCE(?, name_en), name_ar = COALESCE(?, name_ar),
        order_index = COALESCE(?, order_index), is_active = COALESCE(?, is_active)
      WHERE id = ? AND school_id = ?
    `).run(name_en, name_ar, order_index, is_active, req.params.id, req.schoolId);

    const gradeLevel = db.prepare('SELECT * FROM grade_levels WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    res.json(gradeLevel);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====== SECTIONS ======

// GET /api/sections
router.get('/api/sections', authenticate, requireSchool, (req, res) => {
  try {
    const { grade_level_id } = req.query;
    let where = ['sec.is_active = 1', 'sec.school_id = ?'];
    let params = [req.schoolId];

    if (grade_level_id) { where.push('sec.grade_level_id = ?'); params.push(grade_level_id); }

    const sections = db.prepare(`
      SELECT sec.*, gl.name_en as grade_name_en, gl.name_ar as grade_name_ar,
             u.first_name as homeroom_teacher_first_name, u.last_name as homeroom_teacher_last_name,
             (SELECT COUNT(*) FROM students WHERE section_id = sec.id AND status = 'active' AND school_id = sec.school_id) as student_count
      FROM sections sec
      JOIN grade_levels gl ON sec.grade_level_id = gl.id
      LEFT JOIN users u ON sec.homeroom_teacher_id = u.id
      WHERE ${where.join(' AND ')}
      ORDER BY gl.order_index, sec.name_en
    `).all(...params);

    res.json(sections);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sections
router.post('/api/sections', authenticate, requireSchool, requirePermission('grade_levels.manage'), (req, res) => {
  try {
    const { name_en, name_ar, grade_level_id, capacity, homeroom_teacher_id } = req.body;
    if (!name_en || !name_ar || !grade_level_id) {
      return res.status(400).json({ error: 'name_en, name_ar, and grade_level_id are required' });
    }

    const result = db.prepare(`
      INSERT INTO sections (school_id, name_en, name_ar, grade_level_id, capacity, homeroom_teacher_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.schoolId, name_en, name_ar, grade_level_id, capacity || 30, homeroom_teacher_id || null);

    const section = db.prepare('SELECT * FROM sections WHERE id = ? AND school_id = ?').get(result.lastInsertRowid, req.schoolId);
    res.status(201).json(section);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/sections/:id
router.put('/api/sections/:id', authenticate, requireSchool, requirePermission('grade_levels.manage'), (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM sections WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!existing) return res.status(404).json({ error: 'Section not found' });

    const { name_en, name_ar, capacity, homeroom_teacher_id, is_active } = req.body;

    db.prepare(`
      UPDATE sections SET
        name_en = COALESCE(?, name_en), name_ar = COALESCE(?, name_ar),
        capacity = COALESCE(?, capacity), homeroom_teacher_id = COALESCE(?, homeroom_teacher_id),
        is_active = COALESCE(?, is_active)
      WHERE id = ? AND school_id = ?
    `).run(name_en, name_ar, capacity, homeroom_teacher_id, is_active, req.params.id, req.schoolId);

    const section = db.prepare('SELECT * FROM sections WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    res.json(section);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====== SUBJECTS ======

// GET /api/subjects
router.get('/api/subjects', authenticate, requireSchool, (req, res) => {
  try {
    const subjects = db.prepare('SELECT * FROM subjects WHERE school_id = ? ORDER BY name_en').all(req.schoolId);
    res.json(subjects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/subjects
router.post('/api/subjects', authenticate, requireSchool, requirePermission('subjects.manage'), (req, res) => {
  try {
    const { name_en, name_ar, code } = req.body;
    if (!name_en || !name_ar) {
      return res.status(400).json({ error: 'name_en and name_ar are required' });
    }

    const result = db.prepare('INSERT INTO subjects (school_id, name_en, name_ar, code) VALUES (?, ?, ?, ?)').run(req.schoolId, name_en, name_ar, code);
    const subject = db.prepare('SELECT * FROM subjects WHERE id = ? AND school_id = ?').get(result.lastInsertRowid, req.schoolId);
    res.status(201).json(subject);
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Subject code already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/subjects/:id
router.put('/api/subjects/:id', authenticate, requireSchool, requirePermission('subjects.manage'), (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM subjects WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!existing) return res.status(404).json({ error: 'Subject not found' });

    const { name_en, name_ar, code, is_active } = req.body;

    db.prepare(`
      UPDATE subjects SET
        name_en = COALESCE(?, name_en), name_ar = COALESCE(?, name_ar),
        code = COALESCE(?, code), is_active = COALESCE(?, is_active)
      WHERE id = ? AND school_id = ?
    `).run(name_en, name_ar, code, is_active, req.params.id, req.schoolId);

    const subject = db.prepare('SELECT * FROM subjects WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    res.json(subject);
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Subject code already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ====== USERS ======

// GET /api/users
router.get('/api/users', authenticate, requireSchool, requirePermission('users.manage'), (req, res) => {
  try {
    const { role_id, search, is_active } = req.query;
    let where = ['u.school_id = ?'];
    let params = [req.schoolId];

    if (role_id) { where.push('u.role_id = ?'); params.push(role_id); }
    if (is_active !== undefined) { where.push('u.is_active = ?'); params.push(is_active); }
    if (search) {
      where.push('(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    const users = db.prepare(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.first_name_ar, u.last_name_ar,
             u.phone, u.role_id, u.avatar, u.is_active, u.created_at, u.updated_at,
             r.key as role_key, r.label_en as role_label_en, r.label_ar as role_label_ar
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE ${where.join(' AND ')}
      ORDER BY u.last_name, u.first_name
    `).all(...params);

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users
router.post('/api/users', authenticate, requireSchool, requirePermission('users.manage'), (req, res) => {
  try {
    const { email, password, first_name, last_name, first_name_ar, last_name_ar, phone, role_id } = req.body;

    if (!password || !first_name || !last_name || !phone || !role_id) {
      return res.status(400).json({ error: 'password, first_name, last_name, phone, and role_id are required' });
    }

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      return res.status(400).json({ error: 'Invalid phone number' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    const result = db.prepare(`
      INSERT INTO users (school_id, email, password, first_name, last_name, first_name_ar, last_name_ar, phone, role_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.schoolId, email || null, hashedPassword, first_name, last_name, first_name_ar, last_name_ar, normalizedPhone, role_id);

    const user = db.prepare(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.first_name_ar, u.last_name_ar,
             u.phone, u.role_id, u.is_active, u.created_at,
             r.key as role_key, r.label_en as role_label_en
      FROM users u JOIN roles r ON u.role_id = r.id
      WHERE u.id = ? AND u.school_id = ?
    `).get(result.lastInsertRowid, req.schoolId);

    res.status(201).json(user);
  } catch (err) {
    if (err.message.includes('UNIQUE constraint') && err.message.includes('phone')) {
      return res.status(409).json({ error: 'Phone number already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id
router.put('/api/users/:id', authenticate, requireSchool, requirePermission('users.manage'), (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM users WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!existing) return res.status(404).json({ error: 'User not found' });

    const { email, password, first_name, last_name, first_name_ar, last_name_ar, phone, role_id, is_active, avatar } = req.body;

    if (password) {
      const hashed = bcrypt.hashSync(password, 10);
      db.prepare('UPDATE users SET password = ? WHERE id = ? AND school_id = ?').run(hashed, req.params.id, req.schoolId);
    }

    const normalizedPhone = phone !== undefined && phone !== null ? normalizePhone(phone) : null;

    db.prepare(`
      UPDATE users SET
        email = COALESCE(?, email), first_name = COALESCE(?, first_name),
        last_name = COALESCE(?, last_name), first_name_ar = COALESCE(?, first_name_ar),
        last_name_ar = COALESCE(?, last_name_ar), phone = COALESCE(?, phone),
        role_id = COALESCE(?, role_id), is_active = COALESCE(?, is_active),
        avatar = COALESCE(?, avatar), updated_at = datetime('now')
      WHERE id = ? AND school_id = ?
    `).run(email, first_name, last_name, first_name_ar, last_name_ar, normalizedPhone, role_id, is_active, avatar, req.params.id, req.schoolId);

    const user = db.prepare(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.first_name_ar, u.last_name_ar,
             u.phone, u.role_id, u.is_active, u.avatar, u.created_at, u.updated_at,
             r.key as role_key, r.label_en as role_label_en
      FROM users u JOIN roles r ON u.role_id = r.id
      WHERE u.id = ? AND u.school_id = ?
    `).get(req.params.id, req.schoolId);

    res.json(user);
  } catch (err) {
    if (err.message.includes('UNIQUE constraint') && err.message.includes('phone')) {
      return res.status(409).json({ error: 'Phone number already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

export default router;
