import { Router } from 'express';
import db from '../db/schema.js';
import { authenticate, requireSchool, requirePermission } from '../middleware/auth.js';
import { generateReportCardPDF } from '../utils/pdfGenerator.js';

const router = Router();

// GET /api/grades
router.get('/api/grades', authenticate, requireSchool, requirePermission('grades.view'), (req, res) => {
  try {
    const { student_id, subject_id, semester, academic_year, section_id, category } = req.query;
    let where = ['g.school_id = ?'];
    let params = [req.schoolId];

    if (student_id) { where.push('g.student_id = ?'); params.push(student_id); }
    if (subject_id) { where.push('g.subject_id = ?'); params.push(subject_id); }
    if (semester) { where.push('g.semester = ?'); params.push(semester); }
    if (academic_year) { where.push('g.academic_year = ?'); params.push(academic_year); }
    if (category) { where.push('g.category = ?'); params.push(category); }
    if (section_id) {
      where.push('s.section_id = ?');
      params.push(section_id);
    }

    // Parents can only see their children's grades
    if (req.user.role_key === 'parent') {
      where.push('s.parent_id = ?');
      params.push(req.user.id);
    }
    // Students can only see their own grades
    if (req.user.role_key === 'student') {
      where.push('s.user_id = ?');
      params.push(req.user.id);
    }

    const whereClause = where.join(' AND ');
    const grades = db.prepare(`
      SELECT g.*, s.first_name as student_first_name, s.last_name as student_last_name,
             s.student_number, sub.name_en as subject_name_en, sub.name_ar as subject_name_ar
      FROM grades g
      JOIN students s ON g.student_id = s.id
      JOIN subjects sub ON g.subject_id = sub.id
      WHERE ${whereClause}
      ORDER BY g.created_at DESC
    `).all(...params);

    res.json(grades);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/grades  (upsert by school+student+subject+year+semester+category+title)
router.post('/api/grades', authenticate, requireSchool, requirePermission('grades.manage'), (req, res) => {
  try {
    const { student_id, subject_id, academic_year, semester, category, score, max_score, title, notes } = req.body;

    if (!student_id || !subject_id || !academic_year || !semester || !category) {
      return res.status(400).json({ error: 'student_id, subject_id, academic_year, semester, and category are required' });
    }

    const existing = db.prepare(`
      SELECT id, is_locked FROM grades
      WHERE school_id = ? AND student_id = ? AND subject_id = ?
        AND academic_year = ? AND semester = ? AND category = ?
        AND COALESCE(title, '') = COALESCE(?, '')
      LIMIT 1
    `).get(req.schoolId, student_id, subject_id, academic_year, semester, category, title || null);

    if (existing) {
      if (existing.is_locked) return res.status(400).json({ error: 'Grade is locked and cannot be modified' });
      db.prepare(`
        UPDATE grades SET score = ?, max_score = ?, notes = COALESCE(?, notes)
        WHERE id = ? AND school_id = ?
      `).run(score, max_score || 100, notes, existing.id, req.schoolId);
      const updated = db.prepare('SELECT * FROM grades WHERE id = ? AND school_id = ?').get(existing.id, req.schoolId);
      return res.json(updated);
    }

    const result = db.prepare(`
      INSERT INTO grades (school_id, student_id, subject_id, academic_year, semester, category, score, max_score, title, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.schoolId, student_id, subject_id, academic_year, semester, category, score, max_score || 100, title, notes, req.user.id);

    const grade = db.prepare('SELECT * FROM grades WHERE id = ? AND school_id = ?').get(result.lastInsertRowid, req.schoolId);
    res.status(201).json(grade);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/grades/:id
router.put('/api/grades/:id', authenticate, requireSchool, requirePermission('grades.manage'), (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM grades WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!existing) return res.status(404).json({ error: 'Grade not found' });
    if (existing.is_locked) return res.status(400).json({ error: 'Grade is locked and cannot be modified' });

    const { score, max_score, title, notes } = req.body;

    db.prepare(`
      UPDATE grades SET score = COALESCE(?, score), max_score = COALESCE(?, max_score),
        title = COALESCE(?, title), notes = COALESCE(?, notes)
      WHERE id = ? AND school_id = ?
    `).run(score, max_score, title, notes, req.params.id, req.schoolId);

    const grade = db.prepare('SELECT * FROM grades WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    res.json(grade);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/grades/lock
router.post('/api/grades/lock', authenticate, requireSchool, requirePermission('grades.manage'), (req, res) => {
  try {
    const { subject_id, semester, academic_year, section_id } = req.body;
    if (!subject_id || !semester || !academic_year) {
      return res.status(400).json({ error: 'subject_id, semester, and academic_year are required' });
    }

    let query = `UPDATE grades SET is_locked = 1 WHERE school_id = ? AND subject_id = ? AND semester = ? AND academic_year = ?`;
    let params = [req.schoolId, subject_id, semester, academic_year];

    if (section_id) {
      query += ` AND student_id IN (SELECT id FROM students WHERE section_id = ? AND school_id = ?)`;
      params.push(section_id, req.schoolId);
    }

    const result = db.prepare(query).run(...params);
    res.json({ message: 'Grades locked', changes: result.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/grades/unlock
router.post('/api/grades/unlock', authenticate, requireSchool, requirePermission('grades.manage'), (req, res) => {
  try {
    const { subject_id, semester, academic_year, section_id } = req.body;
    if (!subject_id || !semester || !academic_year) {
      return res.status(400).json({ error: 'subject_id, semester, and academic_year are required' });
    }

    let query = `UPDATE grades SET is_locked = 0 WHERE school_id = ? AND subject_id = ? AND semester = ? AND academic_year = ? AND approved_by IS NULL`;
    let params = [req.schoolId, subject_id, semester, academic_year];

    if (section_id) {
      query += ` AND student_id IN (SELECT id FROM students WHERE section_id = ? AND school_id = ?)`;
      params.push(section_id, req.schoolId);
    }

    const result = db.prepare(query).run(...params);
    res.json({ message: 'Grades unlocked', changes: result.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/grades/approve
router.post('/api/grades/approve', authenticate, requireSchool, requirePermission('grades.approve'), (req, res) => {
  try {
    const { subject_id, semester, academic_year, section_id } = req.body;
    if (!subject_id || !semester || !academic_year) {
      return res.status(400).json({ error: 'subject_id, semester, and academic_year are required' });
    }

    let query = `UPDATE grades SET approved_by = ?, is_locked = 1 WHERE school_id = ? AND subject_id = ? AND semester = ? AND academic_year = ?`;
    let params = [req.user.id, req.schoolId, subject_id, semester, academic_year];

    if (section_id) {
      query += ` AND student_id IN (SELECT id FROM students WHERE section_id = ? AND school_id = ?)`;
      params.push(section_id, req.schoolId);
    }

    const result = db.prepare(query).run(...params);
    res.json({ message: 'Grades approved', changes: result.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/grades/report/:studentId
router.get('/api/grades/report/:studentId', authenticate, requireSchool, requirePermission('report_cards.view'), (req, res) => {
  try {
    const { academic_year, semester } = req.query;
    const student = db.prepare(`
      SELECT s.*, gl.name_en as grade_name_en, gl.name_ar as grade_name_ar,
             sec.name_en as section_name_en, sec.name_ar as section_name_ar
      FROM students s
      LEFT JOIN grade_levels gl ON s.grade_level_id = gl.id
      LEFT JOIN sections sec ON s.section_id = sec.id
      WHERE s.id = ? AND s.school_id = ?
    `).get(req.params.studentId, req.schoolId);

    if (!student) return res.status(404).json({ error: 'Student not found' });

    let where = 'g.student_id = ? AND g.school_id = ?';
    let params = [req.params.studentId, req.schoolId];
    if (academic_year) { where += ' AND g.academic_year = ?'; params.push(academic_year); }
    if (semester) { where += ' AND g.semester = ?'; params.push(semester); }

    const grades = db.prepare(`
      SELECT g.*, sub.name_en as subject_name_en, sub.name_ar as subject_name_ar, sub.code as subject_code
      FROM grades g
      JOIN subjects sub ON g.subject_id = sub.id
      WHERE ${where}
      ORDER BY sub.name_en, g.category
    `).all(...params);

    // Group grades by subject
    const bySubject = {};
    for (const g of grades) {
      if (!bySubject[g.subject_id]) {
        bySubject[g.subject_id] = {
          subject_id: g.subject_id,
          subject_name_en: g.subject_name_en,
          subject_name_ar: g.subject_name_ar,
          subject_code: g.subject_code,
          grades: []
        };
      }
      bySubject[g.subject_id].grades.push(g);
    }

    // Get grading weights
    let weightWhere = 'school_id = ? AND academic_year = ?';
    let weightParams = academic_year ? [req.schoolId, academic_year] : [req.schoolId, '2025-2026'];
    if (semester) { weightWhere += ' AND semester = ?'; weightParams.push(semester); }

    const weights = db.prepare(`SELECT * FROM grading_weights WHERE ${weightWhere}`).all(...weightParams);

    // Get comments
    let commentWhere = 'rc.student_id = ? AND rc.school_id = ?';
    let commentParams = [req.params.studentId, req.schoolId];
    if (academic_year) { commentWhere += ' AND rc.academic_year = ?'; commentParams.push(academic_year); }
    if (semester) { commentWhere += ' AND rc.semester = ?'; commentParams.push(semester); }

    const comments = db.prepare(`
      SELECT rc.*, sub.name_en as subject_name_en, u.first_name as teacher_first_name, u.last_name as teacher_last_name
      FROM report_comments rc
      JOIN subjects sub ON rc.subject_id = sub.id
      JOIN users u ON rc.teacher_id = u.id
      WHERE ${commentWhere}
    `).all(...commentParams);

    res.json({ student, subjects: Object.values(bySubject), weights, comments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/grading-weights
router.get('/api/grading-weights', authenticate, requireSchool, requirePermission('grades.view'), (req, res) => {
  try {
    const { subject_id, grade_level_id, academic_year, semester } = req.query;
    let where = ['school_id = ?'];
    let params = [req.schoolId];
    if (subject_id) { where.push('subject_id = ?'); params.push(subject_id); }
    if (grade_level_id) { where.push('grade_level_id = ?'); params.push(grade_level_id); }
    if (academic_year) { where.push('academic_year = ?'); params.push(academic_year); }
    if (semester) { where.push('semester = ?'); params.push(semester); }

    const weights = db.prepare(`SELECT * FROM grading_weights WHERE ${where.join(' AND ')}`).all(...params);
    res.json(weights);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/grading-weights
router.post('/api/grading-weights', authenticate, requireSchool, requirePermission('grades.manage'), (req, res) => {
  try {
    const { subject_id, grade_level_id, academic_year, semester, quizzes_weight, homework_weight, participation_weight, midterm_weight, final_weight, projects_weight } = req.body;

    if (!academic_year || !semester) {
      return res.status(400).json({ error: 'academic_year and semester are required' });
    }

    // Upsert - check if exists (scoped to current school)
    const existing = db.prepare(`
      SELECT id FROM grading_weights
      WHERE school_id = ?
        AND COALESCE(subject_id, 0) = COALESCE(?, 0)
        AND COALESCE(grade_level_id, 0) = COALESCE(?, 0)
        AND academic_year = ? AND semester = ?
    `).get(req.schoolId, subject_id || null, grade_level_id || null, academic_year, semester);

    if (existing) {
      db.prepare(`
        UPDATE grading_weights SET quizzes_weight = ?, homework_weight = ?, participation_weight = ?,
          midterm_weight = ?, final_weight = ?, projects_weight = ?
        WHERE id = ? AND school_id = ?
      `).run(quizzes_weight || 10, homework_weight || 10, participation_weight || 10, midterm_weight || 30, final_weight || 40, projects_weight || 0, existing.id, req.schoolId);
      const updated = db.prepare('SELECT * FROM grading_weights WHERE id = ? AND school_id = ?').get(existing.id, req.schoolId);
      return res.json(updated);
    }

    const result = db.prepare(`
      INSERT INTO grading_weights (school_id, subject_id, grade_level_id, academic_year, semester, quizzes_weight, homework_weight, participation_weight, midterm_weight, final_weight, projects_weight)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.schoolId, subject_id || null, grade_level_id || null, academic_year, semester, quizzes_weight || 10, homework_weight || 10, participation_weight || 10, midterm_weight || 30, final_weight || 40, projects_weight || 0);

    const weight = db.prepare('SELECT * FROM grading_weights WHERE id = ? AND school_id = ?').get(result.lastInsertRowid, req.schoolId);
    res.status(201).json(weight);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/report-comments/:studentId
router.get('/api/report-comments/:studentId', authenticate, requireSchool, requirePermission('report_cards.view'), (req, res) => {
  try {
    const { academic_year, semester } = req.query;
    let where = ['rc.student_id = ?', 'rc.school_id = ?'];
    let params = [req.params.studentId, req.schoolId];
    if (academic_year) { where.push('rc.academic_year = ?'); params.push(academic_year); }
    if (semester) { where.push('rc.semester = ?'); params.push(semester); }

    const comments = db.prepare(`
      SELECT rc.*, sub.name_en as subject_name_en, sub.name_ar as subject_name_ar,
             u.first_name as teacher_first_name, u.last_name as teacher_last_name
      FROM report_comments rc
      JOIN subjects sub ON rc.subject_id = sub.id
      JOIN users u ON rc.teacher_id = u.id
      WHERE ${where.join(' AND ')}
    `).all(...params);

    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/report-comments
router.post('/api/report-comments', authenticate, requireSchool, requirePermission('grades.manage'), (req, res) => {
  try {
    const { student_id, subject_id, academic_year, semester, comment_en, comment_ar } = req.body;

    if (!student_id || !subject_id || !academic_year || !semester) {
      return res.status(400).json({ error: 'student_id, subject_id, academic_year, and semester are required' });
    }

    // Upsert (scoped to current school)
    const existing = db.prepare(`
      SELECT id FROM report_comments
      WHERE school_id = ? AND student_id = ? AND subject_id = ? AND academic_year = ? AND semester = ?
    `).get(req.schoolId, student_id, subject_id, academic_year, semester);

    if (existing) {
      db.prepare(`
        UPDATE report_comments SET comment_en = ?, comment_ar = ?, teacher_id = ?, created_at = datetime('now')
        WHERE id = ? AND school_id = ?
      `).run(comment_en, comment_ar, req.user.id, existing.id, req.schoolId);
      const updated = db.prepare('SELECT * FROM report_comments WHERE id = ? AND school_id = ?').get(existing.id, req.schoolId);
      return res.json(updated);
    }

    const result = db.prepare(`
      INSERT INTO report_comments (school_id, student_id, subject_id, academic_year, semester, comment_en, comment_ar, teacher_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.schoolId, student_id, subject_id, academic_year, semester, comment_en, comment_ar, req.user.id);

    const comment = db.prepare('SELECT * FROM report_comments WHERE id = ? AND school_id = ?').get(result.lastInsertRowid, req.schoolId);
    res.status(201).json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/grades/trends/:studentId - Grade averages per subject per semester for trend charts
router.get('/api/grades/trends/:studentId', authenticate, requireSchool, requirePermission('grades.view'), (req, res) => {
  try {
    const { academic_year } = req.query;
    let where = ['g.student_id = ?', 'g.school_id = ?'];
    let params = [req.params.studentId, req.schoolId];
    if (academic_year) { where.push('g.academic_year = ?'); params.push(academic_year); }

    // If parent, verify they can see this student
    if (req.user.role_key === 'parent') {
      const student = db.prepare('SELECT id FROM students WHERE id = ? AND parent_id = ? AND school_id = ?').get(req.params.studentId, req.user.id, req.schoolId);
      if (!student) return res.status(403).json({ error: 'Access denied' });
    }

    const trends = db.prepare(`
      SELECT g.academic_year, g.semester, g.subject_id,
             sub.name_en as subject_name_en, sub.name_ar as subject_name_ar,
             ROUND(AVG(g.score / g.max_score * 100), 1) as average_percent,
             COUNT(*) as grade_count
      FROM grades g
      JOIN subjects sub ON g.subject_id = sub.id
      WHERE ${where.join(' AND ')}
      GROUP BY g.academic_year, g.semester, g.subject_id
      ORDER BY g.academic_year, g.semester, sub.name_en
    `).all(...params);

    res.json(trends);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/grades/completion-rate - Assignment completion rate per section
router.get('/api/grades/completion-rate', authenticate, requireSchool, requirePermission('grades.view'), (req, res) => {
  try {
    const { section_id } = req.query;
    if (!section_id) return res.status(400).json({ error: 'section_id is required' });

    const totalStudents = db.prepare(
      "SELECT COUNT(*) as count FROM students WHERE section_id = ? AND status = 'active' AND school_id = ?"
    ).get(section_id, req.schoolId).count;

    const assignments = db.prepare(`
      SELECT a.id, a.title, a.due_date, a.subject_id,
             sub.name_en as subject_name_en,
             (SELECT COUNT(*) FROM submissions WHERE assignment_id = a.id AND school_id = ?) as submissions_count
      FROM assignments a
      JOIN subjects sub ON a.subject_id = sub.id
      WHERE a.section_id = ? AND a.school_id = ?
      ORDER BY a.due_date DESC
    `).all(req.schoolId, section_id, req.schoolId);

    const result = assignments.map(a => ({
      ...a,
      total_students: totalStudents,
      completion_rate: totalStudents > 0 ? Math.round((a.submissions_count / totalStudents) * 100) : 0
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/grades/report/:studentId/pdf - Generate PDF report card
router.get('/api/grades/report/:studentId/pdf', authenticate, requireSchool, requirePermission('report_cards.view'), (req, res) => {
  try {
    const { academic_year, semester } = req.query;
    const student = db.prepare(`
      SELECT s.*, gl.name_en as grade_name_en, gl.name_ar as grade_name_ar,
             sec.name_en as section_name_en, sec.name_ar as section_name_ar
      FROM students s
      LEFT JOIN grade_levels gl ON s.grade_level_id = gl.id
      LEFT JOIN sections sec ON s.section_id = sec.id
      WHERE s.id = ? AND s.school_id = ?
    `).get(req.params.studentId, req.schoolId);

    if (!student) return res.status(404).json({ error: 'Student not found' });

    let where = 'g.student_id = ? AND g.school_id = ?';
    let params = [req.params.studentId, req.schoolId];
    if (academic_year) { where += ' AND g.academic_year = ?'; params.push(academic_year); }
    if (semester) { where += ' AND g.semester = ?'; params.push(semester); }

    const grades = db.prepare(`
      SELECT g.*, sub.name_en as subject_name_en, sub.name_ar as subject_name_ar, sub.code as subject_code
      FROM grades g
      JOIN subjects sub ON g.subject_id = sub.id
      WHERE ${where}
      ORDER BY sub.name_en, g.category
    `).all(...params);

    const bySubject = {};
    for (const g of grades) {
      if (!bySubject[g.subject_id]) {
        bySubject[g.subject_id] = {
          subject_id: g.subject_id,
          subject_name_en: g.subject_name_en,
          subject_name_ar: g.subject_name_ar,
          subject_code: g.subject_code,
          grades: []
        };
      }
      bySubject[g.subject_id].grades.push(g);
    }

    let weightWhere = 'school_id = ? AND academic_year = ?';
    let weightParams = academic_year ? [req.schoolId, academic_year] : [req.schoolId, '2025-2026'];
    if (semester) { weightWhere += ' AND semester = ?'; weightParams.push(semester); }
    const weights = db.prepare(`SELECT * FROM grading_weights WHERE ${weightWhere}`).all(...weightParams);

    let commentWhere = 'rc.student_id = ? AND rc.school_id = ?';
    let commentParams = [req.params.studentId, req.schoolId];
    if (academic_year) { commentWhere += ' AND rc.academic_year = ?'; commentParams.push(academic_year); }
    if (semester) { commentWhere += ' AND rc.semester = ?'; commentParams.push(semester); }

    const comments = db.prepare(`
      SELECT rc.*, sub.name_en as subject_name_en, u.first_name as teacher_first_name, u.last_name as teacher_last_name
      FROM report_comments rc
      JOIN subjects sub ON rc.subject_id = sub.id
      JOIN users u ON rc.teacher_id = u.id
      WHERE ${commentWhere}
    `).all(...commentParams);

    generateReportCardPDF({ student, subjects: Object.values(bySubject), weights, comments }, res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
