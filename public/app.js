(async function(){
  const el = id => document.getElementById(id);
  const contractsDiv = el('contracts');
  const viewer = el('viewer');
  const pdfFrame = el('pdfFrame');
  const nameInput = el('name');
  const statusDiv = el('status');

  // signature pad
  const canvas = el('sigPad');
  const ctx = canvas.getContext('2d');
  let drawing = false;
  canvas.addEventListener('mousedown', e => { drawing = true; ctx.beginPath(); ctx.moveTo(e.offsetX, e.offsetY); });
  canvas.addEventListener('mousemove', e => { if (!drawing) return; ctx.lineTo(e.offsetX, e.offsetY); ctx.stroke(); });
  canvas.addEventListener('mouseup', () => drawing = false);
  el('clear').addEventListener('click', ()=> { ctx.clearRect(0,0,canvas.width, canvas.height); });

  async function loadContracts(){
    const r = await fetch('/api/contracts');
    const list = await r.json();
    contractsDiv.innerHTML = '';
    list.forEach(c => {
      const btn = document.createElement('button');
      btn.textContent = `${c.id} — ${c.status}`;
      btn.addEventListener('click', ()=> openContract(c));
      contractsDiv.appendChild(btn);
    });
  }

  function openContract(c){
    viewer.style.display = 'block';
    pdfFrame.src = `/contract/${c.id}/pdf`;
    pdfFrame.dataset.contractId = c.id;
  }

  el('submit').addEventListener('click', async ()=>{
    const name = nameInput.value.trim();
    if (!name) { statusDiv.textContent = 'Please enter name'; return; }
    const dataUrl = canvas.toDataURL('image/png');
    const payload = { contractId: pdfFrame.dataset.contractId, name, signatureDataUrl: dataUrl };
    statusDiv.textContent = 'Submitting...';
    const r = await fetch('/api/sign', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
    const j = await r.json();
    if (r.ok) {
      statusDiv.textContent = 'Signed! SHA-256: ' + j.metadata.sha256;
    } else {
      statusDiv.textContent = 'Error: ' + (j.error || j.detail || 'unknown');
    }
    await loadContracts();
  });

  await loadContracts();
})();
