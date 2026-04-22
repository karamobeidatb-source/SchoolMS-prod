import { Router } from 'express';
import db from '../db/schema.js';
import { authenticate, requireSchool, requirePermission } from '../middleware/auth.js';

const router = Router();

// GET /api/timetable/conflicts - before :id
router.get('/api/timetable/conflicts', authenticate, requireSchool, requirePermission('timetable.manage'), (req, res) => {
  try {
    const { academic_year, semester } = req.query;
    let where = ['t1.school_id = ?', 't2.school_id = ?'];
    let params = [req.schoolId, req.schoolId];
    if (academic_year) { where.push('t1.academic_year = ?'); params.push(academic_year); }
    if (semester) { where.push('t1.semester = ?'); params.push(semester); }

    // Teacher conflicts: same teacher, same day/period, different section
    const teacherConflicts = db.prepare(`
      SELECT t1.id as slot1_id, t2.id as slot2_id,
             t1.day_of_week, t1.period, u.first_name || ' ' || u.last_name as teacher_name,
             s1.name_en as section1, s2.name_en as section2,
             'teacher' as conflict_type
      FROM timetable t1
      JOIN timetable t2 ON t1.teacher_id = t2.teacher_id
        AND t1.day_of_week = t2.day_of_week AND t1.period = t2.period
        AND t1.id < t2.id
        AND t1.academic_year = t2.academic_year AND t1.semester = t2.semester
      JOIN users u ON t1.teacher_id = u.id
      JOIN sections s1 ON t1.section_id = s1.id
      JOIN sections s2 ON t2.section_id = s2.id
      WHERE ${where.join(' AND ')}
    `).all(...params);

    // Room conflicts: same room, same day/period
    const roomParams = [...params];
    const roomConflicts = db.prepare(`
      SELECT t1.id as slot1_id, t2.id as slot2_id,
             t1.day_of_week, t1.period, t1.room,
             s1.name_en as section1, s2.name_en as section2,
             'room' as conflict_type
      FROM timetable t1
      JOIN timetable t2 ON t1.room = t2.room
        AND t1.day_of_week = t2.day_of_week AND t1.period = t2.period
        AND t1.id < t2.id AND t1.room IS NOT NULL AND t1.room != ''
        AND t1.academic_year = t2.academic_year AND t1.semester = t2.semester
      JOIN sections s1 ON t1.section_id = s1.id
      JOIN sections s2 ON t2.section_id = s2.id
      WHERE ${where.join(' AND ')}
    `).all(...roomParams);

    res.json({ teacherConflicts, roomConflicts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/timetable/my
router.get('/api/timetable/my', authenticate, requireSchool, (req, res) => {
  try {
    const settings = db.prepare("SELECT value FROM settings WHERE key = 'academic_year' AND school_id = ?").get(req.schoolId);
    const semesterSetting = db.prepare("SELECT value FROM settings WHERE key = 'current_semester' AND school_id = ?").get(req.schoolId);
    const academic_year = settings?.value || '2025-2026';
    const semester = semesterSetting?.value || '1';

    let slots;
    if (req.user.role_key === 'teacher') {
      slots = db.prepare(`
        SELECT t.*, sub.name_en as subject_name_en, sub.name_ar as subject_name_ar,
               sec.name_en as section_name_en, sec.name_ar as section_name_ar,
               gl.name_en as grade_name_en
        FROM timetable t
        JOIN subjects sub ON t.subject_id = sub.id
        JOIN sections sec ON t.section_id = sec.id
        JOIN grade_levels gl ON sec.grade_level_id = gl.id
        WHERE t.teacher_id = ? AND t.academic_year = ? AND t.semester = ? AND t.school_id = ?
        ORDER BY t.day_of_week, t.period
      `).all(req.user.id, academic_year, semester, req.schoolId);
    } else if (req.user.role_key === 'student') {
      const student = db.prepare('SELECT section_id FROM students WHERE user_id = ? AND school_id = ?').get(req.user.id, req.schoolId);
      if (!student) return res.json([]);
      slots = db.prepare(`
        SELECT t.*, sub.name_en as subject_name_en, sub.name_ar as subject_name_ar,
               u.first_name as teacher_first_name, u.last_name as teacher_last_name
        FROM timetable t
        JOIN subjects sub ON t.subject_id = sub.id
        JOIN users u ON t.teacher_id = u.id
        WHERE t.section_id = ? AND t.academic_year = ? AND t.semester = ? AND t.school_id = ?
        ORDER BY t.day_of_week, t.period
      `).all(student.section_id, academic_year, semester, req.schoolId);
    } else {
      return res.json([]);
    }

    res.json(slots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/timetable
router.get('/api/timetable', authenticate, requireSchool, requirePermission('timetable.view'), (req, res) => {
  try {
    const { section_id, teacher_id, day_of_week, academic_year, semester } = req.query;
    let where = ['t.school_id = ?'];
    let params = [req.schoolId];

    if (section_id) { where.push('t.section_id = ?'); params.push(section_id); }
    if (teacher_id) { where.push('t.teacher_id = ?'); params.push(teacher_id); }
    if (day_of_week !== undefined) { where.push('t.day_of_week = ?'); params.push(day_of_week); }
    if (academic_year) { where.push('t.academic_year = ?'); params.push(academic_year); }
    if (semester) { where.push('t.semester = ?'); params.push(semester); }

    const slots = db.prepare(`
      SELECT t.*, sub.name_en as subject_name_en, sub.name_ar as subject_name_ar,
             sec.name_en as section_name_en, sec.name_ar as section_name_ar,
             gl.name_en as grade_name_en,
             u.first_name as teacher_first_name, u.last_name as teacher_last_name
      FROM timetable t
      JOIN subjects sub ON t.subject_id = sub.id
      JOIN sections sec ON t.section_id = sec.id
      JOIN grade_levels gl ON sec.grade_level_id = gl.id
      JOIN users u ON t.teacher_id = u.id
      WHERE ${where.join(' AND ')}
      ORDER BY t.day_of_week, t.period
    `).all(...params);

    res.json(slots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/timetable
router.post('/api/timetable', authenticate, requireSchool, requirePermission('timetable.manage'), (req, res) => {
  try {
    const { section_id, subject_id, teacher_id, day_of_week, period, start_time, end_time, room, academic_year, semester } = req.body;

    if (!section_id || !subject_id || !teacher_id || day_of_week === undefined || !period || !start_time || !end_time || !academic_year || !semester) {
      return res.status(400).json({ error: 'All fields are required: section_id, subject_id, teacher_id, day_of_week, period, start_time, end_time, academic_year, semester' });
    }

    const result = db.prepare(`
      INSERT INTO timetable (school_id, section_id, subject_id, teacher_id, day_of_week, period, start_time, end_time, room, academic_year, semester)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.schoolId, section_id, subject_id, teacher_id, day_of_week, period, start_time, end_time, room, academic_year, semester);

    const slot = db.prepare('SELECT * FROM timetable WHERE id = ? AND school_id = ?').get(result.lastInsertRowid, req.schoolId);
    res.status(201).json(slot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/timetable/:id
router.put('/api/timetable/:id', authenticate, requireSchool, requirePermission('timetable.manage'), (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM timetable WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!existing) return res.status(404).json({ error: 'Timetable slot not found' });

    const { section_id, subject_id, teacher_id, day_of_week, period, start_time, end_time, room } = req.body;

    db.prepare(`
      UPDATE timetable SET
        section_id = COALESCE(?, section_id), subject_id = COALESCE(?, subject_id),
        teacher_id = COALESCE(?, teacher_id), day_of_week = COALESCE(?, day_of_week),
        period = COALESCE(?, period), start_time = COALESCE(?, start_time),
        end_time = COALESCE(?, end_time), room = COALESCE(?, room)
      WHERE id = ? AND school_id = ?
    `).run(section_id, subject_id, teacher_id, day_of_week, period, start_time, end_time, room, req.params.id, req.schoolId);

    const slot = db.prepare('SELECT * FROM timetable WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    res.json(slot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/timetable/:id
router.delete('/api/timetable/:id', authenticate, requireSchool, requirePermission('timetable.manage'), (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM timetable WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!existing) return res.status(404).json({ error: 'Timetable slot not found' });

    db.prepare('DELETE FROM timetable WHERE id = ? AND school_id = ?').run(req.params.id, req.schoolId);
    res.json({ message: 'Timetable slot deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/timetable/publish - Set is_published=1 for a section's timetable
router.post('/api/timetable/publish', authenticate, requireSchool, requirePermission('timetable.manage'), (req, res) => {
  try {
    const { section_id, academic_year, semester } = req.body;
    if (!section_id || !academic_year || !semester) {
      return res.status(400).json({ error: 'section_id, academic_year, and semester are required' });
    }

    const result = db.prepare(`
      UPDATE timetable SET is_published = 1
      WHERE section_id = ? AND academic_year = ? AND semester = ? AND school_id = ?
    `).run(section_id, academic_year, semester, req.schoolId);

    res.json({ message: 'Timetable published', changes: result.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/exam-timetable - List exam timetable
router.get('/api/exam-timetable', authenticate, requireSchool, requirePermission('timetable.view'), (req, res) => {
  try {
    const { grade_level_id, academic_year, semester, exam_type } = req.query;
    let where = ['et.school_id = ?'];
    let params = [req.schoolId];

    if (grade_level_id) { where.push('et.grade_level_id = ?'); params.push(grade_level_id); }
    if (academic_year) { where.push('et.academic_year = ?'); params.push(academic_year); }
    if (semester) { where.push('et.semester = ?'); params.push(semester); }
    if (exam_type) { where.push('et.exam_type = ?'); params.push(exam_type); }

    const exams = db.prepare(`
      SELECT et.*, sub.name_en as subject_name_en, sub.name_ar as subject_name_ar,
             gl.name_en as grade_name_en, gl.name_ar as grade_name_ar,
             u.first_name as invigilator_first_name, u.last_name as invigilator_last_name
      FROM exam_timetable et
      JOIN subjects sub ON et.subject_id = sub.id
      JOIN grade_levels gl ON et.grade_level_id = gl.id
      LEFT JOIN users u ON et.invigilator_id = u.id
      WHERE ${where.join(' AND ')}
      ORDER BY et.exam_date, et.start_time
    `).all(...params);

    res.json(exams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/exam-timetable - Create exam timetable entry
router.post('/api/exam-timetable', authenticate, requireSchool, requirePermission('timetable.manage'), (req, res) => {
  try {
    const { subject_id, grade_level_id, exam_type, exam_date, start_time, end_time, room, academic_year, semester, invigilator_id } = req.body;

    if (!subject_id || !grade_level_id || !exam_type || !exam_date || !start_time || !end_time || !academic_year || !semester) {
      return res.status(400).json({ error: 'subject_id, grade_level_id, exam_type, exam_date, start_time, end_time, academic_year, and semester are required' });
    }

    const result = db.prepare(`
      INSERT INTO exam_timetable (school_id, subject_id, grade_level_id, exam_type, exam_date, start_time, end_time, room, academic_year, semester, invigilator_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.schoolId, subject_id, grade_level_id, exam_type, exam_date, start_time, end_time, room, academic_year, semester, invigilator_id || null);

    const exam = db.prepare('SELECT * FROM exam_timetable WHERE id = ? AND school_id = ?').get(result.lastInsertRowid, req.schoolId);
    res.status(201).json(exam);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/exam-timetable/:id - Update exam timetable entry
router.put('/api/exam-timetable/:id', authenticate, requireSchool, requirePermission('timetable.manage'), (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM exam_timetable WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!existing) return res.status(404).json({ error: 'Exam timetable entry not found' });

    const { subject_id, grade_level_id, exam_type, exam_date, start_time, end_time, room, invigilator_id } = req.body;

    db.prepare(`
      UPDATE exam_timetable SET
        subject_id = COALESCE(?, subject_id), grade_level_id = COALESCE(?, grade_level_id),
        exam_type = COALESCE(?, exam_type), exam_date = COALESCE(?, exam_date),
        start_time = COALESCE(?, start_time), end_time = COALESCE(?, end_time),
        room = COALESCE(?, room), invigilator_id = COALESCE(?, invigilator_id)
      WHERE id = ? AND school_id = ?
    `).run(subject_id, grade_level_id, exam_type, exam_date, start_time, end_time, room, invigilator_id, req.params.id, req.schoolId);

    const exam = db.prepare('SELECT * FROM exam_timetable WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    res.json(exam);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/exam-timetable/:id - Delete exam timetable entry
router.delete('/api/exam-timetable/:id', authenticate, requireSchool, requirePermission('timetable.manage'), (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM exam_timetable WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!existing) return res.status(404).json({ error: 'Exam timetable entry not found' });

    db.prepare('DELETE FROM exam_timetable WHERE id = ? AND school_id = ?').run(req.params.id, req.schoolId);
    res.json({ message: 'Exam timetable entry deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/substitute - Assign substitute teacher
router.post('/api/substitute', authenticate, requireSchool, requirePermission('timetable.manage'), (req, res) => {
  try {
    const { original_teacher_id, substitute_teacher_id, timetable_slot_id, date, reason } = req.body;

    if (!original_teacher_id || !substitute_teacher_id || !date) {
      return res.status(400).json({ error: 'original_teacher_id, substitute_teacher_id, and date are required' });
    }

    const result = db.prepare(`
      INSERT INTO substitute_assignments (school_id, original_teacher_id, substitute_teacher_id, timetable_slot_id, date, reason, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(req.schoolId, original_teacher_id, substitute_teacher_id, timetable_slot_id || null, date, reason, req.user.id);

    const assignment = db.prepare(`
      SELECT sa.*, o.first_name as original_first_name, o.last_name as original_last_name,
             s.first_name as substitute_first_name, s.last_name as substitute_last_name
      FROM substitute_assignments sa
      JOIN users o ON sa.original_teacher_id = o.id
      JOIN users s ON sa.substitute_teacher_id = s.id
      WHERE sa.id = ? AND sa.school_id = ?
    `).get(result.lastInsertRowid, req.schoolId);

    res.status(201).json(assignment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/substitutes - List substitute assignments
router.get('/api/substitutes', authenticate, requireSchool, requirePermission('timetable.view'), (req, res) => {
  try {
    const { date, original_teacher_id } = req.query;
    let where = ['sa.school_id = ?'];
    let params = [req.schoolId];

    if (date) { where.push('sa.date = ?'); params.push(date); }
    if (original_teacher_id) { where.push('sa.original_teacher_id = ?'); params.push(original_teacher_id); }

    const assignments = db.prepare(`
      SELECT sa.*, o.first_name as original_first_name, o.last_name as original_last_name,
             s.first_name as substitute_first_name, s.last_name as substitute_last_name,
             c.first_name as created_by_first_name, c.last_name as created_by_last_name
      FROM substitute_assignments sa
      JOIN users o ON sa.original_teacher_id = o.id
      JOIN users s ON sa.substitute_teacher_id = s.id
      JOIN users c ON sa.created_by = c.id
      WHERE ${where.join(' AND ')}
      ORDER BY sa.date DESC, sa.created_at DESC
    `).all(...params);

    res.json(assignments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
