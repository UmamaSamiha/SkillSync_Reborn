import { useState, useEffect } from 'react';
import { Bell, Check, CheckCheck, Trash2 } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import './Notifications.css';

const FILTERS = [
  { id: 'all',        label: 'All'         },
  { id: 'unread',     label: 'Unread'      },
  { id: 'deadline',   label: 'Deadlines'   },
  { id: 'grade',      label: 'Grades'      },
  { id: 'submission', label: 'Submissions' },
];

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [filter,        setFilter]        = useState('all');
  const [loading,       setLoading]       = useState(true);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ per_page: '50' });
      if (filter === 'unread') params.append('unread', 'true');
      else if (filter !== 'all') params.append('type', filter);

      const res = await api.get(`/notifications/?${params.toString()}`);
      setNotifications(res.data.data.items || []);
      setUnreadCount(res.data.data.unread_count || 0);
    } catch {
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotifications(); /* eslint-disable-next-line */ }, [filter]);

  const markRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      fetchNotifications();
    } catch { toast.error('Failed to mark as read'); }
  };

  const markAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      fetchNotifications();
      toast.success('All marked as read');
    } catch { toast.error('Failed to mark all as read'); }
  };

  const deleteOne = async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      fetchNotifications();
    } catch { toast.error('Failed to delete'); }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'deadline':   return 'badge-warning';
      case 'grade':      return 'badge-success';
      case 'submission': return 'badge-info';
      default:           return 'badge-neutral';
    }
  };

  return (
    <div className="notifications-page">
      <div className="flex-between mb-24">
        <h1 style={{ fontFamily: 'var(--font-display)' }}>
          Notifications
          {unreadCount > 0 && (
            <span className="badge badge-danger" style={{ marginLeft: 12, fontSize: '0.75rem' }}>
              {unreadCount} new
            </span>
          )}
        </h1>
        {unreadCount > 0 && (
          <button className="btn btn-sm btn-secondary" onClick={markAllRead}>
            <CheckCheck size={14} /> Mark all read
          </button>
        )}
      </div>

      <div className="notification-filters">
        {FILTERS.map(f => (
          <button key={f.id}
            className={`filter-chip ${filter === f.id ? 'active' : ''}`}
            onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-muted" style={{ padding: 60 }}>Loading...</div>
      ) : (
        <div className="notifications-list">
          {notifications.map(n => (
            <div key={n.id} className={`notification-item card ${!n.is_read ? 'unread' : ''}`}>
              <div className="notification-content">
                <div className="flex-between">
                  <p className="notification-title">{n.title}</p>
                  <span className={`badge ${getTypeColor(n.type)}`}>{n.type}</span>
                </div>
                <p className="text-sm text-muted" style={{ marginTop: 4 }}>{n.message}</p>
                <p className="text-xs text-muted" style={{ marginTop: 6 }}>
                  {new Date(n.created_at).toLocaleString()}
                </p>
              </div>
              <div className="notification-actions">
                {!n.is_read && (
                  <button className="btn btn-sm btn-ghost" onClick={() => markRead(n.id)}>
                    <Check size={14} /> Read
                  </button>
                )}
                <button className="btn btn-sm btn-ghost" onClick={() => deleteOne(n.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}

          {notifications.length === 0 && (
            <div className="text-center text-muted" style={{ padding: 60 }}>
              <Bell size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
              <p>{filter === 'all' ? 'No notifications yet.' : `No ${filter} notifications.`}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
