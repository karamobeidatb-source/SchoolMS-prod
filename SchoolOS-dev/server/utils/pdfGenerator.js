import PDFDocument from 'pdfkit';

/**
 * Generate a PDF report card for a student.
 * @param {Object} data - { student, subjects, weights, comments }
 * @param {Object} res - Express response object
 */
export function generateReportCardPDF(data, res) {
  const { student, subjects, weights, comments } = data;
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  const studentName = `${student.first_name} ${student.last_name}`;
  const fileName = `report-card-${student.student_number || student.id}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  doc.pipe(res);

  // --- Header ---
  doc.fontSize(22).font('Helvetica-Bold').text('SchoolOS - Student Report Card', { align: 'center' });
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#333333');
  doc.moveDown(0.8);

  // --- Student Info ---
  doc.fontSize(11).font('Helvetica');
  const infoStartY = doc.y;

  doc.font('Helvetica-Bold').text('Student Name:', 50, infoStartY, { continued: true })
    .font('Helvetica').text(`  ${studentName}`);

  doc.font('Helvetica-Bold').text('Student ID:', 50, infoStartY + 18, { continued: true })
    .font('Helvetica').text(`  ${student.student_number || student.id}`);

  doc.font('Helvetica-Bold').text('Grade Level:', 300, infoStartY, { continued: true })
    .font('Helvetica').text(`  ${student.grade_name_en || 'N/A'}`);

  doc.font('Helvetica-Bold').text('Section:', 300, infoStartY + 18, { continued: true })
    .font('Helvetica').text(`  ${student.section_name_en || 'N/A'}`);

  // Academic year and semester from query data or defaults
  const academicYear = (weights && weights.length > 0) ? weights[0].academic_year : 'N/A';
  const semester = (weights && weights.length > 0) ? weights[0].semester : 'N/A';

  doc.font('Helvetica-Bold').text('Academic Year:', 50, infoStartY + 36, { continued: true })
    .font('Helvetica').text(`  ${academicYear}`);

  doc.font('Helvetica-Bold').text('Semester:', 300, infoStartY + 36, { continued: true })
    .font('Helvetica').text(`  ${semester}`);

  doc.moveDown(2);
  doc.y = infoStartY + 65;

  // --- Grades Table ---
  doc.fontSize(13).font('Helvetica-Bold').text('Subject Grades', 50);
  doc.moveDown(0.5);

  const tableTop = doc.y;
  const colX = { subject: 50, code: 200, grades: 270, average: 470 };
  const rowHeight = 22;

  // Table header
  doc.fontSize(9).font('Helvetica-Bold');
  doc.rect(50, tableTop, 495, rowHeight).fill('#4a5568');
  doc.fillColor('#ffffff');
  doc.text('Subject', colX.subject + 5, tableTop + 6);
  doc.text('Code', colX.code + 5, tableTop + 6);
  doc.text('Category Scores', colX.grades + 5, tableTop + 6);
  doc.text('Average', colX.average + 5, tableTop + 6);
  doc.fillColor('#000000');

  let currentY = tableTop + rowHeight;
  const maxY = 700; // leave room for comments

  if (subjects && subjects.length > 0) {
    subjects.forEach((subj, idx) => {
      if (currentY > maxY) {
        doc.addPage();
        currentY = 50;
      }

      const bgColor = idx % 2 === 0 ? '#f7fafc' : '#ffffff';
      doc.rect(50, currentY, 495, rowHeight).fill(bgColor);
      doc.fillColor('#000000');

      doc.fontSize(9).font('Helvetica');
      doc.text(subj.subject_name_en || '', colX.subject + 5, currentY + 6, { width: 145 });
      doc.text(subj.subject_code || '', colX.code + 5, currentY + 6, { width: 65 });

      // Summarize category scores
      const categoryScores = (subj.grades || []).map(g => {
        const pct = g.max_score > 0 ? Math.round((g.score / g.max_score) * 100) : 0;
        return `${g.category}: ${g.score}/${g.max_score} (${pct}%)`;
      }).join(', ');
      doc.text(categoryScores, colX.grades + 5, currentY + 6, { width: 195 });

      // Compute average percentage
      const totalScore = (subj.grades || []).reduce((s, g) => s + (g.score || 0), 0);
      const totalMax = (subj.grades || []).reduce((s, g) => s + (g.max_score || 0), 0);
      const avg = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
      doc.font('Helvetica-Bold').text(`${avg}%`, colX.average + 5, currentY + 6);

      currentY += rowHeight;
    });
  } else {
    doc.fontSize(10).font('Helvetica').text('No grades available.', 55, currentY + 6);
    currentY += rowHeight;
  }

  // Table border
  doc.rect(50, tableTop, 495, currentY - tableTop).stroke('#cbd5e0');

  // --- Comments Section ---
  currentY += 20;
  if (currentY > maxY) {
    doc.addPage();
    currentY = 50;
  }

  doc.fontSize(13).font('Helvetica-Bold').text('Teacher Comments', 50, currentY);
  currentY += 22;

  if (comments && comments.length > 0) {
    comments.forEach(c => {
      if (currentY > 750) {
        doc.addPage();
        currentY = 50;
      }
      doc.fontSize(9).font('Helvetica-Bold')
        .text(`${c.subject_name_en} - ${c.teacher_first_name} ${c.teacher_last_name}:`, 55, currentY);
      currentY += 14;
      doc.fontSize(9).font('Helvetica').text(c.comment || '', 60, currentY, { width: 480 });
      currentY = doc.y + 10;
    });
  } else {
    doc.fontSize(10).font('Helvetica').text('No comments available.', 55, currentY);
  }

  // --- Footer ---
  doc.fontSize(8).font('Helvetica').fillColor('#999999')
    .text(`Generated on ${new Date().toISOString().split('T')[0]} by SchoolOS`, 50, 770, { align: 'center' });

  doc.end();
}

/**
 * Generate a printable student ID card PDF.
 * @param {Object} student - Student data
 * @param {Object} schoolInfo - { school_name_en, school_name_ar, academic_year, qr_data }
 * @param {Object} res - Express response object
 */
export function generateStudentIdCardPDF(student, schoolInfo, res) {
  const doc = new PDFDocument({ size: [350, 220], margin: 15 });

  const fileName = `id-card-${student.student_number || student.id}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  doc.pipe(res);

  // --- Card border ---
  doc.roundedRect(5, 5, 340, 210, 8).stroke('#2b6cb0');

  // --- School name header ---
  doc.rect(5, 5, 340, 32).fill('#2b6cb0');
  doc.fillColor('#ffffff').fontSize(12).font('Helvetica-Bold')
    .text(schoolInfo.school_name_en || 'SchoolOS Academy', 10, 12, { align: 'center', width: 330 });
  doc.fillColor('#000000');

  // --- Photo placeholder ---
  doc.rect(15, 48, 65, 75).stroke('#cccccc');
  doc.fontSize(8).font('Helvetica').fillColor('#999999')
    .text('Photo', 30, 80);
  doc.fillColor('#000000');

  // --- Student details ---
  const detailX = 95;
  let detailY = 50;

  doc.fontSize(10).font('Helvetica-Bold')
    .text(`${student.first_name} ${student.last_name}`, detailX, detailY, { width: 240 });
  detailY += 14;

  if (student.first_name_ar || student.last_name_ar) {
    doc.fontSize(9).font('Helvetica')
      .text(`${student.first_name_ar || ''} ${student.last_name_ar || ''}`, detailX, detailY, { width: 240 });
    detailY += 13;
  }

  doc.fontSize(8).font('Helvetica');
  doc.font('Helvetica-Bold').text('ID: ', detailX, detailY, { continued: true })
    .font('Helvetica').text(student.student_number || String(student.id));
  detailY += 12;

  doc.font('Helvetica-Bold').text('Grade: ', detailX, detailY, { continued: true })
    .font('Helvetica').text(student.grade_name_en || 'N/A');
  detailY += 12;

  doc.font('Helvetica-Bold').text('Section: ', detailX, detailY, { continued: true })
    .font('Helvetica').text(student.section_name_en || 'N/A');
  detailY += 12;

  if (schoolInfo.academic_year) {
    doc.font('Helvetica-Bold').text('Year: ', detailX, detailY, { continued: true })
      .font('Helvetica').text(schoolInfo.academic_year);
  }

  // --- QR code data text ---
  doc.fontSize(6).font('Helvetica').fillColor('#666666')
    .text('QR Data: ' + (schoolInfo.qr_data || ''), 15, 135, { width: 320 });

  // --- Footer line ---
  doc.fillColor('#2b6cb0').fontSize(7).font('Helvetica')
    .text('SchoolOS - Student Identification Card', 10, 195, { align: 'center', width: 330 });

  doc.end();
}

/**
 * Generate a payroll slip PDF for a staff member.
 * @param {Object} staffData - { user_id, first_name, last_name, employee_number, department, position, salary, bank_account, unpaid_leave_days }
 * @param {string} month - Month string, e.g. "2026-04"
 * @param {Object} res - Express response object
 */
export function generatePayrollSlipPDF(staffData, month, res) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  const fileName = `payroll-slip-${staffData.employee_number || staffData.user_id}-${month || 'current'}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  doc.pipe(res);

  // --- Header ---
  doc.fontSize(20).font('Helvetica-Bold').text('SchoolOS - Payroll Slip', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(11).font('Helvetica').fillColor('#555555')
    .text(`Month: ${month || 'N/A'}`, { align: 'center' });
  doc.fillColor('#000000');
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#333333');
  doc.moveDown(1);

  // --- Employee Info ---
  const infoY = doc.y;

  doc.fontSize(10).font('Helvetica-Bold').text('Employee Name:', 50, infoY, { continued: true })
    .font('Helvetica').text(`  ${staffData.first_name} ${staffData.last_name}`);

  doc.font('Helvetica-Bold').text('Employee ID:', 50, infoY + 18, { continued: true })
    .font('Helvetica').text(`  ${staffData.employee_number || 'N/A'}`);

  doc.font('Helvetica-Bold').text('Department:', 300, infoY, { continued: true })
    .font('Helvetica').text(`  ${staffData.department || 'N/A'}`);

  doc.font('Helvetica-Bold').text('Position:', 300, infoY + 18, { continued: true })
    .font('Helvetica').text(`  ${staffData.position || 'N/A'}`);

  doc.y = infoY + 50;
  doc.moveDown(1);

  // --- Salary Breakdown Table ---
  const tableX = 50;
  const tableW = 495;
  let ty = doc.y;
  const rh = 26;

  // Header row
  doc.rect(tableX, ty, tableW, rh).fill('#4a5568');
  doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold');
  doc.text('Description', tableX + 10, ty + 7);
  doc.text('Amount (JOD)', 400, ty + 7);
  doc.fillColor('#000000');
  ty += rh;

  const salary = staffData.salary || 0;
  const unpaidDays = staffData.unpaid_leave_days || 0;
  const dailyRate = salary / 30;
  const unpaidDeduction = Math.round(unpaidDays * dailyRate * 100) / 100;
  const netPay = Math.round((salary - unpaidDeduction) * 100) / 100;

  const rows = [
    { label: 'Basic Salary', amount: salary.toFixed(2) },
    { label: `Unpaid Leave Deduction (${unpaidDays} day${unpaidDays !== 1 ? 's' : ''})`, amount: unpaidDeduction > 0 ? `-${unpaidDeduction.toFixed(2)}` : '0.00' },
  ];

  rows.forEach((row, i) => {
    const bg = i % 2 === 0 ? '#f7fafc' : '#ffffff';
    doc.rect(tableX, ty, tableW, rh).fill(bg);
    doc.fillColor('#000000').fontSize(10).font('Helvetica');
    doc.text(row.label, tableX + 10, ty + 7);
    doc.text(row.amount, 400, ty + 7);
    ty += rh;
  });

  // Net pay row
  doc.rect(tableX, ty, tableW, rh).fill('#edf2f7');
  doc.fillColor('#000000').fontSize(11).font('Helvetica-Bold');
  doc.text('Net Pay', tableX + 10, ty + 7);
  doc.text(netPay.toFixed(2), 400, ty + 7);
  ty += rh;

  // Table border
  doc.rect(tableX, doc.y, tableW, ty - doc.y).stroke('#cbd5e0');

  // --- Bank info ---
  ty += 25;
  if (staffData.bank_account) {
    doc.fontSize(9).font('Helvetica-Bold').text('Bank Account:', 50, ty, { continued: true })
      .font('Helvetica').text(`  ${staffData.bank_account}`);
  }

  // --- Footer ---
  doc.fontSize(8).font('Helvetica').fillColor('#999999')
    .text(`Generated on ${new Date().toISOString().split('T')[0]} by SchoolOS`, 50, 770, { align: 'center' });

  doc.end();
}
