import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/common/Sidebar';
import LoginPage from './pages/Login';
import HeatmapPage from './pages/Heatmap';
import FocusPage from './pages/Focus';
import HistoryPage from './pages/History';
import MemberDetailPage from './pages/MemberDetail';
import AdminDashboard from './pages/AdminDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import Certificates from './pages/Certificates';
import SignupPage from './pages/Signup';
import AnalyticsPage from './pages/AnalyticsPage';
import AssignmentsPage from './pages/Assignments';
import NotificationsPage from './pages/Notifications';
import CoursesPage from './pages/Courses';
import TimeTrackerPage from './pages/TimeTracker';
import ContributionsPage from './pages/Contributions';

function Layout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

function PrivateRoute({ children, adminOnly, teacherOnly }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 40 }}>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (adminOnly  && user.role !== 'admin')                          return <Navigate to="/" />;
  if (teacherOnly && user.role !== 'teacher' && user.role !== 'admin') return <Navigate to="/" />;
  return <Layout>{children}</Layout>;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 40 }}>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (user.role === 'admin')   return <Navigate to="/admin" />;
  if (user.role === 'teacher') return <Navigate to="/teacher" />;
  return <Navigate to="/dashboard" />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login"  element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/"       element={<HomeRedirect />} />

      {/* Student routes */}
      <Route path="/dashboard" element={
        <PrivateRoute><HeatmapPage /></PrivateRoute>
      }/>
      <Route path="/focus" element={
        <PrivateRoute><FocusPage /></PrivateRoute>
      }/>
      <Route path="/history" element={
        <PrivateRoute><HistoryPage /></PrivateRoute>
      }/>
      <Route path="/member/:userId" element={
        <PrivateRoute><MemberDetailPage /></PrivateRoute>
      }/>
      <Route path="/certificates" element={
        <PrivateRoute><Certificates /></PrivateRoute>
      }/>

      {/* Teacher routes */}
      <Route path="/teacher" element={
        <PrivateRoute teacherOnly={true}><TeacherDashboard /></PrivateRoute>
      }/>

      {/* Shared (student + teacher + admin) */}
      <Route path="/assignments" element={
        <PrivateRoute><AssignmentsPage /></PrivateRoute>
      }/>
      <Route path="/notifications" element={
        <PrivateRoute><NotificationsPage /></PrivateRoute>
      }/>
      <Route path="/analytics" element={
        <PrivateRoute><AnalyticsPage /></PrivateRoute>
      }/>

      {/* Shared feature routes */}
      <Route path="/courses" element={
        <PrivateRoute><CoursesPage /></PrivateRoute>
      }/>
      <Route path="/timetracker" element={
        <PrivateRoute><TimeTrackerPage /></PrivateRoute>
      }/>
      <Route path="/contributions" element={
        <PrivateRoute><ContributionsPage /></PrivateRoute>
      }/>

      {/* Admin routes */}
      <Route path="/admin" element={
        <PrivateRoute adminOnly={true}><AdminDashboard /></PrivateRoute>
      }/>

      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
