import { Router } from 'express';
import db from '../db/schema.js';
import { authenticate, requireSchool, requirePermission } from '../middleware/auth.js';

const router = Router();

// GET /api/reports/dashboard
router.get('/api/reports/dashboard', authenticate, requireSchool, requirePermission('dashboard.principal'), (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Today's attendance rate
    const totalStudents = db.prepare("SELECT COUNT(*) as count FROM students WHERE status = 'active' AND school_id = ?").get(req.schoolId).count;
    const presentToday = db.prepare(`
      SELECT COUNT(DISTINCT student_id) as count FROM attendance
      WHERE date = ? AND status IN ('present', 'late') AND school_id = ?
    `).get(today, req.schoolId).count;
    const absentToday = db.prepare(`
      SELECT COUNT(DISTINCT student_id) as count FROM attendance
      WHERE date = ? AND status = 'absent' AND school_id = ?
    `).get(today, req.schoolId).count;
    const attendanceRate = totalStudents > 0 ? Math.round((presentToday / totalStudents) * 100) : 0;

    // Staff attendance today
    const totalStaff = db.prepare(`
      SELECT COUNT(*) as count FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.is_active = 1 AND r.key NOT IN ('student', 'parent') AND u.school_id = ?
    `).get(req.schoolId).count;
    const staffPresentToday = db.prepare(`
      SELECT COUNT(*) as count FROM staff_attendance
      WHERE date = ? AND status IN ('present', 'late') AND school_id = ?
    `).get(today, req.schoolId).count;

    // Upcoming events (next 7 days)
    const upcomingEvents = db.prepare(`
      SELECT * FROM events
      WHERE start_date BETWEEN ? AND date(?, '+7 days') AND school_id = ?
      ORDER BY start_date LIMIT 5
    `).all(today, today, req.schoolId);

    // Pending leave requests
    const pendingLeaves = db.prepare(`
      SELECT COUNT(*) as count FROM leave_requests WHERE status = 'pending' AND school_id = ?
    `).get(req.schoolId).count;

    // Recent nurse log entries (today)
    const nurseAlerts = db.prepare(`
      SELECT nl.*, s.first_name, s.last_name
      FROM nurse_log nl
      JOIN students s ON nl.student_id = s.id
      WHERE date(nl.created_at) = ? AND nl.school_id = ?
      ORDER BY nl.created_at DESC LIMIT 5
    `).all(today, req.schoolId);

    // Enrollment counts
    const enrollmentByGrade = db.prepare(`
      SELECT gl.name_en, COUNT(s.id) as count
      FROM grade_levels gl
      LEFT JOIN students s ON s.grade_level_id = gl.id AND s.status = 'active' AND s.school_id = ?
      WHERE gl.school_id = ?
      GROUP BY gl.id ORDER BY gl.order_index
    `).all(req.schoolId, req.schoolId);

    // Unread messages for current user
    const unreadMessages = db.prepare(
      'SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND is_read = 0 AND school_id = ?'
    ).get(req.user.id, req.schoolId).count;

    // Chronic absentees count (>20% absence rate in last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const chronicAbsentees = db.prepare(`
      SELECT COUNT(*) as count FROM (
        SELECT a.student_id,
          CAST(SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) AS REAL) / COUNT(*) as absence_rate
        FROM attendance a
        JOIN students s ON a.student_id = s.id
        WHERE a.date >= ? AND s.status = 'active' AND a.period IS NULL
          AND a.school_id = ? AND s.school_id = ?
        GROUP BY a.student_id
        HAVING absence_rate > 0.2
      )
    `).get(thirtyDaysAgo, req.schoolId, req.schoolId).count;

    res.json({
      today,
      students: { total: totalStudents, presentToday, absentToday, attendanceRate },
      staff: { total: totalStaff, presentToday: staffPresentToday },
      upcomingEvents,
      pendingLeaves,
      nurseAlerts,
      enrollmentByGrade,
      unreadMessages,
      chronicAbsentees
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/academic
router.get('/api/reports/academic', authenticate, requireSchool, requirePermission('reports.academic'), (req, res) => {
  try {
    const { student_id, section_id, subject_id, academic_year, semester } = req.query;

    const settings = db.prepare("SELECT value FROM settings WHERE key = 'academic_year' AND school_id = ?").get(req.schoolId);
    const year = academic_year || settings?.value || '2025-2026';
    const sem = semester || db.prepare("SELECT value FROM settings WHERE key = 'current_semester' AND school_id = ?").get(req.schoolId)?.value || '1';

    if (student_id) {
      // Individual student report
      const grades = db.prepare(`
        SELECT g.*, sub.name_en as subject_name_en, sub.code as subject_code
        FROM grades g
        JOIN subjects sub ON g.subject_id = sub.id
        WHERE g.student_id = ? AND g.academic_year = ? AND g.semester = ? AND g.school_id = ?
        ORDER BY sub.name_en, g.category
      `).all(student_id, year, sem, req.schoolId);

      return res.json({ type: 'student', grades });
    }

    if (section_id) {
      // Section averages by subject
      const averages = db.prepare(`
        SELECT sub.name_en as subject_name_en, sub.code as subject_code,
          ROUND(AVG(g.score / g.max_score * 100), 1) as average_percent,
          COUNT(DISTINCT g.student_id) as student_count,
          MIN(g.score / g.max_score * 100) as min_percent,
          MAX(g.score / g.max_score * 100) as max_percent
        FROM grades g
        JOIN subjects sub ON g.subject_id = sub.id
        JOIN students s ON g.student_id = s.id
        WHERE s.section_id = ? AND g.academic_year = ? AND g.semester = ? AND g.school_id = ?
        GROUP BY g.subject_id
        ORDER BY sub.name_en
      `).all(section_id, year, sem, req.schoolId);

      return res.json({ type: 'section', averages });
    }

    // Overall school averages by subject
    const averages = db.prepare(`
      SELECT sub.name_en as subject_name_en, sub.code as subject_code,
        ROUND(AVG(g.score / g.max_score * 100), 1) as average_percent,
        COUNT(DISTINCT g.student_id) as student_count
      FROM grades g
      JOIN subjects sub ON g.subject_id = sub.id
      WHERE g.academic_year = ? AND g.semester = ? AND g.school_id = ?
      GROUP BY g.subject_id
      ORDER BY average_percent DESC
    `).all(year, sem, req.schoolId);

    res.json({ type: 'school', averages, academic_year: year, semester: sem });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/attendance
router.get('/api/reports/attendance', authenticate, requireSchool, requirePermission('reports.attendance'), (req, res) => {
  try {
    const { from_date, to_date, section_id, grade_level_id } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const fromDate = from_date || today;
    const toDate = to_date || today;

    // Daily attendance summary
    const daily = db.prepare(`
      SELECT a.date,
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present,
        COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent,
        COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late,
        COUNT(CASE WHEN a.status = 'excused' THEN 1 END) as excused,
        COUNT(*) as total
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      WHERE a.date BETWEEN ? AND ? AND a.school_id = ?
      ${section_id ? 'AND s.section_id = ?' : ''}
      ${grade_level_id ? 'AND s.grade_level_id = ?' : ''}
      GROUP BY a.date ORDER BY a.date
    `).all(fromDate, toDate, req.schoolId, ...(section_id ? [section_id] : []), ...(grade_level_id ? [grade_level_id] : []));

    // Students with most absences
    let absenceWhere = ['a.date BETWEEN ? AND ?', "a.status = 'absent'", 'a.school_id = ?'];
    let absenceParams = [fromDate, toDate, req.schoolId];
    if (section_id) { absenceWhere.push('s.section_id = ?'); absenceParams.push(section_id); }
    if (grade_level_id) { absenceWhere.push('s.grade_level_id = ?'); absenceParams.push(grade_level_id); }

    const mostAbsent = db.prepare(`
      SELECT s.id, s.first_name, s.last_name, s.student_number,
             gl.name_en as grade_name_en, sec.name_en as section_name_en,
             COUNT(*) as absence_count
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      LEFT JOIN grade_levels gl ON s.grade_level_id = gl.id
      LEFT JOIN sections sec ON s.section_id = sec.id
      WHERE ${absenceWhere.join(' AND ')}
      GROUP BY a.student_id
      ORDER BY absence_count DESC
      LIMIT 20
    `).all(...absenceParams);

    res.json({ daily, mostAbsent, fromDate, toDate });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/enrollment
router.get('/api/reports/enrollment', authenticate, requireSchool, requirePermission('reports.enrollment'), (req, res) => {
  try {
    const totalActive = db.prepare("SELECT COUNT(*) as count FROM students WHERE status = 'active' AND school_id = ?").get(req.schoolId).count;
    const totalAll = db.prepare("SELECT COUNT(*) as count FROM students WHERE school_id = ?").get(req.schoolId).count;

    const byGrade = db.prepare(`
      SELECT gl.id, gl.name_en, gl.name_ar,
        COUNT(CASE WHEN s.status = 'active' THEN 1 END) as active,
        COUNT(CASE WHEN s.status = 'inactive' THEN 1 END) as inactive,
        COUNT(CASE WHEN s.status = 'graduated' THEN 1 END) as graduated,
        COUNT(CASE WHEN s.status = 'transferred' THEN 1 END) as transferred,
        COUNT(CASE WHEN s.status = 'withdrawn' THEN 1 END) as withdrawn,
        COUNT(s.id) as total
      FROM grade_levels gl
      LEFT JOIN students s ON s.grade_level_id = gl.id AND s.school_id = ?
      WHERE gl.school_id = ?
      GROUP BY gl.id ORDER BY gl.order_index
    `).all(req.schoolId, req.schoolId);

    const bySection = db.prepare(`
      SELECT sec.id, sec.name_en as section_name_en, gl.name_en as grade_name_en,
             sec.capacity, COUNT(s.id) as enrolled
      FROM sections sec
      JOIN grade_levels gl ON sec.grade_level_id = gl.id
      LEFT JOIN students s ON s.section_id = sec.id AND s.status = 'active' AND s.school_id = ?
      WHERE sec.is_active = 1 AND sec.school_id = ?
      GROUP BY sec.id ORDER BY gl.order_index, sec.name_en
    `).all(req.schoolId, req.schoolId);

    const byGender = db.prepare(`
      SELECT gender, COUNT(*) as count FROM students WHERE status = 'active' AND school_id = ? GROUP BY gender
    `).all(req.schoolId);

    const byNationality = db.prepare(`
      SELECT nationality, COUNT(*) as count FROM students
      WHERE status = 'active' AND nationality IS NOT NULL AND school_id = ?
      GROUP BY nationality ORDER BY count DESC LIMIT 10
    `).all(req.schoolId);

    // Monthly enrollment trend (last 12 months)
    const trend = db.prepare(`
      SELECT strftime('%Y-%m', enrollment_date) as month, COUNT(*) as count
      FROM students
      WHERE enrollment_date >= date('now', '-12 months') AND school_id = ?
      GROUP BY month ORDER BY month
    `).all(req.schoolId);

    res.json({ totalActive, totalAll, byGrade, bySection, byGender, byNationality, trend });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/chronic-absenteeism - Students with high absence rate
router.get('/api/reports/chronic-absenteeism', authenticate, requireSchool, requirePermission('reports.attendance'), (req, res) => {
  try {
    const { threshold = 20, date_start, date_end } = req.query;
    const thresholdDecimal = Number(threshold) / 100;

    const today = new Date().toISOString().split('T')[0];
    const fromDate = date_start || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const toDate = date_end || today;

    const students = db.prepare(`
      SELECT s.id, s.first_name, s.last_name, s.student_number,
             gl.name_en as grade_name_en, sec.name_en as section_name_en,
             COUNT(*) as total_records,
             SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
             ROUND(CAST(SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100, 1) as absence_rate
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      LEFT JOIN grade_levels gl ON s.grade_level_id = gl.id
      LEFT JOIN sections sec ON s.section_id = sec.id
      WHERE a.date BETWEEN ? AND ? AND s.status = 'active' AND a.period IS NULL
        AND a.school_id = ? AND s.school_id = ?
      GROUP BY a.student_id
      HAVING CAST(SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) AS REAL) / COUNT(*) > ?
      ORDER BY absence_rate DESC
    `).all(fromDate, toDate, req.schoolId, req.schoolId, thresholdDecimal);

    res.json({ students, threshold: Number(threshold), fromDate, toDate });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/semester-comparison - Compare academic performance across semesters
router.get('/api/reports/semester-comparison', authenticate, requireSchool, requirePermission('reports.academic'), (req, res) => {
  try {
    const { academic_year, grade_level_id } = req.query;
    const settings = db.prepare("SELECT value FROM settings WHERE key = 'academic_year' AND school_id = ?").get(req.schoolId);
    const year = academic_year || settings?.value || '2025-2026';

    let where = ['g.academic_year = ?', 'g.school_id = ?'];
    let params = [year, req.schoolId];

    if (grade_level_id) {
      where.push('s.grade_level_id = ?');
      params.push(grade_level_id);
    }

    const comparison = db.prepare(`
      SELECT g.semester, sub.name_en as subject_name_en, sub.code as subject_code,
             ROUND(AVG(g.score / g.max_score * 100), 1) as average_percent,
             COUNT(DISTINCT g.student_id) as student_count,
             ROUND(MIN(g.score / g.max_score * 100), 1) as min_percent,
             ROUND(MAX(g.score / g.max_score * 100), 1) as max_percent
      FROM grades g
      JOIN subjects sub ON g.subject_id = sub.id
      JOIN students s ON g.student_id = s.id
      WHERE ${where.join(' AND ')}
      GROUP BY g.semester, g.subject_id
      ORDER BY sub.name_en, g.semester
    `).all(...params);

    // Group by subject for easy comparison
    const bySubject = {};
    for (const row of comparison) {
      if (!bySubject[row.subject_code]) {
        bySubject[row.subject_code] = { subject_name_en: row.subject_name_en, subject_code: row.subject_code, semesters: {} };
      }
      bySubject[row.subject_code].semesters[row.semester] = {
        average_percent: row.average_percent,
        student_count: row.student_count,
        min_percent: row.min_percent,
        max_percent: row.max_percent
      };
    }

    res.json({ academic_year: year, subjects: Object.values(bySubject) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
