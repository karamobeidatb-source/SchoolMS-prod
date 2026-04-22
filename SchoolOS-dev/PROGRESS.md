# SchoolOS3 — Progress Tracker

## Phase 1: Foundation
- [x] Project structure (React + Vite + Express + SQLite)
- [x] Database schema and migrations (30+ tables)
- [x] Auth system (JWT, login, roles)
- [x] Permission system and role-permission mapping (47 permissions, 9 roles)
- [x] App shell: sidebar, topbar, routing, permission-gated tabs

## Phase 2: Core Modules
- [x] Student Management (profiles, enrollment, class assignment, sibling linking, ID cards, custom fields)
- [x] Attendance (daily/per-period, bulk marking, parent notifications, reports)
- [x] Gradebook (multi-curriculum, grading weights, grade locking, report cards, trend charts)
- [x] Timetable & Scheduling (weekly grid builder, conflict detection, substitute assignment)
- [x] Homework & Assignments (post, submit, grade, calendar, overdue alerts)

## Phase 3: Communication & Operations
- [x] Parent-Teacher Chat (structured messaging, availability hours, admin oversight)
- [x] Transportation (routes, stops, manifests, student assignment, driver view)
- [x] Events & Activities (calendar, RSVP, event types, clubs, sports)
- [x] Staff & HR (profiles, attendance, leave requests, payroll, performance reviews)

## Phase 4: Reports & Analytics
- [x] Principal Dashboard (real-time snapshot)
- [x] Academic Reports (performance by student/class/subject)
- [x] Attendance Reports (daily/weekly/monthly)
- [x] Enrollment Reports
- [x] Quarterly & Annual Reports
- [x] PDF/Excel export (placeholders ready)

## Status
All phases complete. Application builds and runs successfully.

## How to Run
```bash
# Terminal 1 — Backend (port 5000)
cd server && npm run dev

# Terminal 2 — Frontend (port 5173)
cd client && ./node_modules/.bin/vite --port 5173
```

## Default Logins
| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@schoolos.jo | admin123 |
| Teacher | teacher@schoolos.jo | teacher123 |
| Parent | parent@schoolos.jo | parent123 |
| Student | student1@schoolos.jo | student123 |
