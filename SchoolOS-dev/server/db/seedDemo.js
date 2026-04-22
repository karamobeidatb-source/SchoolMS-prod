import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const db = new Database(join(__dirname, 'schoolos.db'));
db.pragma('foreign_keys = ON');

const FIRST_NAMES = ['Omar','Ahmad','Yousef','Khaled','Hamza','Tariq','Rami','Zaid','Bilal','Adam','Layla','Sara','Noor','Dana','Lina','Hala','Maya','Salma','Rania','Farah'];
const LAST_NAMES = ['Haddad','Khoury','Nasser','Masri','Saleh','Hijazi','Qasem','Halabi','Sabbagh','Barakat'];
const FIRST_AR = ['عمر','أحمد','يوسف','خالد','حمزة','طارق','رامي','زيد','بلال','آدم','ليلى','سارة','نور','دانا','لينا','هلا','مايا','سلمى','رانيا','فرح'];
const LAST_AR = ['حداد','خوري','ناصر','المصري','صالح','حجازي','قاسم','حلبي','صباغ','بركات'];

function pick(arr, i) { return arr[i % arr.length]; }

function seedForSchool(schoolId) {
  const roles = Object.fromEntries(db.prepare('SELECT key, id FROM roles').all().map(r => [r.key, r.id]));
  const password = bcrypt.hashSync('demo123', 10);

  // --- Teachers (one per subject, up to 6) ---
  const subjects = db.prepare('SELECT id, name_en, code FROM subjects WHERE school_id = ? LIMIT 6').all(schoolId);
  const insertUser = db.prepare(`
    INSERT INTO users (school_id, phone, email, password, first_name, last_name, first_name_ar, last_name_ar, role_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const teacherPhones = [];
  for (let i = 0; i < subjects.length; i++) {
    const phone = `96279${String(1000000 + schoolId * 100 + i).padStart(7, '0')}`;
    const existing = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
    if (existing) { teacherPhones.push({ id: existing.id, phone }); continue; }
    const res = insertUser.run(
      schoolId, phone, `teacher${schoolId}_${i}@demo.jo`, password,
      pick(FIRST_NAMES, i), pick(LAST_NAMES, i),
      pick(FIRST_AR, i), pick(LAST_AR, i), roles.teacher
    );
    teacherPhones.push({ id: res.lastInsertRowid, phone });
  }

  // --- Students: 15 per section for first 4 sections (Grade 1 A/B, Grade 2 A/B) ---
  const sections = db.prepare(`
    SELECT s.id, s.grade_level_id, gl.order_index
    FROM sections s JOIN grade_levels gl ON s.grade_level_id = gl.id
    WHERE s.school_id = ? ORDER BY gl.order_index, s.name_en LIMIT 4
  `).all(schoolId);

  const insertStudent = db.prepare(`
    INSERT INTO students (school_id, student_number, first_name, last_name, first_name_ar, last_name_ar,
                          date_of_birth, gender, nationality, grade_level_id, section_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Jordanian', ?, ?, 'active')
  `);

  const existingStudents = db.prepare('SELECT COUNT(*) as c FROM students WHERE school_id = ?').get(schoolId).c;
  let seq = existingStudents;
  let studentsAdded = 0;

  for (const sec of sections) {
    const already = db.prepare('SELECT COUNT(*) as c FROM students WHERE section_id = ? AND school_id = ?').get(sec.id, schoolId).c;
    if (already >= 15) continue;
    const toAdd = 15 - already;
    for (let i = 0; i < toAdd; i++) {
      seq++;
      const studentNumber = `${schoolId}-${String(seq).padStart(5, '0')}`;
      const gender = i % 2 === 0 ? 'male' : 'female';
      const firstIdx = gender === 'male' ? i : i + 10;
      const birthYear = 2024 - sec.order_index - 5;
      try {
        insertStudent.run(
          schoolId, studentNumber,
          pick(FIRST_NAMES, firstIdx), pick(LAST_NAMES, seq),
          pick(FIRST_AR, firstIdx), pick(LAST_AR, seq),
          `${birthYear}-0${(i % 9) + 1}-15`, gender,
          sec.grade_level_id, sec.id
        );
        studentsAdded++;
      } catch (e) {
        if (!String(e.message).includes('UNIQUE')) throw e;
      }
    }
  }

  // --- Subject assignments (teacher to section) for current academic year ---
  const insertAssign = db.prepare(`
    INSERT OR IGNORE INTO subject_assignments (school_id, subject_id, section_id, teacher_id, academic_year, semester)
    VALUES (?, ?, ?, ?, '2025-2026', 2)
  `);
  for (let i = 0; i < subjects.length; i++) {
    for (const sec of sections) {
      insertAssign.run(schoolId, subjects[i].id, sec.id, teacherPhones[i].id);
    }
  }

  return { schoolId, teachersSeeded: teacherPhones.length, studentsAdded, sections: sections.length };
}

console.log('Seeding demo data...');
const schools = db.prepare('SELECT id, name_en FROM schools WHERE is_active = 1').all();
for (const s of schools) {
  const result = seedForSchool(s.id);
  console.log(`  [school ${s.id}] ${s.name_en}:`, result);
}
console.log('Done. Teacher login: phone like 962791000xxx / password demo123');
db.close();
