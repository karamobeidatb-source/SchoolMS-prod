import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'schoolos.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    -- Schools (tenants)
    CREATE TABLE IF NOT EXISTS schools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_en TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      code TEXT UNIQUE,
      phone TEXT,
      address TEXT,
      logo TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Permissions table (system-wide)
    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      label_en TEXT NOT NULL,
      label_ar TEXT NOT NULL,
      module TEXT NOT NULL,
      description TEXT
    );

    -- Roles table (system-wide)
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      label_en TEXT NOT NULL,
      label_ar TEXT NOT NULL,
      is_system INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id INTEGER NOT NULL,
      permission_id INTEGER NOT NULL,
      PRIMARY KEY (role_id, permission_id),
      FOREIGN KEY (role_id) REFERENCES roles(id),
      FOREIGN KEY (permission_id) REFERENCES permissions(id)
    );

    -- Users (scoped to a school, except super_admin which has NULL school_id)
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER,
      phone TEXT UNIQUE NOT NULL,
      email TEXT,
      password TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      first_name_ar TEXT,
      last_name_ar TEXT,
      role_id INTEGER NOT NULL,
      avatar TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (role_id) REFERENCES roles(id),
      FOREIGN KEY (school_id) REFERENCES schools(id)
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      student_number TEXT NOT NULL,
      user_id INTEGER,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      first_name_ar TEXT,
      last_name_ar TEXT,
      date_of_birth TEXT,
      gender TEXT CHECK(gender IN ('male','female')),
      nationality TEXT,
      national_id TEXT,
      blood_type TEXT,
      photo TEXT,
      medical_notes TEXT,
      allergies TEXT,
      emergency_contact_name TEXT,
      emergency_contact_phone TEXT,
      emergency_contact_relation TEXT,
      address TEXT,
      enrollment_date TEXT DEFAULT (date('now')),
      status TEXT DEFAULT 'active' CHECK(status IN ('active','inactive','graduated','transferred','withdrawn')),
      grade_level_id INTEGER,
      section_id INTEGER,
      parent_id INTEGER,
      sibling_group_id TEXT,
      moe_number TEXT,
      enrollment_history TEXT DEFAULT '[]',
      custom_fields TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE (school_id, student_number),
      FOREIGN KEY (school_id) REFERENCES schools(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (grade_level_id) REFERENCES grade_levels(id),
      FOREIGN KEY (section_id) REFERENCES sections(id),
      FOREIGN KEY (parent_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS grade_levels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      name_en TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      order_index INTEGER NOT NULL,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (school_id) REFERENCES schools(id)
    );

    CREATE TABLE IF NOT EXISTS sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      name_en TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      grade_level_id INTEGER NOT NULL,
      capacity INTEGER DEFAULT 30,
      homeroom_teacher_id INTEGER,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (school_id) REFERENCES schools(id),
      FOREIGN KEY (grade_level_id) REFERENCES grade_levels(id),
      FOREIGN KEY (homeroom_teacher_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      name_en TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      code TEXT,
      is_active INTEGER DEFAULT 1,
      UNIQUE (school_id, code),
      FOREIGN KEY (school_id) REFERENCES schools(id)
    );

    CREATE TABLE IF NOT EXISTS subject_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      section_id INTEGER NOT NULL,
      teacher_id INTEGER NOT NULL,
      academic_year TEXT NOT NULL,
      semester INTEGER NOT NULL CHECK(semester IN (1,2)),
      FOREIGN KEY (school_id) REFERENCES schools(id),
      FOREIGN KEY (subject_id) REFERENCES subjects(id),
      FOREIGN KEY (section_id) REFERENCES sections(id),
      FOREIGN KEY (teacher_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS grading_weights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      subject_id INTEGER,
      grade_level_id INTEGER,
      academic_year TEXT NOT NULL,
      semester INTEGER NOT NULL,
      quizzes_weight REAL DEFAULT 10,
      homework_weight REAL DEFAULT 10,
      participation_weight REAL DEFAULT 10,
      midterm_weight REAL DEFAULT 30,
      final_weight REAL DEFAULT 40,
      projects_weight REAL DEFAULT 0,
      FOREIGN KEY (school_id) REFERENCES schools(id),
      FOREIGN KEY (subject_id) REFERENCES subjects(id),
      FOREIGN KEY (grade_level_id) REFERENCES grade_levels(id)
    );

    CREATE TABLE IF NOT EXISTS grades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      academic_year TEXT NOT NULL,
      semester INTEGER NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('quiz','homework','participation','midterm','final','project')),
      score REAL,
      max_score REAL DEFAULT 100,
      title TEXT,
      notes TEXT,
      is_locked INTEGER DEFAULT 0,
      approved_by INTEGER,
      created_by INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (school_id) REFERENCES schools(id),
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (subject_id) REFERENCES subjects(id),
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (approved_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS report_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      academic_year TEXT NOT NULL,
      semester INTEGER NOT NULL,
      comment_en TEXT,
      comment_ar TEXT,
      teacher_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (school_id) REFERENCES schools(id),
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (subject_id) REFERENCES subjects(id),
      FOREIGN KEY (teacher_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      period INTEGER,
      status TEXT NOT NULL CHECK(status IN ('present','absent','late','excused')),
      notes TEXT,
      recorded_by INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (school_id) REFERENCES schools(id),
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (recorded_by) REFERENCES users(id),
      UNIQUE(student_id, date, period)
    );

    CREATE TABLE IF NOT EXISTS timetable (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      section_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      teacher_id INTEGER NOT NULL,
      day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 4),
      period INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      room TEXT,
      academic_year TEXT NOT NULL,
      semester INTEGER NOT NULL,
      is_published INTEGER DEFAULT 0,
      FOREIGN KEY (school_id) REFERENCES schools(id),
      FOREIGN KEY (section_id) REFERENCES sections(id),
      FOREIGN KEY (subject_id) REFERENCES subjects(id),
      FOREIGN KEY (teacher_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      subject_id INTEGER NOT NULL,
      section_id INTEGER NOT NULL,
      teacher_id INTEGER NOT NULL,
      due_date TEXT NOT NULL,
      max_score REAL DEFAULT 100,
      attachment TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (school_id) REFERENCES schools(id),
      FOREIGN KEY (subject_id) REFERENCES subjects(id),
      FOREIGN KEY (section_id) REFERENCES sections(id),
      FOREIGN KEY (teacher_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      assignment_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      content TEXT,
      attachment TEXT,
      score REAL,
      feedback TEXT,
      submitted_at TEXT DEFAULT (datetime('now')),
      graded_at TEXT,
      FOREIGN KEY (school_id) REFERENCES schools(id),
      FOREIGN KEY (assignment_id) REFERENCES assignments(id),
      FOREIGN KEY (student_id) REFERENCES students(id),
      UNIQUE(assignment_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER NOT NULL,
      student_id INTEGER,
      subject TEXT,
      body TEXT NOT NULL,
      attachment TEXT,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (school_id) REFERENCES schools(id),
      FOREIGN KEY (sender_id) REFERENCES users(id),
      FOREIGN KEY (receiver_id) REFERENCES users(id),
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    CREATE TABLE IF NOT EXISTS teacher_availability (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      teacher_id INTEGER NOT NULL,
      available_from TEXT DEFAULT '08:00',
      available_until TEXT DEFAULT '20:00',
      FOREIGN KEY (school_id) REFERENCES schools(id),
      FOREIGN KEY (teacher_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS bus_routes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      driver_id INTEGER,
      bus_number TEXT,
      capacity INTEGER DEFAULT 40,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (school_id) REFERENCES schools(id),
      FOREIGN KEY (driver_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS bus_stops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      route_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      name_ar TEXT,
      latitude REAL,
      longitude REAL,
      order_index INTEGER NOT NULL,
      estimated_time TEXT,
      FOREIGN KEY (school_id) REFERENCES schools(id),
      FOREIGN KEY (route_id) REFERENCES bus_routes(id)
    );

    CREATE TABLE IF NOT EXISTS student_bus (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      route_id INTEGER NOT NULL,
      stop_id INTEGER NOT NULL,
      FOREIGN KEY (school_id) REFERENCES schools(id),
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (route_id) REFERENCES bus_routes(id),
      FOREIGN KEY (stop_id) REFERENCES bus_stops(id)
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      title_ar TEXT,
      description TEXT,
      description_ar TEXT,
      event_type TEXT DEFAULT 'general' CHECK(event_type IN ('general','assembly','sports','trip','ramadan','graduation','parent_day','other')),
      start_date TEXT NOT NULL,
      end_date TEXT,
      location TEXT,
      requires_rsvp INTEGER DEFAULT 0,
      requires_permission INTEGER DEFAULT 0,
      fee REAL DEFAULT 0,
      max_participants INTEGER,
      attachment TEXT,
      created_by INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (school_id) REFERENCES schools(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS event_rsvps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      event_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined')),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (school_id) REFERENCES schools(id),
      FOREIGN KEY (event_id) REFERENCES events(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(event_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS clubs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      name_ar TEXT,
      description TEXT,
      supervisor_id INTEGER,
      meeting_schedule TEXT,
      max_members INTEGER,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (school_id) REFERENCES schools(id),
      FOREIGN KEY (supervisor_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS club_members (
      club_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      school_id INTEGER NOT NULL,
      joined_at TEXT DEFAULT (date('now')),
      PRIMARY KEY (club_id, student_id),
      FOREIGN KEY (school_id) REFERENCES schools(id),
      FOREIGN KEY (club_id) REFERENCES clubs(id),
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    CREATE TABLE IF NOT EXISTS staff_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      user_id INTEGER UNIQUE NOT NULL,
      employee_number TEXT,
      department TEXT,
      position TEXT,
      hire_date TEXT,
      contract_type TEXT CHECK(contract_type IN ('full_time','part_time','contract')),
      salary REAL,
      bank_account TEXT,
      annual_leave_balance REAL DEFAULT 14,
      sick_leave_balance REAL DEFAULT 10,
      emergency_leave_balance REAL DEFAULT 3,
      notes TEXT,
      UNIQUE (school_id, employee_number),
      FOREIGN KEY (school_id) REFERENCES schools(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS leave_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      leave_type TEXT NOT NULL CHECK(leave_type IN ('annual','sick','emergency','eid','maternity','unpaid')),
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
      approved_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (school_id) REFERENCES schools(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (approved_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS staff_attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      check_in TEXT,
      check_out TEXT,
      status TEXT DEFAULT 'present' CHECK(status IN ('present','absent','late','leave')),
      FOREIGN KEY (school_id) REFERENCES schools(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, date)
    );

    CREATE TABLE IF NOT EXISTS nurse_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      recorded_by INTEGER NOT NULL,
      incident_type TEXT CHECK(incident_type IN ('illness','injury','medication','other')),
      description TEXT NOT NULL,
      action_taken TEXT,
      parent_notified INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (school_id) REFERENCES schools(id),
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (recorded_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      type TEXT DEFAULT 'info',
      is_read INTEGER DEFAULT 0,
      link TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (school_id) REFERENCES schools(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Per-school settings
    CREATE TABLE IF NOT EXISTS settings (
      school_id INTEGER NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (school_id, key),
      FOREIGN KEY (school_id) REFERENCES schools(id)
    );

    CREATE TABLE IF NOT EXISTS student_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      doc_type TEXT NOT NULL CHECK(doc_type IN ('national_id','birth_certificate','medical_record','school_certificate','photo','other')),
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      uploaded_by INTEGER NOT NULL,
      uploaded_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (school_id) REFERENCES schools(id),
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS performance_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      reviewer_id INTEGER NOT NULL,
      academic_year TEXT NOT NULL,
      rating INTEGER CHECK(rating BETWEEN 1 AND 5),
      strengths TEXT,
      improvements TEXT,
      goals TEXT,
      comments TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (school_id) REFERENCES schools(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (reviewer_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS staff_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      doc_type TEXT NOT NULL CHECK(doc_type IN ('contract','certification','teaching_license','id_copy','resume','other')),
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      uploaded_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (school_id) REFERENCES schools(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS exam_timetable (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      grade_level_id INTEGER NOT NULL,
      exam_type TEXT NOT NULL CHECK(exam_type IN ('midterm','final')),
      exam_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      room TEXT,
      academic_year TEXT NOT NULL,
      semester INTEGER NOT NULL,
      invigilator_id INTEGER,
      FOREIGN KEY (school_id) REFERENCES schools(id),
      FOREIGN KEY (subject_id) REFERENCES subjects(id),
      FOREIGN KEY (grade_level_id) REFERENCES grade_levels(id),
      FOREIGN KEY (invigilator_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS substitute_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      original_teacher_id INTEGER NOT NULL,
      substitute_teacher_id INTEGER NOT NULL,
      timetable_slot_id INTEGER,
      date TEXT NOT NULL,
      reason TEXT,
      created_by INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (school_id) REFERENCES schools(id),
      FOREIGN KEY (original_teacher_id) REFERENCES users(id),
      FOREIGN KEY (substitute_teacher_id) REFERENCES users(id),
      FOREIGN KEY (timetable_slot_id) REFERENCES timetable(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS event_reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      event_id INTEGER NOT NULL,
      remind_at TEXT NOT NULL,
      sent INTEGER DEFAULT 0,
      FOREIGN KEY (school_id) REFERENCES schools(id),
      FOREIGN KEY (event_id) REFERENCES events(id)
    );

    CREATE TABLE IF NOT EXISTS event_media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      event_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      media_type TEXT DEFAULT 'photo' CHECK(media_type IN ('photo','video')),
      caption TEXT,
      uploaded_by INTEGER NOT NULL,
      uploaded_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (school_id) REFERENCES schools(id),
      FOREIGN KEY (event_id) REFERENCES events(id),
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS permission_slips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      event_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      parent_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','denied')),
      signed_at TEXT,
      FOREIGN KEY (school_id) REFERENCES schools(id),
      FOREIGN KEY (event_id) REFERENCES events(id),
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (parent_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS sports_teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      name_ar TEXT,
      sport TEXT NOT NULL,
      coach_id INTEGER,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (school_id) REFERENCES schools(id),
      FOREIGN KEY (coach_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS sports_fixtures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      team_id INTEGER NOT NULL,
      opponent TEXT NOT NULL,
      match_date TEXT NOT NULL,
      location TEXT,
      our_score INTEGER,
      opponent_score INTEGER,
      result TEXT CHECK(result IN ('win','loss','draw',NULL)),
      notes TEXT,
      FOREIGN KEY (school_id) REFERENCES schools(id),
      FOREIGN KEY (team_id) REFERENCES sports_teams(id)
    );

    CREATE TABLE IF NOT EXISTS bus_tracking (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      route_id INTEGER NOT NULL,
      event_type TEXT NOT NULL CHECK(event_type IN ('departed','arriving','boarded','dropped_off','delay')),
      student_id INTEGER,
      stop_id INTEGER,
      latitude REAL,
      longitude REAL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (school_id) REFERENCES schools(id),
      FOREIGN KEY (route_id) REFERENCES bus_routes(id),
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (stop_id) REFERENCES bus_stops(id)
    );
  `);

  seedSystemData();
}

export const DEFAULT_GRADE_LEVELS = [
  { name_en: 'KG 1', name_ar: 'روضة أولى', order: 1 },
  { name_en: 'KG 2', name_ar: 'روضة ثانية', order: 2 },
  { name_en: 'Grade 1', name_ar: 'الصف الأول', order: 3 },
  { name_en: 'Grade 2', name_ar: 'الصف الثاني', order: 4 },
  { name_en: 'Grade 3', name_ar: 'الصف الثالث', order: 5 },
  { name_en: 'Grade 4', name_ar: 'الصف الرابع', order: 6 },
  { name_en: 'Grade 5', name_ar: 'الصف الخامس', order: 7 },
  { name_en: 'Grade 6', name_ar: 'الصف السادس', order: 8 },
  { name_en: 'Grade 7', name_ar: 'الصف السابع', order: 9 },
  { name_en: 'Grade 8', name_ar: 'الصف الثامن', order: 10 },
  { name_en: 'Grade 9', name_ar: 'الصف التاسع', order: 11 },
  { name_en: 'Grade 10', name_ar: 'الصف العاشر', order: 12 },
  { name_en: 'Grade 11', name_ar: 'الصف الحادي عشر', order: 13 },
  { name_en: 'Grade 12', name_ar: 'الصف الثاني عشر', order: 14 },
];

export const DEFAULT_SUBJECTS = [
  { name_en: 'Arabic Language', name_ar: 'اللغة العربية', code: 'AR' },
  { name_en: 'English Language', name_ar: 'اللغة الإنجليزية', code: 'EN' },
  { name_en: 'Mathematics', name_ar: 'الرياضيات', code: 'MATH' },
  { name_en: 'Science', name_ar: 'العلوم', code: 'SCI' },
  { name_en: 'Islamic Education', name_ar: 'التربية الإسلامية', code: 'ISL' },
  { name_en: 'Social Studies', name_ar: 'الدراسات الاجتماعية', code: 'SOC' },
  { name_en: 'Physics', name_ar: 'الفيزياء', code: 'PHY' },
  { name_en: 'Chemistry', name_ar: 'الكيمياء', code: 'CHEM' },
  { name_en: 'Biology', name_ar: 'الأحياء', code: 'BIO' },
  { name_en: 'Computer Science', name_ar: 'علوم الحاسوب', code: 'CS' },
  { name_en: 'Physical Education', name_ar: 'التربية الرياضية', code: 'PE' },
  { name_en: 'Art', name_ar: 'التربية الفنية', code: 'ART' },
  { name_en: 'Music', name_ar: 'الموسيقى', code: 'MUS' },
  { name_en: 'National Education', name_ar: 'التربية الوطنية', code: 'NAT' },
  { name_en: 'Vocational Education', name_ar: 'التربية المهنية', code: 'VOC' },
];

export const DEFAULT_SETTINGS = {
  academic_year: '2025-2026',
  current_semester: '2',
  school_name_en: '',
  school_name_ar: '',
  work_days: 'Sun,Mon,Tue,Wed,Thu',
  periods_per_day: '8',
  period_duration: '45',
};

export function seedSchoolDefaults(schoolId, names = {}) {
  const insertGL = db.prepare('INSERT INTO grade_levels (school_id, name_en, name_ar, order_index) VALUES (?, ?, ?, ?)');
  for (const g of DEFAULT_GRADE_LEVELS) insertGL.run(schoolId, g.name_en, g.name_ar, g.order);

  const insertSubj = db.prepare('INSERT INTO subjects (school_id, name_en, name_ar, code) VALUES (?, ?, ?, ?)');
  for (const s of DEFAULT_SUBJECTS) insertSubj.run(schoolId, s.name_en, s.name_ar, s.code);

  const insertSection = db.prepare('INSERT INTO sections (school_id, name_en, name_ar, grade_level_id, capacity) VALUES (?, ?, ?, ?, ?)');
  const grades = db.prepare('SELECT id FROM grade_levels WHERE school_id = ? ORDER BY order_index').all(schoolId);
  for (const g of grades) {
    insertSection.run(schoolId, 'Section A', 'شعبة أ', g.id, 30);
    insertSection.run(schoolId, 'Section B', 'شعبة ب', g.id, 30);
  }

  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (school_id, key, value) VALUES (?, ?, ?)');
  const settings = { ...DEFAULT_SETTINGS, ...names };
  for (const [k, v] of Object.entries(settings)) insertSetting.run(schoolId, k, String(v));
}

function seedSystemData() {
  const existingRoles = db.prepare('SELECT COUNT(*) as count FROM roles').get();
  if (existingRoles.count > 0) return;

  const permissions = [
    { key: 'students.view', label_en: 'View Students', label_ar: 'عرض الطلاب', module: 'students' },
    { key: 'students.create', label_en: 'Create Students', label_ar: 'إضافة طلاب', module: 'students' },
    { key: 'students.edit', label_en: 'Edit Students', label_ar: 'تعديل الطلاب', module: 'students' },
    { key: 'students.delete', label_en: 'Delete Students', label_ar: 'حذف الطلاب', module: 'students' },
    { key: 'students.id_cards', label_en: 'Generate ID Cards', label_ar: 'إنشاء بطاقات الهوية', module: 'students' },
    { key: 'grades.view', label_en: 'View Grades', label_ar: 'عرض الدرجات', module: 'academics' },
    { key: 'grades.manage', label_en: 'Manage Grades', label_ar: 'إدارة الدرجات', module: 'academics' },
    { key: 'grades.approve', label_en: 'Approve Grades', label_ar: 'اعتماد الدرجات', module: 'academics' },
    { key: 'report_cards.view', label_en: 'View Report Cards', label_ar: 'عرض بطاقات التقرير', module: 'academics' },
    { key: 'report_cards.generate', label_en: 'Generate Report Cards', label_ar: 'إنشاء بطاقات التقرير', module: 'academics' },
    { key: 'attendance.view', label_en: 'View Attendance', label_ar: 'عرض الحضور', module: 'attendance' },
    { key: 'attendance.mark', label_en: 'Mark Attendance', label_ar: 'تسجيل الحضور', module: 'attendance' },
    { key: 'attendance.reports', label_en: 'Attendance Reports', label_ar: 'تقارير الحضور', module: 'attendance' },
    { key: 'timetable.view', label_en: 'View Timetable', label_ar: 'عرض الجدول', module: 'timetable' },
    { key: 'timetable.manage', label_en: 'Manage Timetable', label_ar: 'إدارة الجدول', module: 'timetable' },
    { key: 'assignments.view', label_en: 'View Assignments', label_ar: 'عرض الواجبات', module: 'assignments' },
    { key: 'assignments.create', label_en: 'Create Assignments', label_ar: 'إنشاء واجبات', module: 'assignments' },
    { key: 'assignments.grade', label_en: 'Grade Assignments', label_ar: 'تصحيح الواجبات', module: 'assignments' },
    { key: 'assignments.submit', label_en: 'Submit Assignments', label_ar: 'تسليم الواجبات', module: 'assignments' },
    { key: 'messages.send', label_en: 'Send Messages', label_ar: 'إرسال رسائل', module: 'communication' },
    { key: 'messages.view_all', label_en: 'View All Messages', label_ar: 'عرض جميع الرسائل', module: 'communication' },
    { key: 'transport.view', label_en: 'View Transportation', label_ar: 'عرض النقل', module: 'transport' },
    { key: 'transport.manage', label_en: 'Manage Transportation', label_ar: 'إدارة النقل', module: 'transport' },
    { key: 'transport.driver', label_en: 'Driver View', label_ar: 'عرض السائق', module: 'transport' },
    { key: 'events.view', label_en: 'View Events', label_ar: 'عرض الفعاليات', module: 'events' },
    { key: 'events.manage', label_en: 'Manage Events', label_ar: 'إدارة الفعاليات', module: 'events' },
    { key: 'events.rsvp', label_en: 'RSVP Events', label_ar: 'تأكيد حضور الفعاليات', module: 'events' },
    { key: 'clubs.view', label_en: 'View Clubs', label_ar: 'عرض الأندية', module: 'events' },
    { key: 'clubs.manage', label_en: 'Manage Clubs', label_ar: 'إدارة الأندية', module: 'events' },
    { key: 'staff.view', label_en: 'View Staff', label_ar: 'عرض الموظفين', module: 'hr' },
    { key: 'staff.manage', label_en: 'Manage Staff', label_ar: 'إدارة الموظفين', module: 'hr' },
    { key: 'leave.request', label_en: 'Request Leave', label_ar: 'طلب إجازة', module: 'hr' },
    { key: 'leave.approve', label_en: 'Approve Leave', label_ar: 'اعتماد الإجازات', module: 'hr' },
    { key: 'payroll.view', label_en: 'View Payroll', label_ar: 'عرض الرواتب', module: 'hr' },
    { key: 'payroll.manage', label_en: 'Manage Payroll', label_ar: 'إدارة الرواتب', module: 'hr' },
    { key: 'nurse.view', label_en: 'View Nurse Log', label_ar: 'عرض سجل التمريض', module: 'nurse' },
    { key: 'nurse.manage', label_en: 'Manage Nurse Log', label_ar: 'إدارة سجل التمريض', module: 'nurse' },
    { key: 'dashboard.principal', label_en: 'Principal Dashboard', label_ar: 'لوحة المدير', module: 'reports' },
    { key: 'reports.academic', label_en: 'Academic Reports', label_ar: 'التقارير الأكاديمية', module: 'reports' },
    { key: 'reports.attendance', label_en: 'Attendance Reports', label_ar: 'تقارير الحضور', module: 'reports' },
    { key: 'reports.enrollment', label_en: 'Enrollment Reports', label_ar: 'تقارير التسجيل', module: 'reports' },
    { key: 'reports.financial', label_en: 'Financial Reports', label_ar: 'التقارير المالية', module: 'reports' },
    { key: 'settings.manage', label_en: 'Manage Settings', label_ar: 'إدارة الإعدادات', module: 'settings' },
    { key: 'roles.manage', label_en: 'Manage Roles', label_ar: 'إدارة الأدوار', module: 'settings' },
    { key: 'users.manage', label_en: 'Manage Users', label_ar: 'إدارة المستخدمين', module: 'settings' },
    { key: 'grade_levels.manage', label_en: 'Manage Grade Levels', label_ar: 'إدارة المراحل الدراسية', module: 'settings' },
    { key: 'subjects.manage', label_en: 'Manage Subjects', label_ar: 'إدارة المواد', module: 'settings' },
    { key: 'schools.manage', label_en: 'Manage Schools', label_ar: 'إدارة المدارس', module: 'system' },
  ];

  const insertPerm = db.prepare('INSERT INTO permissions (key, label_en, label_ar, module) VALUES (?, ?, ?, ?)');
  for (const p of permissions) insertPerm.run(p.key, p.label_en, p.label_ar, p.module);

  const roles = [
    { key: 'super_admin', label_en: 'Super Admin', label_ar: 'المشرف العام' },
    { key: 'principal', label_en: 'Principal', label_ar: 'المدير' },
    { key: 'admin_staff', label_en: 'Admin Staff', label_ar: 'موظف إداري' },
    { key: 'teacher', label_en: 'Teacher', label_ar: 'معلم' },
    { key: 'student', label_en: 'Student', label_ar: 'طالب' },
    { key: 'parent', label_en: 'Parent', label_ar: 'ولي أمر' },
    { key: 'bus_driver', label_en: 'Bus Driver', label_ar: 'سائق الحافلة' },
    { key: 'nurse', label_en: 'Nurse', label_ar: 'ممرض/ة' },
    { key: 'hr_manager', label_en: 'HR Manager', label_ar: 'مدير الموارد البشرية' },
  ];

  const insertRole = db.prepare('INSERT INTO roles (key, label_en, label_ar, is_system) VALUES (?, ?, ?, 1)');
  for (const r of roles) insertRole.run(r.key, r.label_en, r.label_ar);

  const allPerms = db.prepare('SELECT id, key FROM permissions').all();
  const permMap = {};
  for (const p of allPerms) permMap[p.key] = p.id;

  const allRoles = db.prepare('SELECT id, key FROM roles').all();
  const roleMap = {};
  for (const r of allRoles) roleMap[r.key] = r.id;

  const rolePerms = {
    super_admin: Object.keys(permMap),
    principal: [
      'students.view', 'students.create', 'students.edit', 'students.delete', 'students.id_cards',
      'grades.view', 'grades.manage', 'grades.approve', 'report_cards.view', 'report_cards.generate',
      'attendance.view', 'attendance.mark', 'attendance.reports',
      'timetable.view', 'timetable.manage',
      'assignments.view', 'assignments.create', 'assignments.grade',
      'messages.send', 'messages.view_all',
      'transport.view', 'transport.manage',
      'events.view', 'events.manage', 'clubs.view', 'clubs.manage',
      'staff.view', 'staff.manage', 'leave.approve', 'payroll.view',
      'nurse.view', 'nurse.manage',
      'dashboard.principal', 'reports.academic', 'reports.attendance', 'reports.enrollment', 'reports.financial',
      'settings.manage', 'users.manage', 'grade_levels.manage', 'subjects.manage',
    ],
    admin_staff: [
      'students.view', 'students.create', 'students.edit', 'students.id_cards',
      'grades.view', 'report_cards.view',
      'attendance.view', 'attendance.reports',
      'timetable.view', 'timetable.manage',
      'assignments.view',
      'messages.send',
      'transport.view', 'transport.manage',
      'events.view', 'events.manage', 'clubs.view', 'clubs.manage',
      'staff.view',
      'nurse.view',
      'reports.attendance', 'reports.enrollment',
      'users.manage', 'grade_levels.manage', 'subjects.manage',
    ],
    teacher: [
      'students.view',
      'grades.view', 'grades.manage', 'report_cards.view',
      'attendance.view', 'attendance.mark',
      'timetable.view',
      'assignments.view', 'assignments.create', 'assignments.grade',
      'messages.send',
      'events.view', 'events.rsvp', 'clubs.view', 'clubs.manage',
      'leave.request',
    ],
    student: [
      'grades.view', 'report_cards.view',
      'attendance.view',
      'timetable.view',
      'assignments.view', 'assignments.submit',
      'messages.send',
      'events.view', 'events.rsvp', 'clubs.view',
    ],
    parent: [
      'students.view',
      'grades.view', 'report_cards.view',
      'attendance.view',
      'timetable.view',
      'assignments.view',
      'messages.send',
      'transport.view',
      'events.view', 'events.rsvp',
    ],
    bus_driver: ['transport.view', 'transport.driver'],
    nurse: ['students.view', 'nurse.view', 'nurse.manage'],
    hr_manager: [
      'staff.view', 'staff.manage',
      'leave.approve',
      'payroll.view', 'payroll.manage',
      'reports.financial',
    ],
  };

  const insertRolePerm = db.prepare('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
  for (const [roleKey, permKeys] of Object.entries(rolePerms)) {
    for (const permKey of permKeys) {
      if (permMap[permKey] && roleMap[roleKey]) {
        insertRolePerm.run(roleMap[roleKey], permMap[permKey]);
      }
    }
  }

  // Seed the single super_admin system user (no school_id)
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  db.prepare(`
    INSERT INTO users (school_id, phone, email, password, first_name, last_name, first_name_ar, last_name_ar, role_id)
    VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('962790000000', 'admin@schoolos.jo', hashedPassword, 'System', 'Admin', 'مدير', 'النظام', roleMap.super_admin);

  console.log('System data seeded. Default super_admin login: phone 962790000000, password admin123');
}

export default db;
