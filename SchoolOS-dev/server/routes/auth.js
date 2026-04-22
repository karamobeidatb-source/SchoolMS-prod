import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db/schema.js';
import { authenticate, signAuthToken, normalizePhone } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/login  — login by phone (no + prefix)
router.post('/api/auth/login', (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ error: 'Phone and password are required' });
    }

    const normalizedPhone = normalizePhone(phone);
    const user = db.prepare(`
      SELECT u.*, r.key as role_key, r.label_en as role_label_en, r.label_ar as role_label_ar
      FROM users u JOIN roles r ON u.role_id = r.id
      WHERE u.phone = ? AND u.is_active = 1
    `).get(normalizedPhone);

    if (!user) {
      return res.status(401).json({ error: 'Invalid phone or password' });
    }

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid phone or password' });
    }

    const permissions = db.prepare(`
      SELECT p.key FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = ?
    `).all(user.role_id).map(p => p.key);

    // Regular users: active school = their own school. super_admin: no active school until selected.
    const activeSchoolId = user.role_key === 'super_admin' ? null : user.school_id;
    const token = signAuthToken({ userId: user.id, activeSchoolId });

    let activeSchool = null;
    if (activeSchoolId) {
      activeSchool = db.prepare('SELECT id, name_en, name_ar, code FROM schools WHERE id = ?').get(activeSchoolId);
    }

    const { password: _, ...userWithoutPassword } = user;

    res.json({
      token,
      user: userWithoutPassword,
      permissions,
      activeSchool,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/select-school  — super_admin picks which school to operate in
router.post('/api/auth/select-school', authenticate, (req, res) => {
  try {
    if (req.user.role_key !== 'super_admin') {
      return res.status(403).json({ error: 'Only super admin can switch schools' });
    }

    const { school_id } = req.body;
    if (school_id === null || school_id === undefined) {
      // clear active school → back to system view
      const token = signAuthToken({ userId: req.user.id, activeSchoolId: null });
      return res.json({ token, activeSchool: null });
    }

    const school = db.prepare('SELECT id, name_en, name_ar, code, is_active FROM schools WHERE id = ?').get(school_id);
    if (!school) return res.status(404).json({ error: 'School not found' });
    if (!school.is_active) return res.status(400).json({ error: 'School is inactive' });

    const token = signAuthToken({ userId: req.user.id, activeSchoolId: school.id });
    res.json({ token, activeSchool: school });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/api/auth/me', authenticate, (req, res) => {
  try {
    const { password, ...userWithoutPassword } = req.user;
    res.json({
      user: userWithoutPassword,
      permissions: req.user.permissions,
      activeSchool: req.activeSchool,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/auth/profile
router.put('/api/auth/profile', authenticate, (req, res) => {
  try {
    const { first_name, last_name, first_name_ar, last_name_ar, phone, email, avatar, current_password, new_password } = req.body;

    if (new_password) {
      if (!current_password) {
        return res.status(400).json({ error: 'Current password is required to change password' });
      }
      const user = db.prepare('SELECT password FROM users WHERE id = ?').get(req.user.id);
      if (!bcrypt.compareSync(current_password, user.password)) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }
      const hashed = bcrypt.hashSync(new_password, 10);
      db.prepare('UPDATE users SET password = ?, updated_at = datetime("now") WHERE id = ?').run(hashed, req.user.id);
    }

    const normalizedPhone = phone === undefined ? undefined : normalizePhone(phone);

    db.prepare(`
      UPDATE users SET
        first_name = COALESCE(?, first_name),
        last_name = COALESCE(?, last_name),
        first_name_ar = COALESCE(?, first_name_ar),
        last_name_ar = COALESCE(?, last_name_ar),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        avatar = COALESCE(?, avatar),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(first_name, last_name, first_name_ar, last_name_ar, normalizedPhone, email, avatar, req.user.id);

    const updated = db.prepare(`
      SELECT u.*, r.key as role_key, r.label_en as role_label_en, r.label_ar as role_label_ar
      FROM users u JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?
    `).get(req.user.id);

    const { password: _, ...userWithoutPassword } = updated;
    res.json({ user: userWithoutPassword });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint') && err.message.includes('phone')) {
      return res.status(409).json({ error: 'Phone number already in use' });
    }
    res.status(500).json({ error: err.message });
  }
});

export default router;
