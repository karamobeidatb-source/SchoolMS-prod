import { Router } from 'express';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import db from '../db/schema.js';
import { authenticate, requireSchool, requirePermission } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mediaStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, join(__dirname, '..', 'uploads', 'event-media')),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const uploadMedia = multer({ storage: mediaStorage, limits: { fileSize: 50 * 1024 * 1024 } });

const router = Router();

// ====== EVENTS ======

// GET /api/events
router.get('/api/events', authenticate, requireSchool, requirePermission('events.view'), (req, res) => {
  try {
    const { from_date, to_date, event_type, page = 1, limit = 25 } = req.query;
    const offset = (page - 1) * limit;
    let where = ['e.school_id = ?'];
    let params = [req.schoolId];

    if (from_date) { where.push('e.start_date >= ?'); params.push(from_date); }
    if (to_date) { where.push('e.start_date <= ?'); params.push(to_date); }
    if (event_type) { where.push('e.event_type = ?'); params.push(event_type); }

    const whereClause = where.join(' AND ');
    const total = db.prepare(`SELECT COUNT(*) as count FROM events e WHERE ${whereClause}`).get(...params).count;

    const events = db.prepare(`
      SELECT e.*, u.first_name as created_by_first_name, u.last_name as created_by_last_name,
             (SELECT COUNT(*) FROM event_rsvps WHERE event_id = e.id AND school_id = ? AND status = 'accepted') as rsvp_count
      FROM events e
      JOIN users u ON e.created_by = u.id
      WHERE ${whereClause}
      ORDER BY e.start_date DESC
      LIMIT ? OFFSET ?
    `).all(req.schoolId, ...params, Number(limit), Number(offset));

    res.json({ events, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/events/:id
router.get('/api/events/:id', authenticate, requireSchool, requirePermission('events.view'), (req, res) => {
  try {
    const event = db.prepare(`
      SELECT e.*, u.first_name as created_by_first_name, u.last_name as created_by_last_name
      FROM events e
      JOIN users u ON e.created_by = u.id
      WHERE e.id = ? AND e.school_id = ?
    `).get(req.params.id, req.schoolId);

    if (!event) return res.status(404).json({ error: 'Event not found' });

    const rsvps = db.prepare(`
      SELECT er.*, u.first_name, u.last_name, u.email
      FROM event_rsvps er
      JOIN users u ON er.user_id = u.id
      WHERE er.event_id = ? AND er.school_id = ?
    `).all(req.params.id, req.schoolId);

    // Check current user's RSVP status
    const myRsvp = rsvps.find(r => r.user_id === req.user.id);

    res.json({ ...event, rsvps, myRsvp: myRsvp || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/events
router.post('/api/events', authenticate, requireSchool, requirePermission('events.manage'), (req, res) => {
  try {
    const { title, title_ar, description, description_ar, event_type, start_date, end_date, location, requires_rsvp, requires_permission, fee, max_participants, attachment } = req.body;

    if (!title || !start_date) {
      return res.status(400).json({ error: 'title and start_date are required' });
    }

    const result = db.prepare(`
      INSERT INTO events (school_id, title, title_ar, description, description_ar, event_type, start_date, end_date,
        location, requires_rsvp, requires_permission, fee, max_participants, attachment, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.schoolId, title, title_ar, description, description_ar, event_type || 'general', start_date, end_date,
      location, requires_rsvp ? 1 : 0, requires_permission ? 1 : 0, fee || 0, max_participants, attachment, req.user.id);

    const event = db.prepare('SELECT * FROM events WHERE id = ? AND school_id = ?').get(result.lastInsertRowid, req.schoolId);
    res.status(201).json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/events/:id
router.put('/api/events/:id', authenticate, requireSchool, requirePermission('events.manage'), (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM events WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!existing) return res.status(404).json({ error: 'Event not found' });

    const { title, title_ar, description, description_ar, event_type, start_date, end_date, location, requires_rsvp, requires_permission, fee, max_participants, attachment } = req.body;

    db.prepare(`
      UPDATE events SET
        title = COALESCE(?, title), title_ar = COALESCE(?, title_ar),
        description = COALESCE(?, description), description_ar = COALESCE(?, description_ar),
        event_type = COALESCE(?, event_type), start_date = COALESCE(?, start_date),
        end_date = COALESCE(?, end_date), location = COALESCE(?, location),
        requires_rsvp = COALESCE(?, requires_rsvp), requires_permission = COALESCE(?, requires_permission),
        fee = COALESCE(?, fee), max_participants = COALESCE(?, max_participants),
        attachment = COALESCE(?, attachment)
      WHERE id = ? AND school_id = ?
    `).run(title, title_ar, description, description_ar, event_type, start_date, end_date, location,
      requires_rsvp !== undefined ? (requires_rsvp ? 1 : 0) : null, requires_permission !== undefined ? (requires_permission ? 1 : 0) : null,
      fee, max_participants, attachment, req.params.id, req.schoolId);

    const event = db.prepare('SELECT * FROM events WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/events/:id
router.delete('/api/events/:id', authenticate, requireSchool, requirePermission('events.manage'), (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM events WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!existing) return res.status(404).json({ error: 'Event not found' });

    db.prepare('DELETE FROM event_rsvps WHERE event_id = ? AND school_id = ?').run(req.params.id, req.schoolId);
    db.prepare('DELETE FROM events WHERE id = ? AND school_id = ?').run(req.params.id, req.schoolId);
    res.json({ message: 'Event deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/events/:id/rsvp
router.post('/api/events/:id/rsvp', authenticate, requireSchool, requirePermission('events.rsvp'), (req, res) => {
  try {
    const event = db.prepare('SELECT * FROM events WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const { status } = req.body;
    if (!status || !['accepted', 'declined'].includes(status)) {
      return res.status(400).json({ error: 'status must be "accepted" or "declined"' });
    }

    // Check max participants
    if (status === 'accepted' && event.max_participants) {
      const currentCount = db.prepare("SELECT COUNT(*) as count FROM event_rsvps WHERE event_id = ? AND school_id = ? AND status = 'accepted'").get(req.params.id, req.schoolId).count;
      if (currentCount >= event.max_participants) {
        return res.status(400).json({ error: 'Event is full' });
      }
    }

    // Upsert RSVP
    const existing = db.prepare('SELECT id FROM event_rsvps WHERE event_id = ? AND user_id = ? AND school_id = ?').get(req.params.id, req.user.id, req.schoolId);

    if (existing) {
      db.prepare('UPDATE event_rsvps SET status = ?, created_at = datetime("now") WHERE id = ? AND school_id = ?').run(status, existing.id, req.schoolId);
    } else {
      db.prepare('INSERT INTO event_rsvps (school_id, event_id, user_id, status) VALUES (?, ?, ?, ?)').run(req.schoolId, req.params.id, req.user.id, status);
    }

    res.json({ message: `RSVP ${status}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/events/:id/media - List event media/gallery
router.get('/api/events/:id/media', authenticate, requireSchool, requirePermission('events.view'), (req, res) => {
  try {
    const event = db.prepare('SELECT id FROM events WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const media = db.prepare(`
      SELECT em.*, u.first_name as uploaded_by_first_name, u.last_name as uploaded_by_last_name
      FROM event_media em
      JOIN users u ON em.uploaded_by = u.id
      WHERE em.event_id = ? AND em.school_id = ?
      ORDER BY em.uploaded_at DESC
    `).all(req.params.id, req.schoolId);

    res.json(media);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/events/:id/media - Upload event media
router.post('/api/events/:id/media', authenticate, requireSchool, requirePermission('events.manage'), uploadMedia.single('file'), (req, res) => {
  try {
    const event = db.prepare('SELECT id FROM events WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (!req.file) return res.status(400).json({ error: 'File is required' });

    const { media_type, caption } = req.body;

    const result = db.prepare(`
      INSERT INTO event_media (school_id, event_id, file_name, file_path, media_type, caption, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(req.schoolId, req.params.id, req.file.originalname, `/uploads/event-media/${req.file.filename}`, media_type || 'photo', caption, req.user.id);

    const media = db.prepare('SELECT * FROM event_media WHERE id = ? AND school_id = ?').get(result.lastInsertRowid, req.schoolId);
    res.status(201).json(media);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/events/:id/permission-slips - List permission slips
router.get('/api/events/:id/permission-slips', authenticate, requireSchool, requirePermission('events.view'), (req, res) => {
  try {
    const event = db.prepare('SELECT id FROM events WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    let where = ['ps.event_id = ?', 'ps.school_id = ?'];
    let params = [req.params.id, req.schoolId];

    // Parents can only see their own slips
    if (req.user.role_key === 'parent') {
      where.push('ps.parent_id = ?');
      params.push(req.user.id);
    }

    const slips = db.prepare(`
      SELECT ps.*, s.first_name as student_first_name, s.last_name as student_last_name, s.student_number,
             u.first_name as parent_first_name, u.last_name as parent_last_name
      FROM permission_slips ps
      JOIN students s ON ps.student_id = s.id
      JOIN users u ON ps.parent_id = u.id
      WHERE ${where.join(' AND ')}
      ORDER BY ps.id DESC
    `).all(...params);

    res.json(slips);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/events/:id/permission-slips - Create/sign permission slip
router.post('/api/events/:id/permission-slips', authenticate, requireSchool, (req, res) => {
  try {
    const event = db.prepare('SELECT id FROM events WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const { student_id, status } = req.body;
    if (!student_id) return res.status(400).json({ error: 'student_id is required' });

    const parent_id = req.user.id;

    // Check if slip already exists
    const existing = db.prepare('SELECT id FROM permission_slips WHERE event_id = ? AND student_id = ? AND parent_id = ? AND school_id = ?')
      .get(req.params.id, student_id, parent_id, req.schoolId);

    if (existing) {
      db.prepare('UPDATE permission_slips SET status = ?, signed_at = datetime("now") WHERE id = ? AND school_id = ?')
        .run(status || 'approved', existing.id, req.schoolId);
      const updated = db.prepare('SELECT * FROM permission_slips WHERE id = ? AND school_id = ?').get(existing.id, req.schoolId);
      return res.json(updated);
    }

    const result = db.prepare(`
      INSERT INTO permission_slips (school_id, event_id, student_id, parent_id, status, signed_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(req.schoolId, req.params.id, student_id, parent_id, status || 'approved');

    const slip = db.prepare('SELECT * FROM permission_slips WHERE id = ? AND school_id = ?').get(result.lastInsertRowid, req.schoolId);
    res.status(201).json(slip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====== SPORTS ======

// GET /api/sports-teams - List sports teams
router.get('/api/sports-teams', authenticate, requireSchool, requirePermission('events.view'), (req, res) => {
  try {
    const teams = db.prepare(`
      SELECT st.*, u.first_name as coach_first_name, u.last_name as coach_last_name
      FROM sports_teams st
      LEFT JOIN users u ON st.coach_id = u.id
      WHERE st.is_active = 1 AND st.school_id = ?
      ORDER BY st.sport, st.name
    `).all(req.schoolId);

    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sports-teams - Create team
router.post('/api/sports-teams', authenticate, requireSchool, requirePermission('events.manage'), (req, res) => {
  try {
    const { name, name_ar, sport, coach_id } = req.body;
    if (!name || !sport) return res.status(400).json({ error: 'name and sport are required' });

    const result = db.prepare(`
      INSERT INTO sports_teams (school_id, name, name_ar, sport, coach_id) VALUES (?, ?, ?, ?, ?)
    `).run(req.schoolId, name, name_ar, sport, coach_id || null);

    const team = db.prepare('SELECT * FROM sports_teams WHERE id = ? AND school_id = ?').get(result.lastInsertRowid, req.schoolId);
    res.status(201).json(team);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sports-teams/:id/fixtures - Get team fixtures
router.get('/api/sports-teams/:id/fixtures', authenticate, requireSchool, requirePermission('events.view'), (req, res) => {
  try {
    const team = db.prepare('SELECT * FROM sports_teams WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const fixtures = db.prepare(`
      SELECT * FROM sports_fixtures WHERE team_id = ? AND school_id = ? ORDER BY match_date DESC
    `).all(req.params.id, req.schoolId);

    res.json({ team, fixtures });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sports-fixtures - Create fixture
router.post('/api/sports-fixtures', authenticate, requireSchool, requirePermission('events.manage'), (req, res) => {
  try {
    const { team_id, opponent, match_date, location, our_score, opponent_score, result: matchResult, notes } = req.body;
    if (!team_id || !opponent || !match_date) {
      return res.status(400).json({ error: 'team_id, opponent, and match_date are required' });
    }

    // Verify team belongs to this school
    const team = db.prepare('SELECT id FROM sports_teams WHERE id = ? AND school_id = ?').get(team_id, req.schoolId);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const dbResult = db.prepare(`
      INSERT INTO sports_fixtures (school_id, team_id, opponent, match_date, location, our_score, opponent_score, result, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.schoolId, team_id, opponent, match_date, location, our_score, opponent_score, matchResult || null, notes);

    const fixture = db.prepare('SELECT * FROM sports_fixtures WHERE id = ? AND school_id = ?').get(dbResult.lastInsertRowid, req.schoolId);
    res.status(201).json(fixture);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/sports-fixtures/:id - Update fixture result
router.put('/api/sports-fixtures/:id', authenticate, requireSchool, requirePermission('events.manage'), (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM sports_fixtures WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!existing) return res.status(404).json({ error: 'Fixture not found' });

    const { opponent, match_date, location, our_score, opponent_score, result: matchResult, notes } = req.body;

    db.prepare(`
      UPDATE sports_fixtures SET
        opponent = COALESCE(?, opponent), match_date = COALESCE(?, match_date),
        location = COALESCE(?, location), our_score = COALESCE(?, our_score),
        opponent_score = COALESCE(?, opponent_score), result = COALESCE(?, result),
        notes = COALESCE(?, notes)
      WHERE id = ? AND school_id = ?
    `).run(opponent, match_date, location, our_score, opponent_score, matchResult, notes, req.params.id, req.schoolId);

    const fixture = db.prepare('SELECT * FROM sports_fixtures WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    res.json(fixture);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====== CLUBS ======

// GET /api/clubs
router.get('/api/clubs', authenticate, requireSchool, requirePermission('clubs.view'), (req, res) => {
  try {
    const student = db.prepare('SELECT id FROM students WHERE user_id = ? AND school_id = ?').get(req.user.id, req.schoolId);
    const studentId = student ? student.id : null;

    const clubs = db.prepare(`
      SELECT c.*, u.first_name || ' ' || u.last_name as supervisor_name,
             (SELECT COUNT(*) FROM club_members WHERE club_id = c.id AND school_id = ?) as member_count
      FROM clubs c
      LEFT JOIN users u ON c.supervisor_id = u.id
      WHERE c.is_active = 1 AND c.school_id = ?
      ORDER BY c.name
    `).all(req.schoolId, req.schoolId);

    const result = clubs.map(club => ({
      ...club,
      isMember: studentId ? !!db.prepare('SELECT 1 FROM club_members WHERE club_id = ? AND student_id = ? AND school_id = ?').get(club.id, studentId, req.schoolId) : false,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/clubs/:id
router.get('/api/clubs/:id', authenticate, requireSchool, requirePermission('clubs.view'), (req, res) => {
  try {
    const club = db.prepare(`
      SELECT c.*, u.first_name as supervisor_first_name, u.last_name as supervisor_last_name
      FROM clubs c
      LEFT JOIN users u ON c.supervisor_id = u.id
      WHERE c.id = ? AND c.school_id = ?
    `).get(req.params.id, req.schoolId);

    if (!club) return res.status(404).json({ error: 'Club not found' });

    const members = db.prepare(`
      SELECT cm.joined_at, s.id as student_id, s.first_name, s.last_name, s.student_number,
             gl.name_en as grade_name_en, sec.name_en as section_name_en
      FROM club_members cm
      JOIN students s ON cm.student_id = s.id
      LEFT JOIN grade_levels gl ON s.grade_level_id = gl.id
      LEFT JOIN sections sec ON s.section_id = sec.id
      WHERE cm.club_id = ? AND cm.school_id = ?
      ORDER BY s.last_name
    `).all(req.params.id, req.schoolId);

    res.json({ ...club, members });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/clubs
router.post('/api/clubs', authenticate, requireSchool, requirePermission('clubs.manage'), (req, res) => {
  try {
    const { name, name_ar, description, supervisor_id, meeting_schedule, max_members } = req.body;
    if (!name) return res.status(400).json({ error: 'Club name is required' });

    const result = db.prepare(`
      INSERT INTO clubs (school_id, name, name_ar, description, supervisor_id, meeting_schedule, max_members)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(req.schoolId, name, name_ar, description, supervisor_id || null, meeting_schedule, max_members);

    const club = db.prepare('SELECT * FROM clubs WHERE id = ? AND school_id = ?').get(result.lastInsertRowid, req.schoolId);
    res.status(201).json(club);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/clubs/:id
router.put('/api/clubs/:id', authenticate, requireSchool, requirePermission('clubs.manage'), (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM clubs WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!existing) return res.status(404).json({ error: 'Club not found' });

    const { name, name_ar, description, supervisor_id, meeting_schedule, max_members, is_active } = req.body;

    db.prepare(`
      UPDATE clubs SET
        name = COALESCE(?, name), name_ar = COALESCE(?, name_ar),
        description = COALESCE(?, description), supervisor_id = COALESCE(?, supervisor_id),
        meeting_schedule = COALESCE(?, meeting_schedule), max_members = COALESCE(?, max_members),
        is_active = COALESCE(?, is_active)
      WHERE id = ? AND school_id = ?
    `).run(name, name_ar, description, supervisor_id, meeting_schedule, max_members, is_active, req.params.id, req.schoolId);

    const club = db.prepare('SELECT * FROM clubs WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    res.json(club);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/clubs/:id/join
router.post('/api/clubs/:id/join', authenticate, requireSchool, (req, res) => {
  try {
    const club = db.prepare('SELECT * FROM clubs WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!club) return res.status(404).json({ error: 'Club not found' });

    // Determine student_id: from body (admin adding someone) or from current user
    let student_id = req.body.student_id;
    if (!student_id) {
      const student = db.prepare('SELECT id FROM students WHERE user_id = ? AND school_id = ?').get(req.user.id, req.schoolId);
      if (!student) return res.status(400).json({ error: 'Student record not found' });
      student_id = student.id;
    }

    // Check max members
    if (club.max_members) {
      const count = db.prepare('SELECT COUNT(*) as count FROM club_members WHERE club_id = ? AND school_id = ?').get(req.params.id, req.schoolId).count;
      if (count >= club.max_members) {
        return res.status(400).json({ error: 'Club is full' });
      }
    }

    db.prepare('INSERT OR IGNORE INTO club_members (school_id, club_id, student_id) VALUES (?, ?, ?)').run(req.schoolId, req.params.id, student_id);
    res.json({ message: 'Joined club successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/clubs/:id/leave/:studentId
router.delete('/api/clubs/:id/leave/:studentId', authenticate, requireSchool, (req, res) => {
  try {
    let studentId = req.params.studentId;
    if (studentId === 'me') {
      const student = db.prepare('SELECT id FROM students WHERE user_id = ? AND school_id = ?').get(req.user.id, req.schoolId);
      if (!student) return res.status(400).json({ error: 'Student record not found' });
      studentId = student.id;
    }
    db.prepare('DELETE FROM club_members WHERE club_id = ? AND student_id = ? AND school_id = ?').run(req.params.id, studentId, req.schoolId);
    res.json({ message: 'Left club successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====== EVENT REMINDERS ======

// GET /api/events/:id/reminders - Get all reminders for an event
router.get('/api/events/:id/reminders', authenticate, requireSchool, requirePermission('events.view'), (req, res) => {
  try {
    const event = db.prepare('SELECT id FROM events WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const reminders = db.prepare(`
      SELECT * FROM event_reminders WHERE event_id = ? AND school_id = ? ORDER BY remind_at ASC
    `).all(req.params.id, req.schoolId);

    res.json(reminders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/events/:id/reminders - Create a reminder for an event
router.post('/api/events/:id/reminders', authenticate, requireSchool, requirePermission('events.manage'), (req, res) => {
  try {
    const event = db.prepare('SELECT id FROM events WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const { remind_at, type } = req.body;
    if (!remind_at || !type) {
      return res.status(400).json({ error: 'remind_at and type are required' });
    }

    const result = db.prepare(`
      INSERT INTO event_reminders (school_id, event_id, remind_at, type) VALUES (?, ?, ?, ?)
    `).run(req.schoolId, req.params.id, remind_at, type);

    const reminder = db.prepare('SELECT * FROM event_reminders WHERE id = ? AND school_id = ?').get(result.lastInsertRowid, req.schoolId);
    res.status(201).json(reminder);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/event-reminders/pending - Get all unsent reminders where remind_at <= now
router.get('/api/event-reminders/pending', authenticate, requireSchool, requirePermission('events.manage'), (req, res) => {
  try {
    const reminders = db.prepare(`
      SELECT er.*, e.title, e.title_ar, e.start_date
      FROM event_reminders er
      JOIN events e ON er.event_id = e.id
      WHERE er.school_id = ? AND er.sent = 0 AND er.remind_at <= datetime('now')
      ORDER BY er.remind_at ASC
    `).all(req.schoolId);

    res.json(reminders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/event-reminders/:id/sent - Mark a reminder as sent
router.put('/api/event-reminders/:id/sent', authenticate, requireSchool, requirePermission('events.manage'), (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM event_reminders WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!existing) return res.status(404).json({ error: 'Reminder not found' });

    db.prepare('UPDATE event_reminders SET sent = 1 WHERE id = ? AND school_id = ?').run(req.params.id, req.schoolId);

    const reminder = db.prepare('SELECT * FROM event_reminders WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    res.json(reminder);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/event-reminders/:id - Delete a reminder
router.delete('/api/event-reminders/:id', authenticate, requireSchool, requirePermission('events.manage'), (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM event_reminders WHERE id = ? AND school_id = ?').get(req.params.id, req.schoolId);
    if (!existing) return res.status(404).json({ error: 'Reminder not found' });

    db.prepare('DELETE FROM event_reminders WHERE id = ? AND school_id = ?').run(req.params.id, req.schoolId);
    res.json({ message: 'Reminder deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
