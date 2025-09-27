import { LogOut, Bell } from 'lucide-react';
import { useEffect, useState } from 'react';
import { API_BASE } from '../../api';
import  FullLogo  from './FullLogo-png.png';

interface TopBarProps {
  title: string;
  onLogout: () => void;
}

export function TopBar({ title, onLogout }: TopBarProps) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifOpen, setNotifOpen] = useState(false);

  async function fetchNotifications() {
    try {
      const raw = localStorage.getItem('onboardx_user');
      const user = raw ? JSON.parse(raw) : null;
      const email = user && user.email ? user.email : null;
      if (!email) return;
      const q = new URLSearchParams({ email });
      const url = `${API_BASE || ''}/api/notifications?` + q.toString();
      // debug
      console.debug('fetchNotifications ->', url);
      const r = await fetch(url);
      if (!r.ok) {
        const txt = await r.text().catch(() => '');
        console.warn('notifications fetch returned non-OK:', r.status, txt);
        return;
      }
      // try to parse JSON, but if server returned HTML we'll log the text for debugging
      let j: any = null;
      try {
        j = await r.json();
      } catch (e) {
        const txt = await r.text().catch(() => '');
        console.warn('fetchNotifications: response not JSON:', txt);
        return;
      }
  console.debug('notifications response', j);
      const list = (j && j.notifications) ? j.notifications : [];
      setNotifications(list);
      const unread = (j && typeof j.unreadCount === 'number') ? j.unreadCount : list.filter((n: any) => !n.read).length;
      setUnreadCount(unread);
    } catch (e) {
      console.warn('fetchNotifications failed', e);
    }
  }

  useEffect(() => {
    // only poll if distributor
    try {
      const raw = localStorage.getItem('onboardx_user');
      const user = raw ? JSON.parse(raw) : null;
      if (!user || user.role !== 'distributor') return;
    } catch (e) { return; }
    fetchNotifications();
    const iv = setInterval(fetchNotifications, 10000);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNotifOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => { clearInterval(iv); window.removeEventListener('keydown', onKey); };
  }, []);
  // Read user role once for render-time visibility decisions
  let currentUser: any = null;
  try { currentUser = JSON.parse(localStorage.getItem('onboardx_user') || 'null'); } catch (e) { currentUser = null; }
  const isContractView = (typeof window !== 'undefined') && window.location && window.location.pathname.startsWith('/contract/');

  return (
    <div className="topbar bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
          <div className="brand flex items-center gap-3">
          <div className="brand__logo w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg overflow-hidden bg-white/0">
            <img
              src={ FullLogo}
              alt="OnboardX"
              className="w-full h-full object-contain"
            />
          </div>
            <div className="brand__title text-xl font-semibold text-gray-800">
              {title}
            </div>
          </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {currentUser && currentUser.role === 'distributor' && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setNotifOpen(!notifOpen)}
              title="Notifications"
              style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <Bell size={18} />
            </button>
            {unreadCount > 0 && (
              <span style={{ position: 'absolute', top: -6, right: -6, background: '#ef4444', color: '#fff', borderRadius: 10, padding: '2px 6px', fontSize: 12 }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
        )}

        <button
          onClick={() => {
            if (isContractView) {
              // Go back to distributor listing (explicit navigation to avoid relying on history)
              window.location.href = '/distributor';
            } else {
              onLogout();
            }
          }}
          className="btn secondary flex items-center gap-2 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <LogOut size={18} />
          {isContractView ? 'Back' : 'Logout'}
        </button>
      </div>
      {notifOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }} onClick={() => setNotifOpen(false)}>
          {/* dimming overlay */}
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.2)' }} />
          <div style={{ position: 'absolute', right: 20, top: 72, width: 360, maxWidth: '90%' }} onClick={e => e.stopPropagation()}>
            <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
              <div style={{ padding: 12, borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>Notifications</strong>
                <div>
                  <button className="btn small secondary" onClick={async () => {
                    try {
                      const ids = notifications.map(n => n.id).filter(Boolean);
                      if (!ids.length) return;
                      // optimistic update
                      setUnreadCount(0);
                      await fetch(`${API_BASE || ''}/api/notifications/mark-read`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ ids }) });
                      await fetchNotifications();
                    } catch (e) { console.warn(e); }
                  }}>Mark all read</button>
                </div>
              </div>
              <div style={{ maxHeight: 360, overflow: 'auto', background: '#fff' }}>
                {notifications.length === 0 && (<div style={{ padding: 12 }} className="muted">No notifications</div>)}
                {notifications.map(n => (
                  <div key={n.id} style={{ padding: 12, borderBottom: '1px solid #f3f4f6', background: '#fff' }}>
                    <div className="small muted">From: {n.from || 'system'} • {new Date(n.createdAt).toLocaleString()}</div>
                    <div style={{ marginTop: 6 }}>{n.message}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}