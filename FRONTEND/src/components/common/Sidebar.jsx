import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Timer, History, BarChart2,
  Award, ShieldAlert, LogOut,
  FileText, Bell, GraduationCap, BookOpen, Clock, PieChart,
  Map, User, HelpCircle, Edit, ClipboardList, Settings
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './Sidebar.css';

const teacherNav = [
  { to: '/teacher',        icon: GraduationCap, label: 'Dashboard'     },
  { to: '/courses',        icon: BookOpen,      label: 'Courses'       },
  { to: '/assignments',    icon: FileText,      label: 'Assignments'   },
  { to: '/contributions',  icon: PieChart,      label: 'Contributions' },
  { to: '/analytics',      icon: BarChart2,     label: 'Analytics'     },
  { to: '/notifications',  icon: Bell,          label: 'Notifications' },
  { to: '/teacher/edits',  icon: ClipboardList, label: 'Edit Tracking' },
  { to: '/teacher/topics', icon: Settings,      label: 'Topic Manager' },
];

const adminNav = [
  { to: '/admin',         icon: ShieldAlert,   label: 'Admin Panel'   },
  { to: '/admin/edits',   icon: ClipboardList, label: 'Edit Tracking' },
  { to: '/admin/topics',  icon: Settings,      label: 'Topic Manager' },
];

function getInitials(name = '') {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

export default function Sidebar() {
  const { user, logout, isAdmin, isTeacher } = useAuth();
  const navigate = useNavigate();

  const studentNav = [
    { to: '/dashboard',             icon: LayoutDashboard, label: 'Dashboard'     },
    { to: '/focus',                 icon: Timer,           label: 'Focus Mode'    },
    { to: '/history',               icon: History,         label: 'History'       },
    { to: '/courses',               icon: BookOpen,        label: 'Courses'       },
    { to: '/assignments',           icon: FileText,        label: 'Assignments'   },
    { to: '/timetracker',           icon: Clock,           label: 'Time Tracker'  },
    { to: '/notifications',         icon: Bell,            label: 'Notifications' },
    { to: '/analytics',             icon: BarChart2,       label: 'Analytics'     },
    { to: '/certificates',          icon: Award,           label: 'Certificates'  },
    { to: '/curriculum',            icon: Map,             label: 'Curriculum'    },
    { to: `/portfolio/${user?.id}`, icon: User,            label: 'Portfolio'     },
    { to: '/question-bank',         icon: HelpCircle,      label: 'Question Bank' },
    { to: '/submit',                icon: Edit,            label: 'Submit Work'   },
  ];

  const navItems = isAdmin ? adminNav : isTeacher ? teacherNav : studentNav;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="logo-dot" />
        <span className="logo-text">SkillSync</span>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''}`
            }
          >
            <Icon size={16} strokeWidth={2} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="avatar avatar-sm">
            {user?.avatar_url
              ? <img src={user.avatar_url} alt={user.full_name} />
              : getInitials(user?.full_name)
            }
          </div>
          <div className="sidebar-user-info">
            <p className="sidebar-user-name">{user?.full_name}</p>
            <p className="sidebar-user-role">{user?.role}</p>
          </div>
        </div>
        <button className="sidebar-logout" onClick={handleLogout}>
          <LogOut size={15} />
        </button>
      </div>
    </aside>
  );
}
