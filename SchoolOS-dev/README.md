# SchoolOS

A comprehensive school management platform built for Jordanian schools. Covers student management, academics, attendance, timetables, assignments, communication, transportation, events, HR, and reporting — all behind a role-based permission system.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5, Tailwind CSS 3, React Router 6 |
| Backend | Node.js, Express 4, SQLite (better-sqlite3) |
| Auth | JWT with role-based permissions |

## Prerequisites

- **Node.js** v18 or higher
- **npm** v9 or higher

No external database setup needed — SQLite runs embedded.

## Quick Start

### 1. Clone and install dependencies

```bash
# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

### 2. Start the backend

Open a terminal and run:

```bash
cd server
npm run dev
```

The API server starts on **http://localhost:5000**. On first launch it automatically:
- Creates the SQLite database at `server/db/schoolos.db`
- Runs all schema migrations (30+ tables)
- Seeds roles, permissions, grade levels (KG1–G12), Jordanian curriculum subjects, and demo users

### 3. Start the frontend

Open a second terminal and run:

```bash
cd client
npx vite --port 5173
```

> **Note:** If your global Vite version is incompatible with your Node version, use the local binary instead:
> ```bash
> cd client
> ./node_modules/.bin/vite --port 5173
> ```

The frontend starts on **http://localhost:5173** and proxies all `/api` requests to the backend.

### 4. Open the app

Go to **http://localhost:5173** in your browser.

## Default Login

Login is by **phone number** (no `+` prefix).

| Role | Phone | Password |
|------|-------|----------|
| Super Admin | `962790000000` | `admin123` |

The super admin can create schools and additional users (teachers, parents, students, staff) from the Settings area. Each role sees a different set of sidebar tabs based on their permissions.

## Project Structure

```
SchoolOS3/
├── server/                   # Express backend
│   ├── server.js             # Entry point
│   ├── db/
│   │   └── schema.js         # Database schema, migrations, seed data
│   ├── middleware/
│   │   └── auth.js           # JWT authentication & permission checks
│   ├── routes/
│   │   ├── auth.js           # Login, profile
│   │   ├── students.js       # Student CRUD, search, siblings, stats
│   │   ├── academics.js      # Grades, report cards, grading weights
│   │   ├── attendance.js     # Daily/bulk attendance, reports
│   │   ├── timetable.js      # Schedule builder, conflict detection
│   │   ├── assignments.js    # Homework posting, submissions, grading
│   │   ├── communication.js  # Parent-teacher messaging
│   │   ├── transport.js      # Bus routes, stops, manifests
│   │   ├── events.js         # Events, RSVPs, clubs
│   │   ├── hr.js             # Staff records, leave, payroll
│   │   ├── nurse.js          # Health incident log
│   │   ├── reports.js        # Dashboard & analytics
│   │   └── settings.js       # School config, roles, users, subjects
│   └── utils/                # Helper functions
│
├── client/                   # React frontend
│   ├── src/
│   │   ├── main.jsx          # App entry point
│   │   ├── App.jsx           # Router configuration
│   │   ├── contexts/
│   │   │   └── AuthContext.jsx  # Auth state, login/logout, permissions
│   │   ├── layouts/
│   │   │   └── AppLayout.jsx    # Sidebar, topbar, permission-based nav
│   │   ├── components/       # Reusable UI (DataTable, Modal, Badge, etc.)
│   │   ├── pages/            # Feature pages grouped by module
│   │   └── utils/
│   │       └── api.js        # Axios instance with JWT interceptor
│   └── index.html
│
├── CLAUDE.md                 # Development guide
└── PROGRESS.md               # Feature completion tracker
```

## Features

### Student Management
- Student enrollment with full profiles (personal, medical, contact info)
- Class and section assignment with enrollment history
- Sibling linking — one parent account covers multiple children
- Search, filter by grade/section/status, pagination
- Student ID card generation

### Academics
- Gradebook with inline score editing per section/subject
- Configurable grading weights (quizzes, homework, participation, midterm, final, projects)
- Grade locking and principal approval workflow
- Report card generation with teacher comments
- Jordanian National Curriculum subjects pre-loaded

### Attendance
- Daily and per-period attendance marking
- One-tap bulk attendance (mark all present)
- Color-coded status indicators (present/absent/late/excused)
- Attendance statistics and reports by date range

### Timetable
- Weekly grid view (Sunday–Thursday, Jordanian work week)
- Color-coded subjects
- Conflict detection (teacher double-booked, room occupied)
- Personal schedule view per user role

### Homework & Assignments
- Teachers post assignments with due dates
- Students submit work digitally
- Teacher grading and feedback within the platform
- Overdue assignment tracking

### Communication
- Structured parent-teacher messaging
- Inbox/sent views with conversation threads
- User search for starting new conversations
- Unread message indicators with auto-refresh

### Transportation
- Bus route creation with stops
- Student-to-route assignment
- Daily manifest (auto-removes absent students)
- Route capacity management

### Events & Clubs
- School event calendar with RSVP
- Multiple event types (sports, trips, assemblies, Ramadan, graduation)
- Extracurricular club management with join/leave
- Member rosters and meeting schedules

### Staff & HR
- Staff directory with HR records
- Leave request and approval workflow
- Staff attendance tracking
- Payroll summary view

### Nurse Log
- Health incident recording (illness, injury, medication)
- Student health history
- Parent notification tracking

### Reports & Dashboard
- Principal dashboard with real-time school snapshot
- Academic performance reports by student/class/subject
- Attendance reports with date range filtering
- Enrollment statistics by grade level

### Settings & Administration
- School-wide settings (name, academic year, semester, work days)
- Grade levels and sections management
- Subject management
- User account management
- Role and permission editor

## Roles & Permissions

The system has 9 built-in roles with 47 granular permissions:

| Role | Access |
|------|--------|
| **Super Admin** | Full access to everything |
| **Principal** | All academic, student, staff, and reporting features |
| **Admin Staff** | Student management, timetables, transport, events |
| **Teacher** | Grades, attendance, assignments, messaging, leave requests |
| **Student** | View own grades/attendance, submit assignments, messaging |
| **Parent** | View children's grades/attendance, messaging, transport tracking |
| **Bus Driver** | Transport manifest and route view |
| **Nurse** | Student health records and nurse log |
| **HR Manager** | Staff records, leave approval, payroll |

The sidebar dynamically shows only the tabs each role has permission to access.

## Resetting the Database

To start fresh with a clean database and re-seeded demo data:

```bash
rm server/db/schoolos.db
# Restart the backend — it will recreate and reseed automatically
cd server && npm run dev
```

## API Overview

All API routes are under `/api/` and require a JWT token (except login). The token is passed via the `Authorization: Bearer <token>` header.

```
POST   /api/auth/login          # Get JWT token
GET    /api/auth/me             # Current user + permissions
GET    /api/students            # List students (paginated, filterable)
GET    /api/grades              # Query grades
POST   /api/attendance/bulk     # Mark attendance for a section
GET    /api/timetable           # Get schedule
GET    /api/assignments         # List assignments
GET    /api/messages            # Inbox/sent messages
GET    /api/transport/routes    # Bus routes
GET    /api/events              # School events
GET    /api/clubs               # Extracurricular clubs
GET    /api/staff               # Staff directory
GET    /api/leave-requests      # Leave requests
GET    /api/nurse-log           # Health records
GET    /api/reports/dashboard   # Principal dashboard data
GET    /api/settings            # School configuration
GET    /api/roles               # Roles with permissions
```

See the route files in `server/routes/` for the full API reference.
