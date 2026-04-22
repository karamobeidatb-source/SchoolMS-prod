import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import dotenv from 'dotenv';
import { initDatabase } from './db/schema.js';

// Route imports
import authRoutes from './routes/auth.js';
import schoolRoutes from './routes/schools.js';
import studentRoutes from './routes/students.js';
import academicRoutes from './routes/academics.js';
import attendanceRoutes from './routes/attendance.js';
import timetableRoutes from './routes/timetable.js';
import assignmentRoutes from './routes/assignments.js';
import communicationRoutes from './routes/communication.js';
import transportRoutes from './routes/transport.js';
import eventRoutes from './routes/events.js';
import hrRoutes from './routes/hr.js';
import nurseRoutes from './routes/nurse.js';
import reportRoutes from './routes/reports.js';
import settingRoutes from './routes/settings.js';
import notificationRoutes from './routes/notifications.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure upload directories exist
const uploadDir = join(__dirname, 'uploads');
const uploadSubDirs = ['documents', 'staff-documents', 'event-media'];
if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
for (const sub of uploadSubDirs) {
  const dir = join(uploadDir, sub);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

// Serve uploaded files
app.use('/uploads', express.static(join(__dirname, 'uploads')));

// Initialize database
initDatabase();

// Mount routes
app.use(authRoutes);
app.use(schoolRoutes);
app.use(studentRoutes);
app.use(academicRoutes);
app.use(attendanceRoutes);
app.use(timetableRoutes);
app.use(assignmentRoutes);
app.use(communicationRoutes);
app.use(transportRoutes);
app.use(eventRoutes);
app.use(hrRoutes);
app.use(nurseRoutes);
app.use(reportRoutes);
app.use(settingRoutes);
app.use(notificationRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`SchoolOS server running on port ${PORT}`);
});

export default app;
