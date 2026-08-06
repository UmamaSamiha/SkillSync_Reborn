import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/common/Sidebar';
import LoginPage from './pages/Login';
import HeatmapPage from './pages/Heatmap';
import LearningTwinPage from './pages/LearningTwin';
import MemberDetailPage from './pages/MemberDetail';
import AdminOverview from './pages/AdminOverview';
import AdminRisk from './pages/AdminRisk';
import AdminClassification from './pages/AdminClassification';
import AdminEngagement from './pages/AdminEngagement';
import AdminCertificates from './pages/AdminCertificates';
import AdminCourseApprovals from './pages/AdminCourseApprovals';
import AdminTeacherApprovals from './pages/AdminTeacherApprovals';
import AdminVerify from './pages/AdminVerify';
import TeacherDashboard from './pages/TeacherDashboard';
import TeacherPerformance from './pages/TeacherPerformance';
import Certificates from './pages/Certificates';
import SignupPage from './pages/Signup';
import AnalyticsPage from './pages/AnalyticsPage';
import AssignmentsPage from './pages/Assignments';
import AssignmentSubmissionsPage from './pages/AssignmentSubmissions';
import SubmissionViewPage from './pages/SubmissionView';
import NotificationsPage from './pages/Notifications';
import CoursesPage from './pages/Courses';
import CourseDetailPage from './pages/CourseDetail';
import TimeTrackerPage from './pages/TimeTracker';
import ContributionsPage from './pages/Contributions';
import LiveClassesPage from './pages/LiveClasses';
import LiveClassRoomPage from './pages/LiveClassRoom';

// Anushka's pages
import PortfolioPage from './pages/Portfolio';
import QuestionBankPage from './pages/QuestionBank';
import EditTracker from './pages/EditTracker';
import AdminEditDashboard from './pages/AdminEditDashboard';
import AdminTopicManager from './pages/AdminTopicManager';

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
  if (adminOnly  && user.role !== 'admin') return <Navigate to="/" />;
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
       <Route path="/heatmap" element={
        <PrivateRoute><HeatmapPage /></PrivateRoute>
      }/>
      <Route path="/learning-twin" element={
        <PrivateRoute><LearningTwinPage /></PrivateRoute>
      }/>

      <Route path="/member/:userId" element={
        <PrivateRoute><MemberDetailPage /></PrivateRoute>
      }/>
      <Route path="/certificates" element={
        <PrivateRoute><Certificates /></PrivateRoute>
      }/>

      {/* Anushka's student routes */}
      <Route path="/portfolio/:userId" element={
        <PrivateRoute><PortfolioPage /></PrivateRoute>
      }/>
      <Route path="/question-bank" element={
        <PrivateRoute><QuestionBankPage /></PrivateRoute>
      }/>
      <Route path="/submit" element={
        <PrivateRoute><EditTracker /></PrivateRoute>
      }/>

      {/* Teacher routes */}
      <Route path="/teacher" element={
        <PrivateRoute teacherOnly={true}><TeacherDashboard /></PrivateRoute>
      }/>
      <Route path="/teacher/performance" element={
        <PrivateRoute teacherOnly={true}><TeacherPerformance /></PrivateRoute>
      }/>

      {/* Anushka's teacher routes */}
      <Route path="/teacher/edits" element={
        <PrivateRoute teacherOnly={true}><AdminEditDashboard /></PrivateRoute>
      }/>
      <Route path="/teacher/topics" element={
        <PrivateRoute teacherOnly={true}><AdminTopicManager /></PrivateRoute>
      }/>

      {/* Shared (student + teacher + admin) */}
      {/* Shared routes */}
      <Route path="/assignments" element={
        <PrivateRoute><AssignmentsPage /></PrivateRoute>
      }/>
      <Route path="/assignments/:assignmentId" element={
        <PrivateRoute teacherOnly={true}><AssignmentSubmissionsPage /></PrivateRoute>
      }/>
      <Route path="/assignments/:assignmentId/submissions/:submissionId" element={
        <PrivateRoute teacherOnly={true}><SubmissionViewPage /></PrivateRoute>
      }/>
      <Route path="/notifications" element={
        <PrivateRoute><NotificationsPage /></PrivateRoute>
      }/>
      <Route path="/analytics" element={
        <PrivateRoute><AnalyticsPage /></PrivateRoute>
      }/>
      <Route path="/courses" element={
        <PrivateRoute><CoursesPage /></PrivateRoute>
      }/>
      <Route path="/courses/:courseId" element={
        <PrivateRoute><CourseDetailPage /></PrivateRoute>
      }/>
      <Route path="/timetracker" element={
        <PrivateRoute><TimeTrackerPage /></PrivateRoute>
      }/>
      <Route path="/contributions" element={
        <PrivateRoute><ContributionsPage /></PrivateRoute>
      }/>
      <Route path="/live-classes" element={
        <PrivateRoute><LiveClassesPage /></PrivateRoute>
      }/>
      <Route path="/live-classes/:classId/room" element={
        <PrivateRoute><LiveClassRoomPage /></PrivateRoute>
      }/>
  

      {/* Admin routes */}
      <Route path="/admin" element={
        <PrivateRoute adminOnly={true}><AdminOverview /></PrivateRoute>
      }/>
      <Route path="/admin/risk" element={
        <PrivateRoute adminOnly={true}><AdminRisk /></PrivateRoute>
      }/>
      <Route path="/admin/classification" element={
        <PrivateRoute adminOnly={true}><AdminClassification /></PrivateRoute>
      }/>
      <Route path="/admin/engagement" element={
        <PrivateRoute adminOnly={true}><AdminEngagement /></PrivateRoute>
      }/>
      <Route path="/admin/certificates" element={
        <PrivateRoute adminOnly={true}><AdminCertificates /></PrivateRoute>
      }/>
      <Route path="/admin/course-approvals" element={
        <PrivateRoute adminOnly={true}><AdminCourseApprovals /></PrivateRoute>
      }/>
      <Route path="/admin/teacher-approvals" element={
        <PrivateRoute adminOnly={true}><AdminTeacherApprovals /></PrivateRoute>
      }/>
      <Route path="/admin/verify" element={
        <PrivateRoute adminOnly={true}><AdminVerify /></PrivateRoute>
      }/>

      {/* Anushka's admin routes */}
      <Route path="/admin/edits" element={
        <PrivateRoute adminOnly={true}><AdminEditDashboard /></PrivateRoute>
      }/>
      <Route path="/admin/topics" element={
        <PrivateRoute adminOnly={true}><AdminTopicManager /></PrivateRoute>
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