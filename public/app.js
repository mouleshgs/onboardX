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
      } else {
        statusDiv.textContent = 'Error: ' + (j.error || j.detail || 'unknown');
      }
    } catch (e) {
      statusDiv.textContent = 'Network error';
    }
    await loadContracts();
  });

  await loadContracts();
})();
