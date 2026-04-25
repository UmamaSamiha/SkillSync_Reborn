import { Bell } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from 'react-router-dom';
import './Topbar.css';

function getInitials(name = '') {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

const BREADCRUMBS = {
  '/dashboard': ['Dashboard'],
  '/focus':     ['Dashboard', 'Focus Mode'],
  '/history':   ['Dashboard', 'Focus Mode', 'Session History'],
  '/analytics': ['Dashboard', 'Analytics'],
  '/heatmap':   ['Dashboard', 'Projects', 'Heatmap'],
  '/portfolio': ['Dashboard', 'Portfolio'],
  '/certificates': ['Dashboard', 'Certificates'],
  '/admin':     ['Dashboard', 'Admin Panel'],
  '/settings':  ['Dashboard', 'Settings'],
};

export default function Topbar() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const crumbs = BREADCRUMBS[pathname] || ['Dashboard'];

  return (
    <header className="topbar">
      <div className="topbar-breadcrumb">
        {crumbs.map((crumb, i) => (
          <span key={i} style={{ display:'flex', alignItems:'center', gap:4 }}>
            {i > 0 && <span className="breadcrumb-sep">/</span>}
            <span className={i === crumbs.length - 1 ? 'breadcrumb-active' : 'breadcrumb-item'}>
              {crumb}
            </span>
          </span>
        ))}
      </div>

      <div className="topbar-right">
        <button className="topbar-notif">
          <Bell size={17} />
          <span className="notif-dot" />
        </button>
        <div className="avatar avatar-sm topbar-avatar">
          {user?.avatar_url
            ? <img src={user.avatar_url} alt={user?.full_name} />
            : getInitials(user?.full_name)
          }
        </div>
      </div>
    </header>
  );
}