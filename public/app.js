(async function(){
  // Enforce simple role-based routing: distributor users can access this page.
  try {
    const raw = localStorage.getItem('onboardx_user');
    if (!raw) return window.location.replace('/login.html');
    const user = JSON.parse(raw);
    if (!user || !user.role) return window.location.replace('/login.html');
    if (user.role !== 'distributor') return window.location.replace('/vendor.html');
  } catch (e) {
    return window.location.replace('/login.html');
  }

  const el = id => document.getElementById(id);
  const contractsDiv = el('contracts');
  const viewer = el('viewer');
  const pdfFrame = el('pdfFrame');
  const nameInput = el('name');
  const statusDiv = el('status');
  const accessBtn = el('accessBtn');
  const accessModal = el('accessModal');
  const accessContent = el('accessContent');
  const accessClose = el('accessClose');
  const refreshBtn = el('refreshBtn');

  const signedCountEl = el('signedCount');

  // search box (placed in the topbar if available)
  let searchInput = document.querySelector('.topbar input[type=text]');
  if (!searchInput) {
    searchInput = document.createElement('input');
    searchInput.placeholder = 'Search by contract id or filename';
    searchInput.style.padding = '8px';
    searchInput.style.borderRadius = '8px';
    searchInput.style.border = '1px solid #eef2ff';
    const topbar = document.querySelector('.topbar');
    if (topbar) topbar.appendChild(searchInput);
  }
  // ensure there's a logout button
  const logoutBtn = document.createElement('button');
  logoutBtn.textContent = 'Logout';
  logoutBtn.className = 'btn secondary';
  logoutBtn.style.marginLeft = '8px';
  logoutBtn.addEventListener('click', ()=>{ localStorage.removeItem('onboardx_user'); window.location.replace('/login.html'); });
  const topbar = document.querySelector('.topbar');
  if (topbar) topbar.appendChild(logoutBtn);

  // Minimal notification bell (top-right) — purely UI, no server calls
  // Creates a bell button with an unread count badge. Non-intrusive and safe.
  try {
    if (topbar) {
      const notifWrap = document.createElement('div');
      notifWrap.style.display = 'inline-block';
      notifWrap.style.position = 'relative';
      notifWrap.style.marginLeft = '12px';

      const bell = document.createElement('button');
      bell.className = 'btn';
      bell.title = 'Notifications';
      bell.style.padding = '6px 8px';
      bell.style.fontSize = '16px';
      bell.textContent = '🔔';

      const badge = document.createElement('span');
      badge.style.position = 'absolute';
      badge.style.top = '-6px';
      badge.style.right = '-6px';
      badge.style.minWidth = '18px';
      badge.style.height = '18px';
      badge.style.lineHeight = '18px';
      badge.style.borderRadius = '9px';
      badge.style.background = '#e11d48';
      badge.style.color = '#fff';
      badge.style.fontSize = '12px';
      badge.style.textAlign = 'center';
      badge.style.padding = '0 5px';
      badge.style.display = 'none'; // hidden when zero
      badge.textContent = '0';

      notifWrap.appendChild(bell);
      notifWrap.appendChild(badge);
      topbar.appendChild(notifWrap);

      // Expose a helper to update the badge from other scripts if needed
      window.__onboardx_setNotifCount = function(n) {
        try {
          const count = Number(n) || 0;
          if (count <= 0) { badge.style.display = 'none'; }
          else { badge.style.display = 'inline-block'; badge.textContent = String(count > 99 ? '99+' : count); }
        } catch (e) {}
      };
      // create notifications modal (hidden)
      const notifModal = document.createElement('div');
      notifModal.style.position = 'fixed';
      notifModal.style.left = '0';
      notifModal.style.top = '0';
      notifModal.style.width = '100%';
      notifModal.style.height = '100%';
      notifModal.style.display = 'none';
      notifModal.style.alignItems = 'center';
      notifModal.style.justifyContent = 'center';
      notifModal.style.background = 'rgba(0,0,0,0.4)';
      notifModal.style.zIndex = '9999';
      notifModal.innerHTML = `<div style="max-width:640px;width:90%;background:#fff;border-radius:8px;padding:16px;box-shadow:0 8px 24px rgba(0,0,0,0.2)">` +
        `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px"><strong>Notifications</strong><button id="__notifClose" class="btn secondary">Close</button></div>` +
        `<div id="__notifList" style="max-height:360px;overflow:auto"></div>` +
        `<div style="text-align:right;margin-top:12px"><button id="__markRead" class="btn">Mark all read</button></div>` +
        `</div>`;
      document.body.appendChild(notifModal);
      const notifListEl = notifModal.querySelector('#__notifList');
      const notifClose = notifModal.querySelector('#__notifClose');
      const markReadBtn = notifModal.querySelector('#__markRead');

      let __lastNotifications = [];

      async function fetchNotifications() {
        try {
          const raw = localStorage.getItem('onboardx_user');
          const user = raw ? JSON.parse(raw) : null;
          const email = user && user.email ? user.email : null;
          if (!email) return;
          const q = new URLSearchParams({ email });
          const r = await fetch('/api/notifications?' + q.toString());
          if (!r.ok) return;
          const j = await r.json();
          const list = (j && j.notifications) ? j.notifications : [];
          __lastNotifications = list;
          // update badge
          const unread = (j && typeof j.unreadCount === 'number') ? j.unreadCount : list.filter(n=>!n.read).length;
          window.__onboardx_setNotifCount(unread);
          // populate modal list if open
          if (notifModal.style.display !== 'none') {
            notifListEl.innerHTML = '';
            if (!list.length) notifListEl.innerHTML = '<div class="muted">No notifications</div>';
            list.forEach(n => {
              const item = document.createElement('div'); item.className = 'card';
              const who = document.createElement('div'); who.className = 'small muted'; who.textContent = `From: ${n.from || 'vendor'} • ${new Date(n.createdAt).toLocaleString()}`;
              const msg = document.createElement('div'); msg.style.marginTop = '6px'; msg.textContent = n.message || '';
              if (!n.read) { item.style.borderLeft = '4px solid #e11d48'; item.style.paddingLeft = '8px'; }
              item.appendChild(who); item.appendChild(msg); notifListEl.appendChild(item);
            });
          }
        } catch (e) { console.warn('fetchNotifications failed', e && e.message); }
      }

      // open modal when bell clicked
      bell.addEventListener('click', async ()=>{
        notifModal.style.display = 'flex';
        await fetchNotifications();
      });

      notifClose.addEventListener('click', ()=>{ notifModal.style.display = 'none'; });

      // mark all read
      markReadBtn.addEventListener('click', async ()=>{
        try {
          const ids = (__lastNotifications || []).map(n => n.id).filter(Boolean);
          if (!ids.length) return;
          await fetch('/api/notifications/mark-read', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ ids }) });
          // refresh
          await fetchNotifications();
        } catch (e) { console.warn('markRead failed', e && e.message); }
      });

      // poll unread count periodically
      setInterval(()=>{ fetchNotifications(); }, 10000);

      // Floating RAG chat button and modal for static distributor app
      (function(){
        const wrap = document.createElement('div');
        wrap.style.position = 'fixed'; wrap.style.right = '20px'; wrap.style.bottom = '20px'; wrap.style.zIndex = '99999';
        const btn = document.createElement('button'); btn.textContent = '💬'; btn.title='Ask OnboardX'; btn.style.width='56px'; btn.style.height='56px'; btn.style.borderRadius='999px'; btn.style.border='none'; btn.style.background='#ef4444'; btn.style.color='#fff'; btn.style.fontSize='20px'; btn.style.cursor='pointer'; btn.style.boxShadow='0 6px 18px rgba(0,0,0,0.18)';
        wrap.appendChild(btn); document.body.appendChild(wrap);
        const modal = document.createElement('div'); modal.style.position='fixed'; modal.style.right='20px'; modal.style.bottom='88px'; modal.style.zIndex='99999'; modal.style.width='360px'; modal.style.maxWidth='90%'; modal.style.display='none';
        modal.innerHTML = `<div style="background:#fff;border-radius:8px;box-shadow:0 8px 30px rgba(0,0,0,0.18);overflow:hidden">
          <div style="padding:10px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center"><strong>Assist</strong><button id="__chatClose2" class="btn secondary">Close</button></div>
          <div id="__chatList2" style="max-height:300px;overflow:auto;display:flex;flex-direction:column-reverse;padding:10px"></div>
          <div style="padding:10px;border-top:1px solid #eee;display:flex;gap:8px"><input id="__chatInput2" placeholder="Ask about onboarding or contracts" style="flex:1;padding:8px 10px;border-radius:6px;border:1px solid #e5e7eb" /><button id="__chatSend2" class="btn">Send</button></div>
        </div>`;
        document.body.appendChild(modal);
  btn.addEventListener('click', async ()=>{ modal.style.display='block'; try{ let r = await fetch('/api/chat/welcome'); let j = null; if (r.ok) { try { j = await r.json(); } catch(e) { j = null; } } if (!j) { console.warn('/api/chat/welcome relative fetch failed; retrying http://localhost:3000'); try { r = await fetch('http://localhost:3000/api/chat/welcome'); if (r.ok) j = await r.json(); } catch(e) { console.error('welcome fallback failed', e); } } if (j && j.welcome) { const list = modal.querySelector('#__chatList2'); const item = document.createElement('div'); item.style.marginTop='8px'; item.style.textAlign='left'; const b = document.createElement('div'); b.style.display='inline-block'; b.style.background='#f3f4f6'; b.style.padding='8px 10px'; b.style.borderRadius='8px'; b.textContent = j.welcome; item.appendChild(b); list.insertBefore(item, list.firstChild); } }catch(e){ console.error('welcome fetch failed', e); } });
        modal.querySelector('#__chatClose2').addEventListener('click', ()=>{ modal.style.display='none'; });
  modal.querySelector('#__chatSend2').addEventListener('click', async ()=>{ const input = modal.querySelector('#__chatInput2'); const text = input.value.trim(); if (!text) return; input.value=''; const list = modal.querySelector('#__chatList2'); const u = document.createElement('div'); u.style.marginTop='8px'; u.style.textAlign='right'; const ub = document.createElement('div'); ub.style.display='inline-block'; ub.style.background='#fee2e2'; ub.style.padding='8px 10px'; ub.style.borderRadius='8px'; ub.textContent = text; u.appendChild(ub); list.insertBefore(u, list.firstChild); try { let r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ message: text }) }); let j = null; if (r.ok) { try { j = await r.json(); } catch(e) { j = null; } } if (!j) { console.warn('/api/chat POST failed; retrying http://localhost:3000'); try { r = await fetch('http://localhost:3000/api/chat', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ message: text }) }); if (r.ok) j = await r.json(); } catch(e) { console.error('chat fallback failed', e); } } const reply = (j && j.reply) ? j.reply : 'No reply'; const b = document.createElement('div'); b.style.marginTop='8px'; b.style.textAlign='left'; const bb = document.createElement('div'); bb.style.display='inline-block'; bb.style.background='#f3f4f6'; bb.style.padding='8px 10px'; bb.style.borderRadius='8px'; bb.textContent = reply; b.appendChild(bb); list.insertBefore(b, list.firstChild); } catch(e) { console.error('chat send failed', e); const b = document.createElement('div'); b.style.marginTop='8px'; b.style.textAlign='left'; const bb = document.createElement('div'); bb.style.display='inline-block'; bb.style.background='#f3f4f6'; bb.style.padding='8px 10px'; bb.style.borderRadius='8px'; bb.textContent = 'Network error'; b.appendChild(bb); list.insertBefore(b, list.firstChild); } });
      })();
    }
  } catch (e) {
    // fail silently — UI augmentation should never break the page
    console.warn('Notification bell init failed', e && e.message);
  }

  // signature pad
  const canvas = el('sigPad');
  const ctx = canvas.getContext('2d');
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  let drawing = false;
  function getPos(e){
    if (e.touches && e.touches.length) {
      const r = canvas.getBoundingClientRect();
      return { x: e.touches[0].clientX - r.left, y: e.touches[0].clientY - r.top };
    }
    return { x: e.offsetX, y: e.offsetY };
  }
  canvas.addEventListener('pointerdown', e => { drawing = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); });
  canvas.addEventListener('pointermove', e => { if (!drawing) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); });
  canvas.addEventListener('pointerup', () => drawing = false);
  el('clear').addEventListener('click', ()=> { ctx.clearRect(0,0,canvas.width, canvas.height); });

  async function loadContracts(){
    const raw = localStorage.getItem('onboardx_user');
    const user = raw ? JSON.parse(raw) : null;
    const myEmail = user && user.email ? user.email.toLowerCase() : null;
    const r = await fetch('/api/contracts');
    const list = await r.json();
    contractsDiv.innerHTML = '';
    const searchTerm = (searchInput && searchInput.value || '').trim().toLowerCase();
    const filtered = list.filter(c => (c.assignedToEmail && myEmail && c.assignedToEmail.toLowerCase() === myEmail));
    const filteredBySearch = filtered.filter(c => {
      if (!searchTerm) return true;
      const idMatch = c.id && c.id.toLowerCase().includes(searchTerm);
      const nameMatch = c.originalName && c.originalName.toLowerCase().includes(searchTerm);
      return idMatch || nameMatch;
    });
    if (!filteredBySearch.length) {
      const p = document.createElement('div'); p.textContent = 'No contracts match your search.'; p.className = 'muted'; contractsDiv.appendChild(p);
      if (signedCountEl) signedCountEl.textContent = '0';
      return;
    }
    filteredBySearch.forEach(c => {
      const card = document.createElement('div');
      card.className = 'card';
      const meta = document.createElement('div');
      meta.className = 'meta';
      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = c.originalName ? `${c.originalName}` : `${c.id}`;
      const sub = document.createElement('div'); sub.className = 'sub'; sub.textContent = `${c.id} • Status: ${c.status}`;
      meta.appendChild(title);
      meta.appendChild(sub);
      const btnWrap = document.createElement('div'); btnWrap.className = 'cta';
      const btn = document.createElement('button'); btn.className = 'btn'; btn.textContent = 'Open'; btn.addEventListener('click', ()=> openContract(c));
      btnWrap.appendChild(btn);
      // vendor info
      if (c.vendorId || c.vendorEmail) {
        const v = document.createElement('div'); v.className = 'small muted'; v.textContent = `Vendor: ${c.vendorEmail || c.vendorId}`; btnWrap.appendChild(v);
      }
      card.appendChild(meta);
      card.appendChild(btnWrap);
      contractsDiv.appendChild(card);
    });
    if (signedCountEl) signedCountEl.textContent = filteredBySearch.filter(c => c.status === 'signed').length;
  }

  function openContract(c){
    viewer.style.display = 'block';
    // Always load the PDF via our server proxy so external hosts (Dropbox) don't block the iframe
    pdfFrame.src = `/contract/${c.id}/pdf`;
    pdfFrame.dataset.contractId = c.id;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // show Access Tools button when contract is signed and hide signature form
    const sigCard = document.querySelector('.sig-card');
    // If signed: hide canvas and submit, show only access button and a View Signed PDF button
    if (c.status === 'signed') {
      accessBtn.style.display = 'inline-block';
      // hide signature controls
      sigCard.classList.add('signed');
      // add a view signed button if not present
      if (!document.getElementById('viewSigned')) {
        const viewBtn = document.createElement('button');
        viewBtn.id = 'viewSigned'; viewBtn.className = 'btn secondary'; viewBtn.textContent = 'View Signed PDF';
        viewBtn.style.marginLeft = '8px';
        viewBtn.addEventListener('click', ()=>{ window.open(pdfFrame.src, '_blank'); });
        const actions = document.querySelector('.sig-actions');
        actions.appendChild(viewBtn);
      }
    } else {
      accessBtn.style.display = 'none';
      sigCard.classList.remove('signed');
      const vs = document.getElementById('viewSigned'); if (vs) vs.remove();
    }
  }

  el('submit').addEventListener('click', async ()=>{
    const name = nameInput.value.trim();
    if (!name) { statusDiv.textContent = 'Please enter name'; return; }
    const dataUrl = canvas.toDataURL('image/png');
    const payload = { contractId: pdfFrame.dataset.contractId, name, signatureDataUrl: dataUrl };
    statusDiv.textContent = 'Submitting...';
    try {
      const r = await fetch('/api/sign', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (r.ok) {
        statusDiv.innerHTML = `<strong>Signed</strong><div class="mono">SHA-256: ${j.metadata.sha256}</div>`;
        // reload the page once after successful signing so UI updates and user sees signed state
        setTimeout(() => { try { window.location.reload(); } catch (e) {} }, 600);
      } else {
        statusDiv.textContent = 'Error: ' + (j.error || j.detail || 'unknown');
      }
    } catch (e) {
      statusDiv.textContent = 'Network error';
    }
    await loadContracts();
  });

  // Access button: fetch access details and show modal
  accessBtn.addEventListener('click', async ()=>{
    const id = pdfFrame.dataset.contractId;
    if (!id) return;
    accessContent.innerHTML = 'Loading...';
    accessModal.style.display = 'flex';
    try {
      const r = await fetch(`/api/contract/${id}/access`);
      const j = await r.json();
      if (!r.ok) {
        accessContent.innerHTML = `<div class="muted">Error: ${j.error || j.detail || 'failed'}</div>`;
        return;
      }
      const a = j.access;
      const div = document.createElement('div'); div.className = 'access-list';
      // show a circular progress tracker
      const tracker = document.createElement('div'); tracker.className = 'tracker'; tracker.innerHTML = `<div class="tracker-ring"><svg viewBox="0 0 36 36"><path class="bg" d="M18 2.0845a15.9155 15.9155 0 1 1 0 31.831"/><path class="progress" stroke-dasharray="${a.progress},100" d="M18 2.0845a15.9155 15.9155 0 1 1 0 31.831"/></svg></div><div class="tracker-label"><strong>${a.progress}%</strong><div class="small muted">Onboarding progress</div></div>`;
      div.appendChild(tracker);

      // show credentials area only as a small note (we're switching to tracker-centric UX)
      const cred = document.createElement('div'); cred.className = 'access-item'; cred.innerHTML = `<div class="small muted">Credentials are available in the portal once you proceed.</div>`;
      div.appendChild(cred);

      // render tools and wire events: if a tool is Slack Workspace, mark slack_visited when clicked
      a.tools.forEach(t => {
        const it = document.createElement('div'); it.className = 'access-item';
        const link = document.createElement('a'); link.href = t.url; link.target = '_blank'; link.textContent = `Open ${t.name}`;
        link.addEventListener('click', async (ev) => {
          // If Slack, open link and immediately mark slack_visited (user requested instant +10%)
          if (/slack/i.test(t.name)) {
            window.open(t.url, '_blank');
            try {
              await fetch(`/api/contract/${id}/event`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ event: 'slack_visited' }) });
            } catch (e) {}
            // refresh access modal to show updated progress
            setTimeout(()=> accessBtn.click(), 300);
          } else if (/work dashboard/i.test(t.name)) {
            // Only allow opening Work Dashboard when progress is 100%
            if (a.progress === 100) {
              window.open(t.url, '_blank');
            } else {
              alert('Please complete the onboarding process to access the Work Dashboard.');
            }
          } else {
            window.open(t.url, '_blank');
          }
        });
        it.innerHTML = `<strong>${t.name}</strong><div></div>`;
        it.querySelector('div').appendChild(link);
        // If the tool is the Onboarding Course (Notion), add a 'Mark Course Completed' button
        if (/onboarding course/i.test(t.name)) {
          // restore a manual 'Mark Course Completed' button so the user can mark complete for now
          const mark = document.createElement('button'); mark.className = 'btn small'; mark.style.marginLeft='8px'; mark.textContent = 'Mark Course Completed';
          mark.addEventListener('click', async ()=>{
            try {
              await fetch(`/api/contract/${id}/event`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ event: 'notion_completed' }) });
              doConfetti();
              setTimeout(()=> accessBtn.click(), 300);
            } catch (e) { alert('Failed to mark course completed'); }
          });
          it.querySelector('div').appendChild(mark);
        }
        div.appendChild(it);
      });

      accessContent.innerHTML = '';
      accessContent.appendChild(div);
      // animate confetti if progress increased beyond previous stored (store previous in dataset)
      try {
        const prev = parseInt(accessModal.dataset.prevProgress || '0', 10);
        if (a.progress > prev) { doConfetti(); }
        accessModal.dataset.prevProgress = String(a.progress);
        // if progress just reached 100, alert the user to click Work Dashboard
        if (a.progress === 100 && prev < 100) {
          setTimeout(()=> alert('Onboarding 100% complete — click "Work Dashboard" to open your analytics.'), 500);
        }
      } catch (e) {}
      // refresh contracts view so vendor can see unlocked status
      await loadContracts();
    } catch (e) {
      accessContent.innerHTML = `<div class="muted">Network error</div>`;
    }
  });

  accessClose.addEventListener('click', ()=>{ accessModal.style.display = 'none'; });

  // refresh button handler
  if (refreshBtn) refreshBtn.addEventListener('click', async ()=>{ refreshBtn.disabled = true; refreshBtn.textContent = 'Refreshing...'; await loadContracts(); refreshBtn.textContent = 'Refresh'; refreshBtn.disabled = false; });

  // simple confetti effect (small, dependency-free)
  function doConfetti() {
    for (let i=0;i<30;i++) {
      const el = document.createElement('div'); el.className = 'confetti';
      el.style.left = (20 + Math.random()*60) + '%';
      el.style.background = ['#ff6b6b','#ffd93d','#6bf178','#6bb4ff','#c38cff'][Math.floor(Math.random()*5)];
      document.body.appendChild(el);
      setTimeout(()=> el.remove(), 2500);
    }
  }

  await loadContracts();
})();
