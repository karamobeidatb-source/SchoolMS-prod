import { Router } from 'express';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { unlinkSync, existsSync } from 'fs';
import db from '../db/schema.js';
import { authenticate, requireSchool, requirePermission } from '../middleware/auth.js';
import { generateStudentIdCardPDF } from '../utils/pdfGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const docStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, join(__dirname, '..', 'uploads', 'documents')),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const uploadDoc = multer({ storage: docStorage, limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

// GET /api/students/stats/overview - must be before :id route
router.get('/api/students/stats/overview', authenticate, requireSchool, requirePermission('students.view'), (req, res) => {
  try {
    const total = db.prepare("SELECT COUNT(*) as count FROM students WHERE status = 'active' AND school_id = ?").get(req.schoolId).count;
    const byGrade = db.prepare(`
      SELECT gl.name_en, gl.name_ar, gl.id as grade_level_id, COUNT(s.id) as count
      FROM grade_levels gl
      LEFT JOIN students s ON s.grade_level_id = gl.id AND s.status = 'active' AND s.school_id = ?
      WHERE gl.school_id = ?
      GROUP BY gl.id ORDER BY gl.order_index
    `).all(req.schoolId, req.schoolId);
    const byGender = db.prepare(`
      SELECT gender, COUNT(*) as count FROM students WHERE status = 'active' AND school_id = ? GROUP BY gender
    `).all(req.schoolId);
    const byStatus = db.prepare(`
      SELECT status, COUNT(*) as count FROM students WHERE school_id = ? GROUP BY status
    `).all(req.schoolId);
    const newThisMonth = db.prepare(`
      SELECT COUNT(*) as count FROM students
      WHERE enrollment_date >= date('now', 'start of month') AND school_id = ?
    `).get(req.schoolId).count;

    res.json({ total, byGrade, byGender, byStatus, newThisMonth });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/students/alumni - must be before :id route
router.get('/api/students/alumni', authenticate, requireSchool, requirePermission('students.view'), (req, res) => {
  try {
    const { search, grade_level_id, page = 1, limit = 25 } = req.query;
    const offset = (page - 1) * limit;
    let where = ["s.status IN ('graduated','transferred')", 's.school_id = ?'];
    let params = [req.schoolId];

    if (search) {
      where.push(`(s.first_name LIKE ? OR s.last_name LIKE ? OR s.student_number LIKE ?)`);
      const term = `%${search}%`;
      params.push(term, term, term);
    }
    if (grade_level_id) { where.push('s.grade_level_id = ?'); params.push(grade_level_id); }

    const whereClause = where.join(' AND ');
    const total = db.prepare(`SELECT COUNT(*) as count FROM students s WHERE ${whereClause}`).get(...params).count;
    const students = db.prepare(`
      SELECT s.*, gl.name_en as grade_name_en, gl.name_ar as grade_name_ar,
             sec.name_en as section_name_en, sec.name_ar as section_name_ar
      FROM students s
      LEFT JOIN grade_levels gl ON s.grade_level_id = gl.id
      LEFT JOIN sections sec ON s.section_id = sec.id
      WHERE ${whereClause}
      ORDER BY s.last_name, s.first_name
      LIMIT ? OFFSET ?
    `).all(...params, Number(limit), Number(offset));

    res.json({ students, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/students
router.get('/api/students', authenticate, requireSchool, requirePermission('students.view'), (req, res) => {
  try {
    const { search, grade_level_id, section_id, status, page = 1, limit = 25 } = req.query;
    const offset = (page - 1) * limit;
    let where = ['s.school_id = ?'];
    let params = [req.schoolId];

    if (search) {
      where.push(`(s.first_name LIKE ? OR s.last_name LIKE ? OR s.student_number LIKE ? OR s.first_name_ar LIKE ? OR s.last_name_ar LIKE ?)`);
      const term = `%${search}%`;
      params.push(term, term, term, term, term);
    }
    if (grade_level_id) { where.push('s.grade_level_id = ?'); params.push(grade_level_id); }
    if (section_id) { where.push('s.section_id = ?'); params.push(section_id); }
    if (status) { where.push('s.status = ?'); params.push(status); }
    else { where.push("s.status != 'withdrawn'"); }

    // If parent, only show their children
    if (req.user.role_key === 'parent') {
      where.push('s.parent_id = ?');
      params.push(req.user.id);
    }

    const whereClause = where.join(' AND ');
    const total = db.prepare(`SELECT COUNT(*) as count FROM students s WHERE ${whereClause}`).get(...params).count;
    const students = db.prepare(`
      SELECT s.*, gl.name_en as grade_name_en, gl.name_ar as grade_name_ar,
             sec.name_en as section_name_en, sec.name_ar as section_name_ar
      FROM students s
      LEFT JOIN grade_levels gl ON s.grade_level_id = gl.id
      LEFT JOIN sections sec ON s.section_id = sec.id
      WHERE ${whereClause}
      ORDER BY s.last_name, s.first_name
      LIMIT ? OFFSET ?
    `).all(...params, Number(limit), Number(offset));

    res.json({ students, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/students/:id
router.get('/api/students/:id', authenticate, requireSchool, requirePermission('students.view'), (req, res) => {
  try {
    const student = db.prepare(`
      SELECT s.*, gl.name_en as grade_name_en, gl.name_ar as grade_name_ar,
             sec.name_en as section_name_en, sec.name_ar as section_name_ar,
             p.first_name as parent_first_name, p.last_name as parent_last_name, p.phone as parent_phone, p.email as parent_email
      FROM students s
      LEFT JOIN grade_levels gl ON s.grade_level_id = gl.id
      LEFT JOIN sections sec ON s.section_id = sec.id
      LEFT JOIN users p ON s.parent_id = p.id
      WHERE s.id = ? AND s.school_id = ?
    `).get(req.params.id, req.schoolId);

    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/students
router.post('/api/students', authenticate, requireSchool, requirePermission('students.create'), (req, res) => {
  try {
    const {
      first_name, last_name, first_name_ar, last_name_ar, date_of_birth, gender,
      nationality, national_id, blood_type, photo, medical_notes, allergies,
      emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
      address, grade_level_id, section_id, parent_id, sibling_group_id, custom_fields,
      moe_number
    } = req.body;

    if (!first_name || !last_name) {
      return res.status(400).json({ error: 'First name and last name are required' });
    }

    // Auto-generate student number (scoped to this school since uniqueness is per-school)
    const year = new Date().getFullYear();
    const last = db.prepare(`SELECT student_number FROM students WHERE student_number LIKE ? AND school_id = ? ORDER BY id DESC LIMIT 1`).get(`STU-${year}-%`, req.schoolId);
    let seq = 1;
    if (last) {
      const parts = last.student_number.split('-');
      seq = parseInt(parts[2]) + 1;
    }
    const student_number = `STU-${year}-${String(seq).padStart(4, '0')}`;

    const result = db.prepare(`
      INSERT INTO students (school_id, student_number, first_name, last_name, first_name_ar, last_name_ar,
        date_of_birth, gender, nationality, national_id, blood_type, photo, medical_notes, allergies,
        emergency_contact_name, emergency_contact_phone, emergency_contact_relation, address,
        grade_level_id, section_id, parent_id, sibling_group_id, custom_fields, moe_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.schoolId, student_number, first_name, last_name, first_name_ar, last_name_ar,
      date_of_birth, gender, nationality, national_id, blood_type, photo, medical_notes, allergies,
      emergency_contact_name, emergency_contact_phone, emergency_contact_relation, address,
      grade_level_id, section_id, parent_id, sibling_group_id, custom_fields ? JSON.stringify(custom_fields) : '{}',
      moe_number || null);

    const student = db.prepare('SELECT * FROM students WHERE id = ? AND school_id = ?').get(result.lastInsertRowid, req.schoolId);
    res.status(201).json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/students/:id
router.put('/api/students/:id', authenticate, requireSchool, requirePermission('students.edit'), (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM students WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!existing) return res.status(404).json({ error: 'Student not found' });

    const {
      first_name, last_name, first_name_ar, last_name_ar, date_of_birth, gender,
      nationality, national_id, blood_type, photo, medical_notes, allergies,
      emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
      address, status, grade_level_id, section_id, parent_id, sibling_group_id, custom_fields,
      moe_number
    } = req.body;

    db.prepare(`
      UPDATE students SET
        first_name = COALESCE(?, first_name), last_name = COALESCE(?, last_name),
        first_name_ar = COALESCE(?, first_name_ar), last_name_ar = COALESCE(?, last_name_ar),
        date_of_birth = COALESCE(?, date_of_birth), gender = COALESCE(?, gender),
        nationality = COALESCE(?, nationality), national_id = COALESCE(?, national_id),
        blood_type = COALESCE(?, blood_type), photo = COALESCE(?, photo),
        medical_notes = COALESCE(?, medical_notes), allergies = COALESCE(?, allergies),
        emergency_contact_name = COALESCE(?, emergency_contact_name),
        emergency_contact_phone = COALESCE(?, emergency_contact_phone),
        emergency_contact_relation = COALESCE(?, emergency_contact_relation),
        address = COALESCE(?, address), status = COALESCE(?, status),
        grade_level_id = COALESCE(?, grade_level_id), section_id = COALESCE(?, section_id),
        parent_id = COALESCE(?, parent_id), sibling_group_id = COALESCE(?, sibling_group_id),
        custom_fields = COALESCE(?, custom_fields),
        moe_number = COALESCE(?, moe_number),
        updated_at = datetime('now')
      WHERE id = ? AND school_id = ?
    `).run(first_name, last_name, first_name_ar, last_name_ar, date_of_birth, gender,
      nationality, national_id, blood_type, photo, medical_notes, allergies,
      emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
      address, status, grade_level_id, section_id, parent_id, sibling_group_id,
      custom_fields ? JSON.stringify(custom_fields) : null, moe_number, req.params.id, req.schoolId);

    const student = db.prepare('SELECT * FROM students WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/students/:id - soft delete
router.delete('/api/students/:id', authenticate, requireSchool, requirePermission('students.delete'), (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM students WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!existing) return res.status(404).json({ error: 'Student not found' });

    db.prepare("UPDATE students SET status = 'withdrawn', updated_at = datetime('now') WHERE id = ? AND school_id = ?").run(req.params.id, req.schoolId);
    res.json({ message: 'Student withdrawn successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/students/:id/siblings
router.get('/api/students/:id/siblings', authenticate, requireSchool, requirePermission('students.view'), (req, res) => {
  try {
    const student = db.prepare('SELECT sibling_group_id FROM students WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!student) return res.status(404).json({ error: 'Student not found' });
    if (!student.sibling_group_id) return res.json([]);

    const siblings = db.prepare(`
      SELECT s.*, gl.name_en as grade_name_en, sec.name_en as section_name_en
      FROM students s
      LEFT JOIN grade_levels gl ON s.grade_level_id = gl.id
      LEFT JOIN sections sec ON s.section_id = sec.id
      WHERE s.sibling_group_id = ? AND s.id != ? AND s.school_id = ?
    `).all(student.sibling_group_id, req.params.id, req.schoolId);

    res.json(siblings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/students/:id/documents - Upload document
router.post('/api/students/:id/documents', authenticate, requireSchool, requirePermission('students.edit'), uploadDoc.single('file'), (req, res) => {
  try {
    const student = db.prepare('SELECT id FROM students WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!student) return res.status(404).json({ error: 'Student not found' });
    if (!req.file) return res.status(400).json({ error: 'File is required' });

    const { doc_type } = req.body;
    if (!doc_type) return res.status(400).json({ error: 'doc_type is required' });

    const result = db.prepare(`
      INSERT INTO student_documents (school_id, student_id, doc_type, file_name, file_path, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.schoolId, req.params.id, doc_type, req.file.originalname, `/uploads/documents/${req.file.filename}`, req.user.id);

    const doc = db.prepare('SELECT * FROM student_documents WHERE id = ? AND school_id = ?').get(result.lastInsertRowid, req.schoolId);
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/students/:id/documents - List documents for a student
router.get('/api/students/:id/documents', authenticate, requireSchool, requirePermission('students.view'), (req, res) => {
  try {
    const student = db.prepare('SELECT id FROM students WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const docs = db.prepare(`
      SELECT sd.*, u.first_name as uploaded_by_first_name, u.last_name as uploaded_by_last_name
      FROM student_documents sd
      JOIN users u ON sd.uploaded_by = u.id
      WHERE sd.student_id = ? AND sd.school_id = ?
      ORDER BY sd.uploaded_at DESC
    `).all(req.params.id, req.schoolId);

    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/students/documents/:docId - Delete a document
router.delete('/api/students/documents/:docId', authenticate, requireSchool, requirePermission('students.edit'), (req, res) => {
  try {
    const doc = db.prepare('SELECT * FROM student_documents WHERE id = ? AND school_id = ?').get(req.params.docId, req.schoolId);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    // Remove file from disk
    const filePath = join(__dirname, '..', doc.file_path);
    if (existsSync(filePath)) unlinkSync(filePath);

    db.prepare('DELETE FROM student_documents WHERE id = ? AND school_id = ?').run(req.params.docId, req.schoolId);
    res.json({ message: 'Document deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/students/:id/id-card - Generate ID card data
router.get('/api/students/:id/id-card', authenticate, requireSchool, requirePermission('students.id_cards'), (req, res) => {
  try {
    const student = db.prepare(`
      SELECT s.*, gl.name_en as grade_name_en, gl.name_ar as grade_name_ar,
             sec.name_en as section_name_en, sec.name_ar as section_name_ar
      FROM students s
      LEFT JOIN grade_levels gl ON s.grade_level_id = gl.id
      LEFT JOIN sections sec ON s.section_id = sec.id
      WHERE s.id = ? AND s.school_id = ?
    `).get(req.params.id, req.schoolId);

    if (!student) return res.status(404).json({ error: 'Student not found' });

    const schoolName = db.prepare("SELECT value FROM settings WHERE key = 'school_name_en' AND school_id = ?").get(req.schoolId);
    const schoolNameAr = db.prepare("SELECT value FROM settings WHERE key = 'school_name_ar' AND school_id = ?").get(req.schoolId);
    const academicYear = db.prepare("SELECT value FROM settings WHERE key = 'academic_year' AND school_id = ?").get(req.schoolId);

    const qrData = JSON.stringify({
      student_number: student.student_number,
      name: `${student.first_name} ${student.last_name}`,
      grade: student.grade_name_en,
      section: student.section_name_en,
      id: student.id
    });

    res.json({
      student: {
        id: student.id,
        student_number: student.student_number,
        first_name: student.first_name,
        last_name: student.last_name,
        first_name_ar: student.first_name_ar,
        last_name_ar: student.last_name_ar,
        photo: student.photo,
        date_of_birth: student.date_of_birth,
        blood_type: student.blood_type,
        grade_name_en: student.grade_name_en,
        grade_name_ar: student.grade_name_ar,
        section_name_en: student.section_name_en,
        section_name_ar: student.section_name_ar,
        nationality: student.nationality,
        moe_number: student.moe_number
      },
      school_name_en: schoolName?.value || 'SchoolOS Academy',
      school_name_ar: schoolNameAr?.value || '',
      academic_year: academicYear?.value || '',
      qr_data: qrData
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/students/:id/id-card-pdf - Generate PDF ID card
router.get('/api/students/:id/id-card-pdf', authenticate, requireSchool, requirePermission('students.id_cards'), (req, res) => {
  try {
    const student = db.prepare(`
      SELECT s.*, gl.name_en as grade_name_en, gl.name_ar as grade_name_ar,
             sec.name_en as section_name_en, sec.name_ar as section_name_ar
      FROM students s
      LEFT JOIN grade_levels gl ON s.grade_level_id = gl.id
      LEFT JOIN sections sec ON s.section_id = sec.id
      WHERE s.id = ? AND s.school_id = ?
    `).get(req.params.id, req.schoolId);

    if (!student) return res.status(404).json({ error: 'Student not found' });

    const schoolName = db.prepare("SELECT value FROM settings WHERE key = 'school_name_en' AND school_id = ?").get(req.schoolId);
    const schoolNameAr = db.prepare("SELECT value FROM settings WHERE key = 'school_name_ar' AND school_id = ?").get(req.schoolId);
    const academicYear = db.prepare("SELECT value FROM settings WHERE key = 'academic_year' AND school_id = ?").get(req.schoolId);

    const qrData = JSON.stringify({
      student_number: student.student_number,
      name: `${student.first_name} ${student.last_name}`,
      grade: student.grade_name_en,
      section: student.section_name_en,
      id: student.id
    });

    generateStudentIdCardPDF(student, {
      school_name_en: schoolName?.value || 'SchoolOS Academy',
      school_name_ar: schoolNameAr?.value || '',
      academic_year: academicYear?.value || '',
      qr_data: qrData
    }, res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/students/:id/archive - Archive student (graduate/transfer)
router.post('/api/students/:id/archive', authenticate, requireSchool, requirePermission('students.edit'), (req, res) => {
  try {
    const student = db.prepare('SELECT * FROM students WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const { status, reason } = req.body;
    if (!status || !['graduated', 'transferred'].includes(status)) {
      return res.status(400).json({ error: 'status must be "graduated" or "transferred"' });
    }

    // Update enrollment history
    let history = [];
    try { history = JSON.parse(student.enrollment_history || '[]'); } catch (e) { /* ignore */ }
    history.push({
      action: status,
      date: new Date().toISOString(),
      reason: reason || null,
      grade_level_id: student.grade_level_id,
      section_id: student.section_id
    });

    db.prepare(`
      UPDATE students SET status = ?, enrollment_history = ?, updated_at = datetime('now')
      WHERE id = ? AND school_id = ?
    `).run(status, JSON.stringify(history), req.params.id, req.schoolId);

    const updated = db.prepare('SELECT * FROM students WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/students/:id/family - Get complete family tree for a student
router.get('/api/students/:id/family', authenticate, requireSchool, requirePermission('students.view'), (req, res) => {
  try {
    const student = db.prepare('SELECT id, parent_id, sibling_group_id FROM students WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    // Get parent info (parents are school-scoped users)
    let parent = null;
    if (student.parent_id) {
      parent = db.prepare(`
        SELECT id, first_name, last_name, first_name_ar, last_name_ar, email, phone
        FROM users WHERE id = ? AND school_id = ?
      `).get(student.parent_id, req.schoolId);
    }

    // Get siblings: students sharing same parent_id OR same sibling_group_id (excluding self)
    let siblings = [];
    if (student.parent_id && student.sibling_group_id) {
      siblings = db.prepare(`
        SELECT s.id, s.student_number, s.first_name, s.last_name,
               gl.name_en as grade_name_en, sec.name_en as section_name_en, s.status
        FROM students s
        LEFT JOIN grade_levels gl ON s.grade_level_id = gl.id
        LEFT JOIN sections sec ON s.section_id = sec.id
        WHERE s.id != ? AND s.school_id = ? AND (s.parent_id = ? OR s.sibling_group_id = ?)
      `).all(req.params.id, req.schoolId, student.parent_id, student.sibling_group_id);
    } else if (student.parent_id) {
      siblings = db.prepare(`
        SELECT s.id, s.student_number, s.first_name, s.last_name,
               gl.name_en as grade_name_en, sec.name_en as section_name_en, s.status
        FROM students s
        LEFT JOIN grade_levels gl ON s.grade_level_id = gl.id
        LEFT JOIN sections sec ON s.section_id = sec.id
        WHERE s.id != ? AND s.parent_id = ? AND s.school_id = ?
      `).all(req.params.id, student.parent_id, req.schoolId);
    } else if (student.sibling_group_id) {
      siblings = db.prepare(`
        SELECT s.id, s.student_number, s.first_name, s.last_name,
               gl.name_en as grade_name_en, sec.name_en as section_name_en, s.status
        FROM students s
        LEFT JOIN grade_levels gl ON s.grade_level_id = gl.id
        LEFT JOIN sections sec ON s.section_id = sec.id
        WHERE s.id != ? AND s.sibling_group_id = ? AND s.school_id = ?
      `).all(req.params.id, student.sibling_group_id, req.schoolId);
    }

    res.json({ parent, siblings, sibling_group_id: student.sibling_group_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/students/:id/parent - Assign/change parent for a student
router.put('/api/students/:id/parent', authenticate, requireSchool, requirePermission('students.edit'), (req, res) => {
  try {
    const student = db.prepare('SELECT * FROM students WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const { parent_id } = req.body;

    if (parent_id === null || parent_id === undefined) {
      // Unlink parent
      db.prepare("UPDATE students SET parent_id = NULL, updated_at = datetime('now') WHERE id = ? AND school_id = ?").run(req.params.id, req.schoolId);
      const updated = db.prepare('SELECT * FROM students WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
      return res.json(updated);
    }

    // Validate that parent_id is a user with parent role, scoped to this school
    const parentUser = db.prepare(`
      SELECT u.id FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = ? AND r.key = 'parent' AND u.school_id = ?
    `).get(parent_id, req.schoolId);
    if (!parentUser) return res.status(400).json({ error: 'Invalid parent_id: user not found or does not have parent role' });

    // Assign parent
    db.prepare("UPDATE students SET parent_id = ?, updated_at = datetime('now') WHERE id = ? AND school_id = ?").run(parent_id, req.params.id, req.schoolId);

    // Auto-link siblings: find all students with the same parent_id (within this school) and group them
    const studentsWithSameParent = db.prepare('SELECT id, sibling_group_id FROM students WHERE parent_id = ? AND school_id = ?').all(parent_id, req.schoolId);
    if (studentsWithSameParent.length > 1) {
      // Use existing sibling_group_id from any of them, or generate a new one
      let groupId = studentsWithSameParent.find(s => s.sibling_group_id)?.sibling_group_id;
      if (!groupId) {
        groupId = `SG-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      }
      const updateSiblingGroup = db.prepare("UPDATE students SET sibling_group_id = ?, updated_at = datetime('now') WHERE id = ? AND school_id = ?");
      for (const s of studentsWithSameParent) {
        updateSiblingGroup.run(groupId, s.id, req.schoolId);
      }
    }

    const updated = db.prepare('SELECT * FROM students WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/students/:id/siblings - Link/unlink siblings
router.put('/api/students/:id/siblings', authenticate, requireSchool, requirePermission('students.edit'), (req, res) => {
  try {
    const student = db.prepare('SELECT * FROM students WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const { sibling_ids } = req.body;
    if (!Array.isArray(sibling_ids)) return res.status(400).json({ error: 'sibling_ids must be an array' });

    if (sibling_ids.length === 0) {
      // Remove this student from their sibling group
      db.prepare("UPDATE students SET sibling_group_id = NULL, updated_at = datetime('now') WHERE id = ? AND school_id = ?").run(req.params.id, req.schoolId);
      return res.json([]);
    }

    // Validate all sibling_ids exist within this school
    const placeholders = sibling_ids.map(() => '?').join(',');
    const existingStudents = db.prepare(`SELECT id FROM students WHERE id IN (${placeholders}) AND school_id = ?`).all(...sibling_ids, req.schoolId);
    if (existingStudents.length !== sibling_ids.length) {
      return res.status(400).json({ error: 'One or more sibling_ids are invalid' });
    }

    // Determine the sibling_group_id to use
    const allIds = [Number(req.params.id), ...sibling_ids];
    const allPlaceholders = allIds.map(() => '?').join(',');
    const existingGroup = db.prepare(`SELECT sibling_group_id FROM students WHERE id IN (${allPlaceholders}) AND sibling_group_id IS NOT NULL AND school_id = ? LIMIT 1`).get(...allIds, req.schoolId);
    const groupId = existingGroup?.sibling_group_id || `SG-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    // Assign the sibling_group_id to all students in the group
    const updateStmt = db.prepare("UPDATE students SET sibling_group_id = ?, updated_at = datetime('now') WHERE id = ? AND school_id = ?");
    for (const id of allIds) {
      updateStmt.run(groupId, id, req.schoolId);
    }

    // Return updated sibling list (excluding the requesting student)
    const siblings = db.prepare(`
      SELECT s.id, s.student_number, s.first_name, s.last_name,
             gl.name_en as grade_name_en, sec.name_en as section_name_en, s.status
      FROM students s
      LEFT JOIN grade_levels gl ON s.grade_level_id = gl.id
      LEFT JOIN sections sec ON s.section_id = sec.id
      WHERE s.sibling_group_id = ? AND s.id != ? AND s.school_id = ?
    `).all(groupId, req.params.id, req.schoolId);

    res.json(siblings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/parents - List all users with parent role, with children count
router.get('/api/parents', authenticate, requireSchool, requirePermission('students.view'), (req, res) => {
  try {
    const { search } = req.query;
    let where = ["r.key = 'parent'", 'u.school_id = ?'];
    let params = [req.schoolId];

    if (search) {
      where.push(`(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR u.first_name_ar LIKE ? OR u.last_name_ar LIKE ?)`);
      const term = `%${search}%`;
      params.push(term, term, term, term, term);
    }

    const whereClause = where.join(' AND ');
    const parents = db.prepare(`
      SELECT u.id, u.first_name, u.last_name, u.first_name_ar, u.last_name_ar, u.email, u.phone,
             COUNT(s.id) as children_count
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN students s ON s.parent_id = u.id AND s.school_id = u.school_id
      WHERE ${whereClause}
      GROUP BY u.id
      ORDER BY u.last_name, u.first_name
    `).all(...params);

    res.json(parents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/parents/:id/children - Get all students linked to a parent
router.get('/api/parents/:id/children', authenticate, requireSchool, requirePermission('students.view'), (req, res) => {
  try {
    // Verify the user is a parent scoped to this school
    const parent = db.prepare(`
      SELECT u.id FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = ? AND r.key = 'parent' AND u.school_id = ?
    `).get(req.params.id, req.schoolId);
    if (!parent) return res.status(404).json({ error: 'Parent not found' });

    const children = db.prepare(`
      SELECT s.*, gl.name_en as grade_name_en, gl.name_ar as grade_name_ar,
             sec.name_en as section_name_en, sec.name_ar as section_name_ar
      FROM students s
      LEFT JOIN grade_levels gl ON s.grade_level_id = gl.id
      LEFT JOIN sections sec ON s.section_id = sec.id
      WHERE s.parent_id = ? AND s.school_id = ?
      ORDER BY s.last_name, s.first_name
    `).all(req.params.id, req.schoolId);

    res.json(children);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
