# SchoolOS3 — Development Guide

## Project Overview
SchoolOS is a comprehensive school management platform built for Jordanian schools. It supports Arabic-first UI, role-based access control, and covers student management, academics, communication, transportation, events, HR, and reporting.

## Tech Stack
- **Frontend**: React 18 + Vite + Tailwind CSS + React Router
- **Backend**: Node.js + Express + SQLite (via better-sqlite3)
- **Auth**: JWT tokens with role-based permissions
- **Language**: JavaScript (ES modules)

## Architecture
- Permission-based UI: Every feature is a permission. Roles are collections of permissions. The sidebar/tabs render dynamically based on the logged-in user's role permissions.
- Roles: super_admin, principal, admin_staff, teacher, student, parent, bus_driver, nurse, hr_manager
- All API routes are protected by middleware that checks JWT + permission

## Project Structure
```
/server          — Express backend
  /db            — SQLite database and migrations
  /routes        — API route files grouped by module
  /middleware     — Auth, permission, error handling
  /utils         — Helpers (PDF gen, notifications, etc.)
  server.js      — Entry point

/client          — React frontend (Vite)
  /src
    /components  — Reusable UI components
    /pages       — Feature pages grouped by module
    /contexts    — React contexts (Auth, Theme)
    /hooks       — Custom hooks
    /utils       — Frontend helpers
    /layouts     — App layout, sidebar, topbar
    App.jsx      — Router setup
    main.jsx     — Entry point
```

## Conventions
- Use functional React components with hooks
- Use Tailwind utility classes for styling — no separate CSS files
- API routes prefixed with `/api/`
- All dates stored as ISO strings in SQLite
- Arabic is primary UI language; English fully supported
- Keep components small and focused
- Use consistent error handling patterns

## Commands
```bash
# Install all dependencies
cd server && npm install && cd ../client && npm install

# Run backend (port 5000)
cd server && npm run dev

# Run frontend (port 5173)
cd client && npm run dev
```

## Database
- SQLite file at `/server/db/schoolos.db`
- Schema created on first server start via migration
- Seeds default roles, permissions, and admin user

## Default Login
- Email: admin@schoolos.jo
- Password: admin123
