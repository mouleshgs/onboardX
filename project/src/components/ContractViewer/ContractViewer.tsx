import React, { useEffect, useRef, useState } from 'react';
import CircularProgress from '../CircularProgress/CircularProgress';
import type { Contract, ContractAccess } from '../../types';
import api, { API_BASE } from '../../api';
import { TopBar } from '../Layout/TopBar';

interface Props {
  contractId: string;
}

export function ContractViewer({ contractId }: Props) {
  // sanitize incoming id: if someone navigated to /contract/<id>/pdf, only use the first segment
  const cleanId = contractId ? String(contractId).split('/')[0] : contractId;
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [signing, setSigning] = useState(false);
  const [access, setAccess] = useState<ContractAccess | null>(null);
  const [signedCompleted, setSignedCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

  useEffect(() => {
    fetchContract();
    // resize canvas to device pixel ratio
    const c = canvasRef.current;
    if (c) {
      const dpr = window.devicePixelRatio || 1;
      c.width = c.clientWidth * dpr;
      c.height = c.clientHeight * dpr;
      const ctx = c.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);
    }
  }, [contractId]);

  const fetchContract = async () => {
    setLoading(true);
    try {
  const res = await api.getContract(cleanId);
      if (!res.ok) throw new Error('Failed to load contract');
      const data = await res.json();
      setContract(data);
  setName(data && data.assignedToEmail ? data.assignedToEmail.split('@')[0] : '');
      // if contract is already signed, mark signedCompleted so buttons show
      if (data && data.status === 'signed') setSignedCompleted(true);
      // if contract already has access, fetch it
      if (data && data.access && data.access.unlocked) setAccess(data.access);
    } catch (e: any) {
      setError(e && e.message ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const startDraw = (e: React.PointerEvent) => {
    drawing.current = true;
    const c = canvasRef.current; if (!c) return;
    const rect = c.getBoundingClientRect();
    const ctx = c.getContext('2d'); if (!ctx) return;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 2.5; ctx.strokeStyle = '#111827';
    const x = (e.clientX - rect.left);
    const y = (e.clientY - rect.top);
    ctx.beginPath(); ctx.moveTo(x, y);
  };

  const draw = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const c = canvasRef.current; if (!c) return;
    const rect = c.getBoundingClientRect();
    const ctx = c.getContext('2d'); if (!ctx) return;
    const x = (e.clientX - rect.left);
    const y = (e.clientY - rect.top);
    ctx.lineTo(x, y); ctx.stroke();
  };

  const endDraw = () => { drawing.current = false; };

  const clearPad = () => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
  };

  const submitSignature = async () => {
    if (!contract) return;
    const c = canvasRef.current; if (!c) return alert('Please provide a signature');
    const dataUrl = c.toDataURL('image/png');
    setSigning(true);
    try {
      const payload = { contractId: contract.id, name: name || 'Signed', signatureDataUrl: dataUrl };
      const resp = await api.signContract(payload);
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error((j && (j.detail || j.error)) || 'Signing failed');
      }
      const j = await resp.json();
      // server returns metadata and possibly access
      const meta = j && j.metadata;
      const prevProgress = access ? access.progress || 0 : 0;
      if (meta && meta.access) {
        setAccess(meta.access);
        const newProgress = meta.access.progress || 0;
        // if signing moved progress across the 30% threshold, trigger confetti
        try { if (prevProgress < 30 && newProgress >= 30) doConfetti(); } catch (e) {}
      }
      setSignedCompleted(true);
      // refresh contract state
      await fetchContract();
      alert('Signed successfully — access tools generated if configured');
    } catch (e: any) {
      alert('Signing error: ' + (e && e.message ? e.message : 'unknown'));
    } finally {
      setSigning(false);
    }
  };

  const doConfetti = () => {
    // Canvas-based confetti adapted from the provided snippet.
    try {
      const duration = 4000; // ms
      const maxConfettis = 150;
      const possibleColors = [
        '#ef4444', '#f87171', '#fca5a5', '#fecaca', '#f97316', '#fb923c', '#ef4444', '#ef4444', '#fca5a5', '#f87171', '#f87171', '#ef4444', '#b91c1c'
      ];

      let W = window.innerWidth;
      let H = window.innerHeight;
      const canvas = document.createElement('canvas');
      canvas.id = 'confetti-canvas';
      canvas.style.position = 'fixed';
      canvas.style.left = '0';
      canvas.style.top = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '9999';
      document.body.appendChild(canvas);
  const context = canvas.getContext('2d');
  if (!context) return;

      canvas.width = W;
      canvas.height = H;

      function randomFromTo(from: number, to: number) {
        return Math.floor(Math.random() * (to - from + 1) + from);
      }

  function ConfettiParticle(this: any) {
        this.x = Math.random() * W;
        this.y = Math.random() * H - H;
        this.r = randomFromTo(11, 33);
        this.d = Math.random() * maxConfettis + 11;
        this.color = possibleColors[Math.floor(Math.random() * possibleColors.length)];
        this.tilt = Math.floor(Math.random() * 33) - 11;
        this.tiltAngleIncremental = Math.random() * 0.07 + 0.05;
        this.tiltAngle = 0;

        this.draw = function() {
          if (!context) return;
          context.beginPath();
          context.lineWidth = this.r / 2;
          context.strokeStyle = this.color;
          context.moveTo(this.x + this.tilt + this.r / 3, this.y);
          context.lineTo(this.x + this.tilt, this.y + this.tilt + this.r / 5);
          context.stroke();
        };
      }

      const particles: any[] = [];
      for (let i = 0; i < maxConfettis; i++) particles.push(new (ConfettiParticle as any)());

      let stop = false;
      let animId: number | null = null;
      const start = Date.now();

      function resize() {
        W = window.innerWidth; H = window.innerHeight;
        canvas.width = W; canvas.height = H;
      }

      function draw() {
        if (stop) return;
        animId = requestAnimationFrame(draw);
  if (!context) return;
  context.clearRect(0, 0, W, H);
        for (let i = 0; i < maxConfettis; i++) {
          particles[i].draw();
        }
        for (let i = 0; i < maxConfettis; i++) {
          const p = particles[i];
          p.tiltAngle += p.tiltAngleIncremental;
          p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2;
          p.tilt = Math.sin(p.tiltAngle - i / 3) * 15;
          if (p.x > W + 30 || p.x < -30 || p.y > H) {
            p.x = Math.random() * W;
            p.y = -30;
            p.tilt = Math.floor(Math.random() * 10) - 20;
          }
        }
        // stop after duration
        if (Date.now() - start > duration) {
          // let it run a little more to finish falling
          stop = true;
          setTimeout(() => {
            if (animId) cancelAnimationFrame(animId);
            window.removeEventListener('resize', resize);
            try { canvas.remove(); } catch (e) {}
          }, 1000);
        }
      }

      window.addEventListener('resize', resize);
      draw();

    } catch (e) { console.error(e); }
  };

  const fetchAccess = async () => {
    if (!contract) return;
    try {
      const resp = await api.getAccess(contract.id);
      if (!resp.ok) throw new Error('No access yet');
      const data = await resp.json();
  setAccess(data.access || null);
    } catch (e) {
      // ignore
    }
  };

  // click handlers are wired inline for each access tool in the render

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-red-600 border-t-transparent"></div>
    </div>
  );

  if (!contract) return <div className="p-8">{error || 'Contract not found'}</div>;

  return (
    <div className="app-shell min-h-screen">
      <TopBar title={`Contract ${contract.id}`} onLogout={() => { window.location.href = '/login'; }} />
      <div className="grid mt-6">
        <div className="panel">
          <h3 className="text-lg font-semibold mb-4">{contract.originalName || contract.id}</h3>
          <div className="viewer">
            <div className="pdf-frame">
              <iframe title="contract-pdf" src={`${API_BASE || ''}/contract/${encodeURIComponent(cleanId)}/pdf`} style={{ width: '100%', height: '100%', border: '0' }} />
            </div>
          </div>
        </div>

        <div className="panel">
          <h4 className="text-lg font-semibold mb-3">Sign & Onboarding</h4>
          <div className={`sig-card ${contract.status === 'signed' ? 'signed' : ''}`}>
            {contract.status === 'signed' ? (
              <div className="small">This contract was already signed at {contract.signedAt}</div>
            ) : (
              <>
                <label className="small">Printed name</label>
                <input value={name} onChange={e => setName(e.target.value)} className="sig-controls" type="text" />
                <label className="small mt-2">Signature</label>
                <canvas
                  id="sigPad"
                  ref={canvasRef}
                  onPointerDown={startDraw}
                  onPointerMove={draw}
                  onPointerUp={endDraw}
                  onPointerLeave={endDraw}
                  style={{ width: '100%', height: 140, touchAction: 'none', borderRadius: 8 }}
                />
                <div className="sig-actions mt-2">
                  <button onClick={clearPad} className="btn secondary">Clear</button>
                  <button onClick={submitSignature} disabled={signing} className="btn">{signing ? 'Signing...' : 'Sign & Submit'}</button>
                </div>
              </>
            )}

            {(signedCompleted || (contract && contract.status === 'signed')) && (
              <div className="mt-4">
                <button onClick={fetchAccess} className="btn secondary mr-2">Refresh Access</button>
                <button onClick={async () => {
                  if (!contract) return;
                  try {
                    // download signed pdf from backend
                    const resp = await fetch(`${API_BASE || ''}/contract/${encodeURIComponent(contract.id)}/pdf`);
                    if (!resp.ok) throw new Error('Failed to fetch PDF');
                    const blob = await resp.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    const fn = (contract.originalName || contract.id || 'contract') + '.pdf';
                    a.download = fn;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    window.URL.revokeObjectURL(url);
                  } catch (e: any) {
                    alert('Download failed: ' + (e && e.message ? e.message : 'unknown'));
                  }
                }} className="btn secondary">Download Signed PDF</button>
              </div>
            )}

            {access && (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <CircularProgress value={access.progress || 0} size={72} strokeWidth={3.5} durationMs={650} />
                  <div>
                    <div style={{ fontWeight:700, fontSize:18 }}>{Math.round(access.progress || 0)}%</div>
                    <div className="small muted">Onboarding progress</div>
                  </div>
                </div>

                <div style={{ marginTop: 10 }} className="access-list">
                  {access.tools && access.tools.map((t, i) => (
                    <div key={i} className="access-item mt-2" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ fontWeight: 600 }}>{t.name}</div>
                      <div>
                        <button onClick={async () => {
                          try {
                            // Post relevant events based on tool type
                            if (/slack/i.test(t.name)) {
                              await api.postEvent(contract.id, 'slack_visited');
                              await fetchAccess();
                              try { doConfetti(); } catch (e) {}
                              window.open(t.url, '_blank');
                              return;
                            }
                            if (/onboarding course/i.test(t.name) || /notion/i.test(t.name)) {
                              await api.postEvent(contract.id, 'notion_completed');
                              await fetchAccess();
                              try { doConfetti(); } catch (e) {}
                              window.open(t.url, '_blank');
                              return;
                            }
                            if (/work dashboard/i.test(t.name)) {
                              if ((access.progress || 0) === 100) {
                                window.open(t.url, '_blank');
                              } else {
                                alert('Please complete onboarding to access Work Dashboard');
                              }
                              return;
                            }
                            // default behaviour: open link without showing raw URL
                            window.open(t.url, '_blank');
                          } catch (e) { console.error(e); }
                        }} className="btn small">Open</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ContractViewer;
