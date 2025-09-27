import { useEffect, useState } from 'react';
import { API_BASE } from '../../api';

const CHAT_BASE = (API_BASE ? API_BASE : '') + '/api/chat';
const CHAT_WELCOME = (API_BASE ? API_BASE : '') + '/api/chat/welcome';

export function FloatingRagButton() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<{ from: 'user'|'bot', text: string }[]>([]);

  useEffect(() => {
    // fetch welcome
    let mounted = true;
    (async () => {
      try {
        const r = await fetch(CHAT_WELCOME);
        if (!r.ok) return;
        const j = await r.json();
        if (!mounted) return;
        if (j && j.welcome) setMessages(m => [{ from: 'bot', text: j.welcome }, ...m]);
      } catch (e) {}
    })();
    return () => { mounted = false; };
  }, []);

  const send = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setMessages(m => [{ from: 'user', text }, ...m]);
    setInput('');
    setLoading(true);
    try {
  const r = await fetch(CHAT_BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text }) });
      const j = await r.json();
      setMessages(m => [{ from: 'bot', text: (j && j.reply) ? j.reply : 'No reply' }, ...m]);
    } catch (e) {
      setMessages(m => [{ from: 'bot', text: 'Network error' }, ...m]);
    } finally {
      setLoading(false);
    }
  };

  // Don't render on login route
  if (typeof window !== 'undefined' && window.location && window.location.pathname && window.location.pathname.startsWith('/login')) return null;

  return (
    <>
      <div style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 99999 }}>
        <button aria-label="Help" onClick={() => setOpen(true)} style={{ background: '#ef4444', color: '#fff', borderRadius: 999, width: 56, height: 56, border: 'none', boxShadow: '0 6px 18px rgba(0,0,0,0.18)', cursor: 'pointer', fontSize: 20 }}>
          💬
        </button>
      </div>

      {open && (
        <div style={{ position: 'fixed', right: 20, bottom: 88, zIndex: 99999, width: 360, maxWidth: '90%' }}>
          <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 8px 30px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
            <div style={{ padding: 10, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>Assist</strong>
              <div>
                <button onClick={() => { setOpen(false); }} className="btn secondary">Close</button>
              </div>
            </div>
            <div style={{ maxHeight: 300, overflow: 'auto', display: 'flex', flexDirection: 'column-reverse', padding: 10 }}>
              {messages.map((m, i) => (
                <div key={i} style={{ marginTop: 8, textAlign: m.from === 'user' ? 'right' : 'left' }}>
                  <div style={{ display: 'inline-block', background: m.from === 'user' ? '#fee2e2' : '#f3f4f6', color: '#111', padding: '8px 10px', borderRadius: 8, maxWidth: '100%' }}>{m.text}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: 10, borderTop: '1px solid #eee', display: 'flex', gap: 8 }}>
              <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask about onboarding or contracts" style={{ flex: 1, padding: '8px 10px', borderRadius: 6, border: '1px solid #e5e7eb' }} />
              <button onClick={send} disabled={loading} className="btn">{loading ? '...' : 'Send'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default FloatingRagButton;
