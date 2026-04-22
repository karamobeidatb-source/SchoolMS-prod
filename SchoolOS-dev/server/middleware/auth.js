import jwt from 'jsonwebtoken';
import db from '../db/schema.js';

const JWT_SECRET = process.env.JWT_SECRET || 'schoolos-secret-key-change-in-production';

export function normalizePhone(raw) {
  if (!raw) return '';
  return String(raw).replace(/[^0-9]/g, '');
}

export function signAuthToken({ userId, activeSchoolId = null }) {
  return jwt.sign({ userId, activeSchoolId }, JWT_SECRET, { expiresIn: '24h' });
}

export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare(`
      SELECT u.*, r.key as role_key, r.label_en as role_label_en, r.label_ar as role_label_ar
      FROM users u JOIN roles r ON u.role_id = r.id
      WHERE u.id = ? AND u.is_active = 1
    `).get(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    const permissions = db.prepare(`
      SELECT p.key FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = ?
    `).all(user.role_id).map(p => p.key);

    // Determine the "active" school for this request.
    // - Regular users: locked to their own school_id
    // - super_admin: uses activeSchoolId from JWT (set via /api/auth/select-school)
    let activeSchoolId = user.school_id;
    if (user.role_key === 'super_admin') {
      activeSchoolId = decoded.activeSchoolId ?? null;
    }

    let activeSchool = null;
    if (activeSchoolId) {
      activeSchool = db.prepare('SELECT id, name_en, name_ar, code, is_active FROM schools WHERE id = ?').get(activeSchoolId);
      if (!activeSchool || !activeSchool.is_active) {
        if (user.role_key === 'super_admin') {
          activeSchoolId = null;
          activeSchool = null;
        } else {
          return res.status(403).json({ error: 'School is inactive or missing' });
        }
      }
    }

    req.user = { ...user, permissions };
    req.schoolId = activeSchoolId;
    req.activeSchool = activeSchool;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Require the request to be scoped to a specific school (non-system-admin routes).
export function requireSchool(req, res, next) {
  if (!req.schoolId) {
    return res.status(400).json({ error: 'No active school. Select a school to continue.' });
  }
  next();
}

export function requirePermission(...perms) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (req.user.role_key === 'super_admin') return next();
    const hasPermission = perms.some(p => req.user.permissions.includes(p));
    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

export function requireSuperAdmin(req, res, next) {
  if (!req.user || req.user.role_key !== 'super_admin') {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
}

export { JWT_SECRET };
