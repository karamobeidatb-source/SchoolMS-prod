import { Router } from 'express';
import db from '../db/schema.js';
import { authenticate, requireSchool, requirePermission } from '../middleware/auth.js';

const router = Router();

// GET /api/assignments
router.get('/api/assignments', authenticate, requireSchool, requirePermission('assignments.view'), (req, res) => {
  try {
    const { subject_id, section_id, teacher_id, page = 1, limit = 25 } = req.query;
    const offset = (page - 1) * limit;
    let where = ['a.school_id = ?'];
    let params = [req.schoolId];

    if (subject_id) { where.push('a.subject_id = ?'); params.push(subject_id); }
    if (section_id) { where.push('a.section_id = ?'); params.push(section_id); }
    if (teacher_id) { where.push('a.teacher_id = ?'); params.push(teacher_id); }

    // Teachers see only their assignments
    if (req.user.role_key === 'teacher') {
      where.push('a.teacher_id = ?');
      params.push(req.user.id);
    }
    // Students see assignments for their section
    if (req.user.role_key === 'student') {
      const student = db.prepare('SELECT section_id FROM students WHERE user_id = ? AND school_id = ?').get(req.user.id, req.schoolId);
      if (student) {
        where.push('a.section_id = ?');
        params.push(student.section_id);
      }
    }
    // Parents see assignments for their children's sections
    if (req.user.role_key === 'parent') {
      where.push('a.section_id IN (SELECT section_id FROM students WHERE parent_id = ? AND school_id = ?)');
      params.push(req.user.id, req.schoolId);
    }

    const whereClause = where.join(' AND ');
    const total = db.prepare(`SELECT COUNT(*) as count FROM assignments a WHERE ${whereClause}`).get(...params).count;

    const assignments = db.prepare(`
      SELECT a.*, sub.name_en as subject_name_en, sub.name_ar as subject_name_ar,
             sec.name_en as section_name_en, gl.name_en as grade_name_en,
             u.first_name as teacher_first_name, u.last_name as teacher_last_name,
             (SELECT COUNT(*) FROM submissions WHERE assignment_id = a.id AND school_id = a.school_id) as submission_count
      FROM assignments a
      JOIN subjects sub ON a.subject_id = sub.id
      JOIN sections sec ON a.section_id = sec.id
      JOIN grade_levels gl ON sec.grade_level_id = gl.id
      JOIN users u ON a.teacher_id = u.id
      WHERE ${whereClause}
      ORDER BY a.due_date DESC
      LIMIT ? OFFSET ?
    `).all(...params, Number(limit), Number(offset));

    res.json({ assignments, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/assignments/:id
router.get('/api/assignments/:id', authenticate, requireSchool, requirePermission('assignments.view'), (req, res) => {
  try {
    const assignment = db.prepare(`
      SELECT a.*, sub.name_en as subject_name_en, sub.name_ar as subject_name_ar,
             sec.name_en as section_name_en, gl.name_en as grade_name_en,
             u.first_name as teacher_first_name, u.last_name as teacher_last_name
      FROM assignments a
      JOIN subjects sub ON a.subject_id = sub.id
      JOIN sections sec ON a.section_id = sec.id
      JOIN grade_levels gl ON sec.grade_level_id = gl.id
      JOIN users u ON a.teacher_id = u.id
      WHERE a.id = ? AND a.school_id = ?
    `).get(req.params.id, req.schoolId);

    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

    const submissions = db.prepare(`
      SELECT sub.*, s.first_name, s.last_name, s.student_number
      FROM submissions sub
      JOIN students s ON sub.student_id = s.id
      WHERE sub.assignment_id = ? AND sub.school_id = ?
      ORDER BY sub.submitted_at DESC
    `).all(req.params.id, req.schoolId);

    res.json({ ...assignment, submissions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/assignments
router.post('/api/assignments', authenticate, requireSchool, requirePermission('assignments.create'), (req, res) => {
  try {
    const { title, description, subject_id, section_id, due_date, max_score, attachment } = req.body;

    if (!title || !subject_id || !section_id || !due_date) {
      return res.status(400).json({ error: 'title, subject_id, section_id, and due_date are required' });
    }

    const result = db.prepare(`
      INSERT INTO assignments (school_id, title, description, subject_id, section_id, teacher_id, due_date, max_score, attachment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.schoolId, title, description, subject_id, section_id, req.user.id, due_date, max_score || 100, attachment);

    const assignment = db.prepare('SELECT * FROM assignments WHERE id = ? AND school_id = ?').get(result.lastInsertRowid, req.schoolId);
    res.status(201).json(assignment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/assignments/:id
router.put('/api/assignments/:id', authenticate, requireSchool, requirePermission('assignments.create'), (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM assignments WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!existing) return res.status(404).json({ error: 'Assignment not found' });

    const { title, description, due_date, max_score, attachment } = req.body;

    db.prepare(`
      UPDATE assignments SET
        title = COALESCE(?, title), description = COALESCE(?, description),
        due_date = COALESCE(?, due_date), max_score = COALESCE(?, max_score),
        attachment = COALESCE(?, attachment)
      WHERE id = ? AND school_id = ?
    `).run(title, description, due_date, max_score, attachment, req.params.id, req.schoolId);

    const assignment = db.prepare('SELECT * FROM assignments WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    res.json(assignment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/assignments/:id
router.delete('/api/assignments/:id', authenticate, requireSchool, requirePermission('assignments.create'), (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM assignments WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!existing) return res.status(404).json({ error: 'Assignment not found' });

    db.prepare('DELETE FROM submissions WHERE assignment_id = ? AND school_id = ?').run(req.params.id, req.schoolId);
    db.prepare('DELETE FROM assignments WHERE id = ? AND school_id = ?').run(req.params.id, req.schoolId);
    res.json({ message: 'Assignment deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/assignments/:id/submit
router.post('/api/assignments/:id/submit', authenticate, requireSchool, requirePermission('assignments.submit'), (req, res) => {
  try {
    const assignment = db.prepare('SELECT * FROM assignments WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

    const student = db.prepare('SELECT id FROM students WHERE user_id = ? AND school_id = ?').get(req.user.id, req.schoolId);
    if (!student) return res.status(400).json({ error: 'Student record not found' });

    const { content, attachment } = req.body;

    // Upsert submission
    const existing = db.prepare('SELECT id FROM submissions WHERE assignment_id = ? AND student_id = ? AND school_id = ?').get(req.params.id, student.id, req.schoolId);

    if (existing) {
      db.prepare(`
        UPDATE submissions SET content = ?, attachment = ?, submitted_at = datetime('now')
        WHERE id = ? AND school_id = ?
      `).run(content, attachment, existing.id, req.schoolId);
      const updated = db.prepare('SELECT * FROM submissions WHERE id = ? AND school_id = ?').get(existing.id, req.schoolId);
      return res.json(updated);
    }

    const result = db.prepare(`
      INSERT INTO submissions (school_id, assignment_id, student_id, content, attachment)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.schoolId, req.params.id, student.id, content, attachment);

    const submission = db.prepare('SELECT * FROM submissions WHERE id = ? AND school_id = ?').get(result.lastInsertRowid, req.schoolId);
    res.status(201).json(submission);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/submissions/:id/grade
router.put('/api/submissions/:id/grade', authenticate, requireSchool, requirePermission('assignments.grade'), (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM submissions WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!existing) return res.status(404).json({ error: 'Submission not found' });

    const { score, feedback } = req.body;

    db.prepare(`
      UPDATE submissions SET score = ?, feedback = ?, graded_at = datetime('now')
      WHERE id = ? AND school_id = ?
    `).run(score, feedback, req.params.id, req.schoolId);

    const submission = db.prepare(`
      SELECT sub.*, s.first_name, s.last_name, s.student_number
      FROM submissions sub
      JOIN students s ON sub.student_id = s.id
      WHERE sub.id = ? AND sub.school_id = ?
    `).get(req.params.id, req.schoolId);

    res.json(submission);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
