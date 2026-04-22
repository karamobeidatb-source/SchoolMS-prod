import { Router } from 'express';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { unlinkSync, existsSync } from 'fs';
import db from '../db/schema.js';
import { authenticate, requireSchool, requirePermission } from '../middleware/auth.js';
import { generatePayrollSlipPDF } from '../utils/pdfGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const staffDocStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, join(__dirname, '..', 'uploads', 'staff-documents')),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const uploadStaffDoc = multer({ storage: staffDocStorage, limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

// GET /api/staff
router.get('/api/staff', authenticate, requireSchool, requirePermission('staff.view'), (req, res) => {
  try {
    const { department, contract_type, search } = req.query;
    let where = ['u.school_id = ?'];
    let params = [req.schoolId];

    if (department) { where.push('sr.department = ?'); params.push(department); }
    if (contract_type) { where.push('sr.contract_type = ?'); params.push(contract_type); }
    if (search) {
      where.push('(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR sr.employee_number LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    const staff = db.prepare(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.first_name_ar, u.last_name_ar, u.phone, u.is_active,
             r.key as role_key, r.label_en as role_label_en,
             sr.id as staff_record_id, sr.employee_number, sr.department, sr.position, sr.hire_date,
             sr.contract_type, sr.annual_leave_balance, sr.sick_leave_balance
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN staff_records sr ON sr.user_id = u.id AND sr.school_id = ?
      WHERE ${where.join(' AND ')} AND r.key NOT IN ('student', 'parent')
      ORDER BY u.last_name, u.first_name
    `).all(req.schoolId, ...params);

    res.json(staff);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/staff/:id
router.get('/api/staff/:id', authenticate, requireSchool, requirePermission('staff.view'), (req, res) => {
  try {
    const staff = db.prepare(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.first_name_ar, u.last_name_ar, u.phone, u.avatar, u.is_active, u.created_at,
             r.key as role_key, r.label_en as role_label_en, r.label_ar as role_label_ar,
             sr.*
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN staff_records sr ON sr.user_id = u.id AND sr.school_id = ?
      WHERE u.id = ? AND u.school_id = ?
    `).get(req.schoolId, req.params.id, req.schoolId);

    if (!staff) return res.status(404).json({ error: 'Staff member not found' });

    // Get recent leave requests
    const leaveRequests = db.prepare(`
      SELECT lr.*, a.first_name as approver_first_name, a.last_name as approver_last_name
      FROM leave_requests lr
      LEFT JOIN users a ON lr.approved_by = a.id
      WHERE lr.user_id = ? AND lr.school_id = ?
      ORDER BY lr.created_at DESC LIMIT 10
    `).all(req.params.id, req.schoolId);

    res.json({ ...staff, leaveRequests });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/staff
router.post('/api/staff', authenticate, requireSchool, requirePermission('staff.manage'), (req, res) => {
  try {
    const { user_id, employee_number, department, position, hire_date, contract_type, salary, bank_account, annual_leave_balance, sick_leave_balance, emergency_leave_balance, notes } = req.body;

    if (!user_id) return res.status(400).json({ error: 'user_id is required' });

    // Upsert
    const existing = db.prepare('SELECT id FROM staff_records WHERE user_id = ? AND school_id = ?').get(user_id, req.schoolId);

    if (existing) {
      db.prepare(`
        UPDATE staff_records SET
          employee_number = COALESCE(?, employee_number), department = COALESCE(?, department),
          position = COALESCE(?, position), hire_date = COALESCE(?, hire_date),
          contract_type = COALESCE(?, contract_type), salary = COALESCE(?, salary),
          bank_account = COALESCE(?, bank_account),
          annual_leave_balance = COALESCE(?, annual_leave_balance),
          sick_leave_balance = COALESCE(?, sick_leave_balance),
          emergency_leave_balance = COALESCE(?, emergency_leave_balance),
          notes = COALESCE(?, notes)
        WHERE id = ? AND school_id = ?
      `).run(employee_number, department, position, hire_date, contract_type, salary, bank_account, annual_leave_balance, sick_leave_balance, emergency_leave_balance, notes, existing.id, req.schoolId);
      const record = db.prepare('SELECT * FROM staff_records WHERE id = ? AND school_id = ?').get(existing.id, req.schoolId);
      return res.json(record);
    }

    const result = db.prepare(`
      INSERT INTO staff_records (school_id, user_id, employee_number, department, position, hire_date, contract_type, salary, bank_account, annual_leave_balance, sick_leave_balance, emergency_leave_balance, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.schoolId, user_id, employee_number, department, position, hire_date, contract_type, salary, bank_account, annual_leave_balance || 14, sick_leave_balance || 10, emergency_leave_balance || 3, notes);

    const record = db.prepare('SELECT * FROM staff_records WHERE id = ? AND school_id = ?').get(result.lastInsertRowid, req.schoolId);
    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/staff/:id
router.put('/api/staff/:id', authenticate, requireSchool, requirePermission('staff.manage'), (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM staff_records WHERE user_id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!existing) return res.status(404).json({ error: 'Staff record not found' });

    const { employee_number, department, position, hire_date, contract_type, salary, bank_account, annual_leave_balance, sick_leave_balance, emergency_leave_balance, notes } = req.body;

    db.prepare(`
      UPDATE staff_records SET
        employee_number = COALESCE(?, employee_number), department = COALESCE(?, department),
        position = COALESCE(?, position), hire_date = COALESCE(?, hire_date),
        contract_type = COALESCE(?, contract_type), salary = COALESCE(?, salary),
        bank_account = COALESCE(?, bank_account),
        annual_leave_balance = COALESCE(?, annual_leave_balance),
        sick_leave_balance = COALESCE(?, sick_leave_balance),
        emergency_leave_balance = COALESCE(?, emergency_leave_balance),
        notes = COALESCE(?, notes)
      WHERE user_id = ? AND school_id = ?
    `).run(employee_number, department, position, hire_date, contract_type, salary, bank_account, annual_leave_balance, sick_leave_balance, emergency_leave_balance, notes, req.params.id, req.schoolId);

    const record = db.prepare('SELECT * FROM staff_records WHERE user_id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/leave-requests
router.get('/api/leave-requests', authenticate, requireSchool, (req, res) => {
  try {
    const { status, user_id } = req.query;
    let where = ['lr.school_id = ?'];
    let params = [req.schoolId];

    if (status) { where.push('lr.status = ?'); params.push(status); }
    if (user_id) { where.push('lr.user_id = ?'); params.push(user_id); }

    // Non-admin users can only see their own leave requests
    if (!req.user.permissions.includes('leave.approve') && req.user.role_key !== 'super_admin') {
      where.push('lr.user_id = ?');
      params.push(req.user.id);
    }

    const requests = db.prepare(`
      SELECT lr.*, u.first_name, u.last_name, u.email,
             a.first_name as approver_first_name, a.last_name as approver_last_name
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      LEFT JOIN users a ON lr.approved_by = a.id
      WHERE ${where.join(' AND ')}
      ORDER BY lr.created_at DESC
    `).all(...params);

    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/leave-requests
router.post('/api/leave-requests', authenticate, requireSchool, (req, res) => {
  try {
    const { leave_type, start_date, end_date, reason } = req.body;

    if (!leave_type || !start_date || !end_date) {
      return res.status(400).json({ error: 'leave_type, start_date, and end_date are required' });
    }

    const result = db.prepare(`
      INSERT INTO leave_requests (school_id, user_id, leave_type, start_date, end_date, reason)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.schoolId, req.user.id, leave_type, start_date, end_date, reason);

    const request = db.prepare('SELECT * FROM leave_requests WHERE id = ? AND school_id = ?').get(result.lastInsertRowid, req.schoolId);
    res.status(201).json(request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/leave-requests/:id
router.put('/api/leave-requests/:id', authenticate, requireSchool, requirePermission('leave.approve'), (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM leave_requests WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!existing) return res.status(404).json({ error: 'Leave request not found' });

    const { status } = req.body;
    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'status must be "approved" or "rejected"' });
    }

    db.prepare(`
      UPDATE leave_requests SET status = ?, approved_by = ? WHERE id = ? AND school_id = ?
    `).run(status, req.user.id, req.params.id, req.schoolId);

    // If approved, deduct leave balance
    if (status === 'approved') {
      const start = new Date(existing.start_date);
      const end = new Date(existing.end_date);
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

      const balanceColumn = {
        annual: 'annual_leave_balance',
        sick: 'sick_leave_balance',
        emergency: 'emergency_leave_balance'
      }[existing.leave_type];

      if (balanceColumn) {
        db.prepare(`UPDATE staff_records SET ${balanceColumn} = ${balanceColumn} - ? WHERE user_id = ? AND school_id = ?`).run(days, existing.user_id, req.schoolId);
      }
    }

    const request = db.prepare(`
      SELECT lr.*, u.first_name, u.last_name
      FROM leave_requests lr JOIN users u ON lr.user_id = u.id
      WHERE lr.id = ? AND lr.school_id = ?
    `).get(req.params.id, req.schoolId);

    res.json(request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/staff-attendance
router.get('/api/staff-attendance', authenticate, requireSchool, requirePermission('staff.view'), (req, res) => {
  try {
    const { date, user_id, status } = req.query;
    let where = ['sa.school_id = ?'];
    let params = [req.schoolId];

    if (date) { where.push('sa.date = ?'); params.push(date); }
    if (user_id) { where.push('sa.user_id = ?'); params.push(user_id); }
    if (status) { where.push('sa.status = ?'); params.push(status); }

    const records = db.prepare(`
      SELECT sa.*, u.first_name, u.last_name, u.email, r.label_en as role_label
      FROM staff_attendance sa
      JOIN users u ON sa.user_id = u.id
      JOIN roles r ON u.role_id = r.id
      WHERE ${where.join(' AND ')}
      ORDER BY sa.date DESC, u.last_name
    `).all(...params);

    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/staff-attendance
router.post('/api/staff-attendance', authenticate, requireSchool, requirePermission('staff.manage'), (req, res) => {
  try {
    const { user_id, date, check_in, check_out, status } = req.body;

    if (!user_id || !date) {
      return res.status(400).json({ error: 'user_id and date are required' });
    }

    // Upsert
    const existing = db.prepare('SELECT id FROM staff_attendance WHERE user_id = ? AND date = ? AND school_id = ?').get(user_id, date, req.schoolId);

    if (existing) {
      db.prepare(`
        UPDATE staff_attendance SET check_in = COALESCE(?, check_in), check_out = COALESCE(?, check_out), status = COALESCE(?, status)
        WHERE id = ? AND school_id = ?
      `).run(check_in, check_out, status, existing.id, req.schoolId);
      const updated = db.prepare('SELECT * FROM staff_attendance WHERE id = ? AND school_id = ?').get(existing.id, req.schoolId);
      return res.json(updated);
    }

    const result = db.prepare(`
      INSERT INTO staff_attendance (school_id, user_id, date, check_in, check_out, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.schoolId, user_id, date, check_in, check_out, status || 'present');

    const record = db.prepare('SELECT * FROM staff_attendance WHERE id = ? AND school_id = ?').get(result.lastInsertRowid, req.schoolId);
    res.status(201).json(record);
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Attendance already recorded for this user/date' });
    }
    res.status(500).json({ error: err.message });
  }
});

// GET /api/payroll
router.get('/api/payroll', authenticate, requireSchool, requirePermission('payroll.view'), (req, res) => {
  try {
    const { month, department } = req.query;

    let where = ['sr.salary IS NOT NULL', 'sr.school_id = ?'];
    let params = [req.schoolId];
    if (department) { where.push('sr.department = ?'); params.push(department); }

    const staff = db.prepare(`
      SELECT u.id as user_id, u.first_name, u.last_name, u.email,
             sr.employee_number, sr.department, sr.position, sr.contract_type, sr.salary, sr.bank_account
      FROM staff_records sr
      JOIN users u ON sr.user_id = u.id
      WHERE ${where.join(' AND ')} AND u.is_active = 1
      ORDER BY sr.department, u.last_name
    `).all(...params);

    // Calculate summary
    const totalSalary = staff.reduce((sum, s) => sum + (s.salary || 0), 0);

    // Get leave days for the month if provided
    let staffWithDeductions = staff;
    if (month) {
      staffWithDeductions = staff.map(s => {
        const unpaidLeave = db.prepare(`
          SELECT COUNT(*) as days FROM leave_requests
          WHERE user_id = ? AND leave_type = 'unpaid' AND status = 'approved'
            AND start_date <= ? AND end_date >= ? AND school_id = ?
        `).get(s.user_id, `${month}-31`, `${month}-01`, req.schoolId);
        return { ...s, unpaid_leave_days: unpaidLeave.days };
      });
    }

    res.json({ staff: staffWithDeductions, totalSalary, headcount: staff.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/performance-reviews - List reviews
router.get('/api/performance-reviews', authenticate, requireSchool, requirePermission('staff.view'), (req, res) => {
  try {
    const { user_id, academic_year } = req.query;
    let where = ['pr.school_id = ?'];
    let params = [req.schoolId];

    if (user_id) { where.push('pr.user_id = ?'); params.push(user_id); }
    if (academic_year) { where.push('pr.academic_year = ?'); params.push(academic_year); }

    const reviews = db.prepare(`
      SELECT pr.*, u.first_name, u.last_name, u.email,
             r.first_name as reviewer_first_name, r.last_name as reviewer_last_name
      FROM performance_reviews pr
      JOIN users u ON pr.user_id = u.id
      JOIN users r ON pr.reviewer_id = r.id
      WHERE ${where.join(' AND ')}
      ORDER BY pr.created_at DESC
    `).all(...params);

    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/performance-reviews - Create review
router.post('/api/performance-reviews', authenticate, requireSchool, requirePermission('staff.manage'), (req, res) => {
  try {
    const { user_id, academic_year, rating, strengths, improvements, goals, comments } = req.body;

    if (!user_id || !academic_year) {
      return res.status(400).json({ error: 'user_id and academic_year are required' });
    }

    const result = db.prepare(`
      INSERT INTO performance_reviews (school_id, user_id, reviewer_id, academic_year, rating, strengths, improvements, goals, comments)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.schoolId, user_id, req.user.id, academic_year, rating || null, strengths, improvements, goals, comments);

    const review = db.prepare(`
      SELECT pr.*, u.first_name, u.last_name,
             r.first_name as reviewer_first_name, r.last_name as reviewer_last_name
      FROM performance_reviews pr
      JOIN users u ON pr.user_id = u.id
      JOIN users r ON pr.reviewer_id = r.id
      WHERE pr.id = ? AND pr.school_id = ?
    `).get(result.lastInsertRowid, req.schoolId);

    res.status(201).json(review);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/staff/:id/documents - List staff documents
router.get('/api/staff/:id/documents', authenticate, requireSchool, requirePermission('staff.view'), (req, res) => {
  try {
    const docs = db.prepare(`
      SELECT * FROM staff_documents WHERE user_id = ? AND school_id = ? ORDER BY uploaded_at DESC
    `).all(req.params.id, req.schoolId);

    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/staff/:id/documents - Upload staff document
router.post('/api/staff/:id/documents', authenticate, requireSchool, requirePermission('staff.manage'), uploadStaffDoc.single('file'), (req, res) => {
  try {
    const user = db.prepare('SELECT id FROM users WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!req.file) return res.status(400).json({ error: 'File is required' });

    const { doc_type } = req.body;
    if (!doc_type) return res.status(400).json({ error: 'doc_type is required' });

    const result = db.prepare(`
      INSERT INTO staff_documents (school_id, user_id, doc_type, file_name, file_path)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.schoolId, req.params.id, doc_type, req.file.originalname, `/uploads/staff-documents/${req.file.filename}`);

    const doc = db.prepare('SELECT * FROM staff_documents WHERE id = ? AND school_id = ?').get(result.lastInsertRowid, req.schoolId);
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/staff/documents/:docId - Delete staff document
router.delete('/api/staff/documents/:docId', authenticate, requireSchool, requirePermission('staff.manage'), (req, res) => {
  try {
    const doc = db.prepare('SELECT * FROM staff_documents WHERE id = ? AND school_id = ?').get(req.params.docId, req.schoolId);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const filePath = join(__dirname, '..', doc.file_path);
    if (existsSync(filePath)) unlinkSync(filePath);

    db.prepare('DELETE FROM staff_documents WHERE id = ? AND school_id = ?').run(req.params.docId, req.schoolId);
    res.json({ message: 'Document deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/payroll/slip/:userId - Generate payroll slip PDF
router.get('/api/payroll/slip/:userId', authenticate, requireSchool, requirePermission('payroll.view'), (req, res) => {
  try {
    const { month } = req.query;

    const staff = db.prepare(`
      SELECT u.id as user_id, u.first_name, u.last_name, u.email,
             sr.employee_number, sr.department, sr.position, sr.contract_type, sr.salary, sr.bank_account
      FROM staff_records sr
      JOIN users u ON sr.user_id = u.id
      WHERE u.id = ? AND sr.school_id = ?
    `).get(req.params.userId, req.schoolId);

    if (!staff) return res.status(404).json({ error: 'Staff record not found' });

    let unpaidLeaveDays = 0;
    if (month) {
      const unpaidLeave = db.prepare(`
        SELECT COUNT(*) as days FROM leave_requests
        WHERE user_id = ? AND leave_type = 'unpaid' AND status = 'approved'
          AND start_date <= ? AND end_date >= ? AND school_id = ?
      `).get(staff.user_id, `${month}-31`, `${month}-01`, req.schoolId);
      unpaidLeaveDays = unpaidLeave.days;
    }

    generatePayrollSlipPDF({ ...staff, unpaid_leave_days: unpaidLeaveDays }, month || null, res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
