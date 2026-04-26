import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import './Sidebar.css';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
    navigate('/login');
  };

  const studentLinks = [
    { to: '/dashboard',             label: 'Dashboard',    icon: '▦' },
    { to: '/curriculum',            label: 'Learning Path', icon: '🎯' },
    { to: `/portfolio/${user?.id}`, label: 'Portfolio',     icon: '🎓' },
    { to: '/question-bank',         label: 'Question Bank', icon: '📚' },
    { to: '/submit',                label: 'Submit Work',   icon: '📝' },
  ];

  const teacherLinks = [
    { to: '/teacher',       label: 'Dashboard',     icon: '▦' },
    { to: '/teacher/edits', label: 'Edit Tracking', icon: '🔍' },
    { to: '/question-bank', label: 'Question Bank', icon: '📚' },
  ];

  const adminLinks = [
    { to: '/admin',         label: 'Admin Panel',   icon: '⚙' },
    { to: '/admin/edits',   label: 'Edit Tracking', icon: '🔍' },
    { to: '/question-bank', label: 'Question Bank', icon: '📚' },
  ];

  const links =
    user?.role === 'admin'   ? adminLinks   :
    user?.role === 'teacher' ? teacherLinks :
    studentLinks;

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="logo-dot" />
        <span className="sidebar-logo-text">SkillSync</span>
      </div>
      <nav className="sidebar-nav">
        {links.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            <span className="sidebar-icon">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">
            {user?.full_name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user?.full_name}</span>
            <span className="sidebar-user-role">{user?.role}</span>
          </div>
        </div>
        <button className="sidebar-logout" onClick={handleLogout}>↩ Logout</button>
      </div>
    </aside>
  );
}