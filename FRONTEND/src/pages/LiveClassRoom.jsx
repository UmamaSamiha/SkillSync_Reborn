import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Square } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import './LiveClasses.css';

function loadJitsiScript(domain) {
  return new Promise((resolve, reject) => {
    if (window.JitsiMeetExternalAPI) return resolve();
    const existing = document.querySelector(`script[data-jitsi="${domain}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.src = `https://${domain}/external_api.js`;
    script.async = true;
    script.dataset.jitsi = domain;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

export default function LiveClassRoomPage() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { isTeacher, isAdmin } = useAuth();
  const canManage = isTeacher || isAdmin;

  const containerRef = useRef(null);
  const apiRef = useRef(null);
  const [joinInfo, setJoinInfo] = useState(null);
  const [status, setStatus] = useState('connecting'); // connecting | ready | error
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    let canceled = false;

    async function setup() {
      try {
        const res = await api.post(`/live-classes/${classId}/join`);
        const info = res.data?.data;
        if (canceled) return;
        setJoinInfo(info);

        await loadJitsiScript(info.jitsi_domain);
        if (canceled || !containerRef.current) return;

        const jitsiApi = new window.JitsiMeetExternalAPI(info.jitsi_domain, {
          roomName: info.room_name,
          parentNode: containerRef.current,
          userInfo: { displayName: info.display_name },
          configOverwrite: {
            prejoinPageEnabled: false,
            disableDeepLinking: true,
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
          },
        });
        apiRef.current = jitsiApi;
        setStatus('ready');

        jitsiApi.addEventListener('videoConferenceLeft', () => {
          api.post(`/live-classes/${classId}/leave`).catch(() => {});
          navigate('/live-classes');
        });
      } catch (err) {
        if (canceled) return;
        setStatus('error');
        toast.error(err.response?.data?.error || 'Could not join this class');
      }
    }

    setup();

    return () => {
      canceled = true;
      if (apiRef.current) {
        apiRef.current.dispose();
        apiRef.current = null;
      }
      api.post(`/live-classes/${classId}/leave`).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  const handleEnd = async () => {
    setEnding(true);
    try {
      await api.post(`/live-classes/${classId}/end`);
      toast.success('Class ended for everyone');
      navigate('/live-classes');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to end class');
      setEnding(false);
    }
  };

  return (
    <div className="live-room-page">
      <div className="flex-between live-room-header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/live-classes')}>
          <ArrowLeft size={14} /> Back
        </button>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontWeight: 600, fontFamily: 'var(--font-display)' }}>
            {joinInfo?.class?.title || 'Joining class...'}
          </p>
          <p className="text-xs text-muted">{joinInfo?.class?.course_code}</p>
        </div>
        {canManage && joinInfo?.is_moderator && (
          <button className="btn btn-secondary btn-sm" onClick={handleEnd} disabled={ending}>
            <Square size={13} /> {ending ? 'Ending...' : 'End class'}
          </button>
        )}
      </div>

      {status === 'error' && (
        <div className="text-center text-muted" style={{ padding: '80px 0' }}>
          <p>Couldn't connect to this class. It may have ended, or you may not have access.</p>
        </div>
      )}

      <div ref={containerRef} className="jitsi-container">
        {status === 'connecting' && (
          <div className="text-center" style={{ color: '#fff', paddingTop: 160 }}>
            Connecting to class...
          </div>
        )}
      </div>
    </div>
  );
}
