import { Router } from 'express';
import db from '../db/schema.js';
import { authenticate, requireSchool, requirePermission } from '../middleware/auth.js';

const router = Router();

// GET /api/notifications - Get current user's notifications (paginated, filterable)
router.get('/api/notifications', authenticate, requireSchool, (req, res) => {
  try {
    const { page = 1, limit = 25, is_read } = req.query;
    const offset = (page - 1) * limit;
    let where = ['user_id = ?', 'school_id = ?'];
    let params = [req.user.id, req.schoolId];

    if (is_read !== undefined) {
      where.push('is_read = ?');
      params.push(Number(is_read));
    }

    const whereClause = where.join(' AND ');
    const total = db.prepare(`SELECT COUNT(*) as count FROM notifications WHERE ${whereClause}`).get(...params).count;

    const notifications = db.prepare(`
      SELECT * FROM notifications
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, Number(limit), Number(offset));

    res.json({
      notifications,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notifications/unread-count - Get unread notification count for current user
router.get('/api/notifications/unread-count', authenticate, requireSchool, (req, res) => {
  try {
    const count = db.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0 AND school_id = ?'
    ).get(req.user.id, req.schoolId).count;

    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/notifications/read-all - Mark all notifications as read for current user
router.put('/api/notifications/read-all', authenticate, requireSchool, (req, res) => {
  try {
    const result = db.prepare(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0 AND school_id = ?'
    ).run(req.user.id, req.schoolId);

    res.json({ message: 'All notifications marked as read', updated: result.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/notifications/:id/read - Mark a notification as read
router.put('/api/notifications/:id/read', authenticate, requireSchool, (req, res) => {
  try {
    const notification = db.prepare(
      'SELECT * FROM notifications WHERE id = ? AND user_id = ? AND school_id = ?'
    ).get(req.params.id, req.user.id, req.schoolId);

    if (!notification) return res.status(404).json({ error: 'Notification not found' });

    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND school_id = ?').run(req.params.id, req.schoolId);
    res.json({ message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications - Create a notification (requires notifications.send permission)
router.post('/api/notifications', authenticate, requireSchool, requirePermission('notifications.send'), (req, res) => {
  try {
    const { user_id, title, body, type } = req.body;

    if (!user_id || !title || !body) {
      return res.status(400).json({ error: 'user_id, title, and body are required' });
    }

    const user = db.prepare('SELECT id FROM users WHERE id = ? AND is_active = 1 AND school_id = ?').get(user_id, req.schoolId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const result = db.prepare(`
      INSERT INTO notifications (school_id, user_id, title, body, type)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.schoolId, user_id, title, body, type || 'general');

    const notification = db.prepare('SELECT * FROM notifications WHERE id = ? AND school_id = ?').get(result.lastInsertRowid, req.schoolId);
    res.status(201).json(notification);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/bulk - Send notification to multiple users (requires notifications.send permission)
router.post('/api/notifications/bulk', authenticate, requireSchool, requirePermission('notifications.send'), (req, res) => {
  try {
    const { user_ids, title, body, type } = req.body;

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return res.status(400).json({ error: 'user_ids array is required and must not be empty' });
    }
    if (!title || !body) {
      return res.status(400).json({ error: 'title and body are required' });
    }

    const insert = db.prepare(`
      INSERT INTO notifications (school_id, user_id, title, body, type)
      VALUES (?, ?, ?, ?, ?)
    `);

    const schoolId = req.schoolId;
    const sendMany = db.transaction((userIds) => {
      const created = [];
      for (const userId of userIds) {
        const user = db.prepare('SELECT id FROM users WHERE id = ? AND is_active = 1 AND school_id = ?').get(userId, schoolId);
        if (user) {
          const result = insert.run(schoolId, userId, title, body, type || 'general');
          created.push(result.lastInsertRowid);
        }
      }
      return created;
    });

    const createdIds = sendMany(user_ids);

    res.status(201).json({
      message: `Notifications sent to ${createdIds.length} users`,
      count: createdIds.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/notifications/:id - Delete a notification (own only)
router.delete('/api/notifications/:id', authenticate, requireSchool, (req, res) => {
  try {
    const notification = db.prepare(
      'SELECT * FROM notifications WHERE id = ? AND user_id = ? AND school_id = ?'
    ).get(req.params.id, req.user.id, req.schoolId);

    if (!notification) return res.status(404).json({ error: 'Notification not found' });

    db.prepare('DELETE FROM notifications WHERE id = ? AND school_id = ?').run(req.params.id, req.schoolId);
    res.json({ message: 'Notification deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
