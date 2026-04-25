import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/common/Sidebar';
import LoginPage from './pages/Login';
import MemberDetailPage from './pages/MemberDetail';
import AdminDashboard from './pages/AdminDashboard';
import AdminEditDashboard from './pages/AdminEditDashboard';
import SignupPage from './pages/Signup';
import CurriculumPage from './pages/Curriculum';
import PortfolioPage from './pages/Portfolio';
import QuestionBankPage from './pages/QuestionBank';
import EditTracker from './pages/EditTracker';

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
  if (adminOnly && user.role !== 'admin') return <Navigate to="/dashboard" />;
  if (teacherOnly && user.role !== 'teacher' && user.role !== 'admin') return <Navigate to="/dashboard" />;
  return <Layout>{children}</Layout>;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 40 }}>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (user.role === 'admin') return <Navigate to="/admin" />;
  if (user.role === 'teacher') return <Navigate to="/teacher" />;
  return <Navigate to="/dashboard" />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login"  element={<LoginPage />} />
      <Route path="/"       element={<HomeRedirect />} />
      <Route path="/signup" element={<SignupPage />} />

      {/* Student Routes */}
      <Route path="/dashboard"         element={<PrivateRoute><CurriculumPage /></PrivateRoute>} />
      <Route path="/curriculum"        element={<PrivateRoute><CurriculumPage /></PrivateRoute>} />
      <Route path="/portfolio/:userId" element={<PrivateRoute><PortfolioPage /></PrivateRoute>} />
      <Route path="/question-bank"     element={<PrivateRoute><QuestionBankPage /></PrivateRoute>} />
      <Route path="/submit"            element={<PrivateRoute><EditTracker /></PrivateRoute>} />
      <Route path="/member/:userId"    element={<PrivateRoute><MemberDetailPage /></PrivateRoute>} />

      {/* Teacher Routes */}
      <Route path="/teacher"       element={<PrivateRoute teacherOnly><AdminDashboard /></PrivateRoute>} />
      <Route path="/teacher/edits" element={<PrivateRoute teacherOnly><AdminEditDashboard /></PrivateRoute>} />

      {/* Admin Routes */}
      <Route path="/admin"        element={<PrivateRoute adminOnly><AdminDashboard /></PrivateRoute>} />
      <Route path="/admin/edits"  element={<PrivateRoute adminOnly><AdminEditDashboard /></PrivateRoute>} />

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