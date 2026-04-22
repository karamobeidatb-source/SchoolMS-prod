import { Router } from 'express';
import db from '../db/schema.js';
import { authenticate, requireSchool, requirePermission } from '../middleware/auth.js';

const router = Router();

// GET /api/messages/users - search users for messaging (no special permission needed)
router.get('/api/messages/users', authenticate, requireSchool, (req, res) => {
  try {
    const { search } = req.query;
    if (!search || search.length < 2) return res.json([]);
    const users = db.prepare(`
      SELECT u.id, u.first_name, u.last_name, u.email, u.phone, r.label_en as role
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.is_active = 1 AND u.school_id = ? AND u.id != ? AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)
      LIMIT 20
    `).all(req.schoolId, req.user.id, `%${search}%`, `%${search}%`, `%${search}%`);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/messages/unread-count - before :id routes
router.get('/api/messages/unread-count', authenticate, requireSchool, (req, res) => {
  try {
    const count = db.prepare(
      'SELECT COUNT(*) as count FROM messages WHERE school_id = ? AND receiver_id = ? AND is_read = 0'
    ).get(req.schoolId, req.user.id).count;

    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/messages
router.get('/api/messages', authenticate, requireSchool, (req, res) => {
  try {
    const { folder = 'inbox', page = 1, limit = 25 } = req.query;
    const offset = (page - 1) * limit;

    let where, orderBy;
    if (folder === 'sent') {
      where = 'm.sender_id = ?';
    } else {
      where = 'm.receiver_id = ?';
    }

    const total = db.prepare(`SELECT COUNT(*) as count FROM messages m WHERE m.school_id = ? AND ${where}`).get(req.schoolId, req.user.id).count;

    const messages = db.prepare(`
      SELECT m.*,
             sender.first_name as sender_first_name, sender.last_name as sender_last_name, sender.avatar as sender_avatar,
             receiver.first_name as receiver_first_name, receiver.last_name as receiver_last_name,
             s.first_name as student_first_name, s.last_name as student_last_name
      FROM messages m
      JOIN users sender ON m.sender_id = sender.id
      JOIN users receiver ON m.receiver_id = receiver.id
      LEFT JOIN students s ON m.student_id = s.id
      WHERE m.school_id = ? AND ${where}
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `).all(req.schoolId, req.user.id, Number(limit), Number(offset));

    res.json({ messages, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/messages/conversation/:userId
router.get('/api/messages/conversation/:userId', authenticate, requireSchool, (req, res) => {
  try {
    const otherUserId = req.params.userId;
    const messages = db.prepare(`
      SELECT m.*,
             sender.first_name as sender_first_name, sender.last_name as sender_last_name, sender.avatar as sender_avatar
      FROM messages m
      JOIN users sender ON m.sender_id = sender.id
      WHERE m.school_id = ? AND ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?))
      ORDER BY m.created_at ASC
    `).all(req.schoolId, req.user.id, otherUserId, otherUserId, req.user.id);

    // Mark messages from other user as read
    db.prepare(`
      UPDATE messages SET is_read = 1
      WHERE school_id = ? AND sender_id = ? AND receiver_id = ? AND is_read = 0
    `).run(req.schoolId, otherUserId, req.user.id);

    // Get the other user's info
    const otherUser = db.prepare(`
      SELECT id, first_name, last_name, first_name_ar, last_name_ar, email, phone
      FROM users WHERE id = ? AND school_id = ?
    `).get(otherUserId, req.schoolId);

    res.json({ messages, otherUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/messages
router.post('/api/messages', authenticate, requireSchool, requirePermission('messages.send'), (req, res) => {
  try {
    const { receiver_id, student_id, subject, body, attachment } = req.body;

    if (!receiver_id || !body) {
      return res.status(400).json({ error: 'receiver_id and body are required' });
    }

    const receiver = db.prepare('SELECT id FROM users WHERE id = ? AND school_id = ? AND is_active = 1').get(receiver_id, req.schoolId);
    if (!receiver) return res.status(404).json({ error: 'Receiver not found' });

    const result = db.prepare(`
      INSERT INTO messages (school_id, sender_id, receiver_id, student_id, subject, body, attachment)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(req.schoolId, req.user.id, receiver_id, student_id || null, subject, body, attachment);

    const message = db.prepare(`
      SELECT m.*,
             sender.first_name as sender_first_name, sender.last_name as sender_last_name,
             receiver.first_name as receiver_first_name, receiver.last_name as receiver_last_name
      FROM messages m
      JOIN users sender ON m.sender_id = sender.id
      JOIN users receiver ON m.receiver_id = receiver.id
      WHERE m.id = ? AND m.school_id = ?
    `).get(result.lastInsertRowid, req.schoolId);

    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/messages/:id/read
router.put('/api/messages/:id/read', authenticate, requireSchool, (req, res) => {
  try {
    const message = db.prepare('SELECT * FROM messages WHERE id = ? AND school_id = ? AND receiver_id = ?').get(req.params.id, req.schoolId, req.user.id);
    if (!message) return res.status(404).json({ error: 'Message not found' });

    db.prepare('UPDATE messages SET is_read = 1 WHERE id = ? AND school_id = ?').run(req.params.id, req.schoolId);
    res.json({ message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/messages/:id - Delete a message (own messages only)
router.delete('/api/messages/:id', authenticate, requireSchool, (req, res) => {
  try {
    const message = db.prepare(
      'SELECT * FROM messages WHERE id = ? AND school_id = ? AND (sender_id = ? OR receiver_id = ?)'
    ).get(req.params.id, req.schoolId, req.user.id, req.user.id);
    if (!message) return res.status(404).json({ error: 'Message not found' });

    db.prepare('DELETE FROM messages WHERE id = ? AND school_id = ?').run(req.params.id, req.schoolId);
    res.json({ message: 'Message deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/messages/all - Admin endpoint to view all messages
router.get('/api/messages/all', authenticate, requireSchool, requirePermission('messages.view_all'), (req, res) => {
  try {
    const { page = 1, limit = 25, sender_id, receiver_id } = req.query;
    const offset = (page - 1) * limit;
    let where = ['m.school_id = ?'];
    let params = [req.schoolId];

    if (sender_id) { where.push('m.sender_id = ?'); params.push(sender_id); }
    if (receiver_id) { where.push('m.receiver_id = ?'); params.push(receiver_id); }

    const whereClause = where.join(' AND ');
    const total = db.prepare(`SELECT COUNT(*) as count FROM messages m WHERE ${whereClause}`).get(...params).count;

    const messages = db.prepare(`
      SELECT m.*,
             sender.first_name as sender_first_name, sender.last_name as sender_last_name,
             receiver.first_name as receiver_first_name, receiver.last_name as receiver_last_name,
             s.first_name as student_first_name, s.last_name as student_last_name
      FROM messages m
      JOIN users sender ON m.sender_id = sender.id
      JOIN users receiver ON m.receiver_id = receiver.id
      LEFT JOIN students s ON m.student_id = s.id
      WHERE ${whereClause}
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, Number(limit), Number(offset));

    res.json({ messages, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/teacher-availability/:teacherId - Get teacher availability hours
router.get('/api/teacher-availability/:teacherId', authenticate, requireSchool, (req, res) => {
  try {
    const availability = db.prepare('SELECT * FROM teacher_availability WHERE teacher_id = ? AND school_id = ?').get(req.params.teacherId, req.schoolId);
    if (!availability) {
      return res.json({ teacher_id: Number(req.params.teacherId), available_from: '08:00', available_until: '20:00' });
    }
    res.json(availability);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/teacher-availability - Update own availability hours
router.put('/api/teacher-availability', authenticate, requireSchool, (req, res) => {
  try {
    const { available_from, available_until } = req.body;
    if (!available_from || !available_until) {
      return res.status(400).json({ error: 'available_from and available_until are required' });
    }

    const existing = db.prepare('SELECT id FROM teacher_availability WHERE teacher_id = ? AND school_id = ?').get(req.user.id, req.schoolId);

    if (existing) {
      db.prepare('UPDATE teacher_availability SET available_from = ?, available_until = ? WHERE id = ? AND school_id = ?')
        .run(available_from, available_until, existing.id, req.schoolId);
    } else {
      db.prepare('INSERT INTO teacher_availability (school_id, teacher_id, available_from, available_until) VALUES (?, ?, ?, ?)')
        .run(req.schoolId, req.user.id, available_from, available_until);
    }

    const result = db.prepare('SELECT * FROM teacher_availability WHERE teacher_id = ? AND school_id = ?').get(req.user.id, req.schoolId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
