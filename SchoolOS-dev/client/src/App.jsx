import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoadingSpinner from './components/LoadingSpinner';
import AppLayout from './layouts/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SchoolsList from './pages/schools/SchoolsList';
import StudentList from './pages/students/StudentList';
import StudentForm from './pages/students/StudentForm';
import StudentDetail from './pages/students/StudentDetail';
import AttendancePage from './pages/attendance/AttendancePage';
import AttendanceReports from './pages/attendance/AttendanceReports';
import GradebookPage from './pages/academics/GradebookPage';
import ReportCardPage from './pages/academics/ReportCardPage';
import TimetablePage from './pages/timetable/TimetablePage';
import AssignmentList from './pages/assignments/AssignmentList';
import AssignmentDetail from './pages/assignments/AssignmentDetail';
import MessagesPage from './pages/communication/MessagesPage';
import TransportPage from './pages/transport/TransportPage';
import EventsPage from './pages/events/EventsPage';
import ClubsPage from './pages/events/ClubsPage';
import NurseLogPage from './pages/nurse/NurseLogPage';
import StaffPage from './pages/hr/StaffPage';
import LeaveRequestsPage from './pages/hr/LeaveRequestsPage';
import ReportsPage from './pages/reports/ReportsPage';
import SettingsPage from './pages/settings/SettingsPage';

function AppRoutes() {
  const { user, loading, needsSchool, isSuperAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Where to send a freshly-authenticated user
  const homePath = isSuperAdmin ? '/schools' : '/dashboard';

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={homePath} replace /> : <Login />} />

      {/* Super admin has not picked a school yet → schools list is the ONLY accessible page */}
      <Route path="/schools" element={
        !user ? <Navigate to="/login" replace /> :
        !isSuperAdmin ? <Navigate to="/dashboard" replace /> :
        <SchoolsList />
      } />

      {/* All other authenticated routes require a school context */}
      <Route element={
        !user ? <Navigate to="/login" replace /> :
        needsSchool ? <Navigate to="/schools" replace /> :
        <AppLayout />
      }>
        <Route path="/dashboard" element={<Dashboard />} />

        <Route path="/students" element={<ProtectedRoute permission="students.view"><StudentList /></ProtectedRoute>} />
        <Route path="/students/new" element={<ProtectedRoute permission="students.create"><StudentForm /></ProtectedRoute>} />
        <Route path="/students/:id" element={<ProtectedRoute permission="students.view"><StudentDetail /></ProtectedRoute>} />
        <Route path="/students/:id/edit" element={<ProtectedRoute permission="students.edit"><StudentForm /></ProtectedRoute>} />

        <Route path="/attendance" element={<ProtectedRoute permission="attendance.mark"><AttendancePage /></ProtectedRoute>} />
        <Route path="/attendance/reports" element={<ProtectedRoute permission="attendance.view"><AttendanceReports /></ProtectedRoute>} />

        <Route path="/gradebook" element={<ProtectedRoute permission="grades.view"><GradebookPage /></ProtectedRoute>} />
        <Route path="/report-card" element={<ProtectedRoute permission="grades.view"><ReportCardPage /></ProtectedRoute>} />

        <Route path="/timetable" element={<ProtectedRoute permission="timetable.view"><TimetablePage /></ProtectedRoute>} />

        <Route path="/assignments" element={<ProtectedRoute permission="assignments.view"><AssignmentList /></ProtectedRoute>} />
        <Route path="/assignments/:id" element={<ProtectedRoute permission="assignments.view"><AssignmentDetail /></ProtectedRoute>} />

        <Route path="/messages" element={<ProtectedRoute permission="messages.send"><MessagesPage /></ProtectedRoute>} />

        <Route path="/transport" element={<ProtectedRoute permission="transport.view"><TransportPage /></ProtectedRoute>} />

        <Route path="/events" element={<ProtectedRoute permission="events.view"><EventsPage /></ProtectedRoute>} />
        <Route path="/clubs" element={<ProtectedRoute permission="clubs.view"><ClubsPage /></ProtectedRoute>} />

        <Route path="/nurse" element={<ProtectedRoute permission="nurse.view"><NurseLogPage /></ProtectedRoute>} />

        <Route path="/staff" element={<ProtectedRoute permission="staff.view"><StaffPage /></ProtectedRoute>} />
        <Route path="/leave" element={<ProtectedRoute permission="leave.request"><LeaveRequestsPage /></ProtectedRoute>} />

        <Route path="/reports" element={<ProtectedRoute permission="reports.academic"><ReportsPage /></ProtectedRoute>} />

        <Route path="/settings" element={<ProtectedRoute permission="settings.manage"><SettingsPage /></ProtectedRoute>} />

        <Route path="/" element={<Navigate to={homePath} replace />} />
        <Route path="*" element={<Navigate to={homePath} replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
