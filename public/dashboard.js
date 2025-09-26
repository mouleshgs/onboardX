(async function(){
  const vendorChart = document.getElementById('vendorChart');
  const recentList = document.getElementById('recentList');
  const donutWrap = document.getElementById('donutWrap');
  const statTotal = document.getElementById('statTotal');
  const statSigned = document.getElementById('statSigned');
  const statOnboarded = document.getElementById('statOnboarded');
  const allTable = document.getElementById('allTable');

  try {
    const r = await fetch('/api/contracts');
    const list = await r.json();
    const total = list.length;
    const signed = list.filter(c=>c.status==='signed').length;
    const onboarded = list.filter(c=>c.access && c.access.progress === 100).length;

    statTotal.textContent = total;
    statSigned.textContent = signed;
    statOnboarded.textContent = onboarded;

    // draw donut showing percent onboarded
    const pct = total === 0 ? 0 : Math.round((onboarded/total)*100);
    donutWrap.innerHTML = buildDonutSvg(pct);

    // build per-vendor aggregation
    const byVendor = {};
    list.forEach(c => {
      const v = (c.vendorEmail || c.vendorId || 'unknown');
      if (!byVendor[v]) byVendor[v] = { total:0, signed:0, onboarded:0 };
      byVendor[v].total++;
      if (c.status === 'signed') byVendor[v].signed++;
      if (c.access && c.access.progress === 100) byVendor[v].onboarded++;
    });

    // render vendor bars
    vendorChart.innerHTML = '';
    Object.keys(byVendor).sort((a,b)=> byVendor[b].onboarded - byVendor[a].onboarded).forEach(v => {
      const d = byVendor[v];
      const row = document.createElement('div'); row.className='bar-row';
      const label = document.createElement('div'); label.className='bar-label'; label.textContent = `${v}`;
      const track = document.createElement('div'); track.className='bar-track';
      const fill = document.createElement('div'); fill.className='bar-fill';
      const percent = d.total ? Math.round((d.onboarded/d.total)*100) : 0;
      fill.style.width = percent + '%';
      track.appendChild(fill);
      const stat = document.createElement('div'); stat.style.width='60px'; stat.style.textAlign='right'; stat.textContent = `${percent}%`;
      row.appendChild(label); row.appendChild(track); row.appendChild(stat);
      vendorChart.appendChild(row);
    });

    // recent completions (most recent signed with access 100)
    const recent = list.filter(c => c.access && c.access.progress === 100).sort((a,b)=> new Date(b.access.generatedAt) - new Date(a.access.generatedAt)).slice(0,8);
    recentList.innerHTML = '';
    if (!recent.length) recentList.innerHTML = '<div class="muted">No completions yet</div>';
    recent.forEach(rp => {
      const it = document.createElement('div'); it.className='card';
      it.innerHTML = `<div style="font-weight:600">${rp.originalName||rp.id}</div><div class="small muted">${rp.assignedToEmail||'-'} • ${new Date(rp.access.generatedAt).toLocaleString()}</div>`;
      recentList.appendChild(it);
    });

    // all contracts table
    const table = document.createElement('table');
    const hdr = document.createElement('tr'); hdr.innerHTML='<th>Contract</th><th>Vendor</th><th>Assigned</th><th>Status</th><th>Progress</th>'; table.appendChild(hdr);
    list.forEach(c=>{
      const tr = document.createElement('tr');
      const prog = (c.access && typeof c.access.progress === 'number') ? c.access.progress : 0;
      tr.innerHTML = `<td class="mono">${c.id}</td><td>${c.vendorEmail||c.vendorId||'-'}</td><td>${c.assignedToEmail||'-'}</td><td>${c.status||'pending'}</td><td>${prog}%</td>`;
      table.appendChild(tr);
    });
    allTable.appendChild(table);

  } catch (e) {
    console.error('Dashboard load failed', e && e.message);
    document.getElementById('donutWrap').innerHTML = '<div class="muted">Failed to load analytics</div>';
  }

  // simple donut SVG builder
  function buildDonutSvg(percent) {
    const size = 160; const stroke = 18; const r = (size - stroke) / 2; const c = 2 * Math.PI * r;
    const dash = (percent/100) * c;
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`+
      `<defs><linearGradient id="g1" x1="0%" x2="100%"><stop offset="0%" stop-color="#60a5fa"/><stop offset="100%" stop-color="#06b6d4"/></linearGradient></defs>`+
      `<g transform="translate(${size/2},${size/2})">`+
      `<circle r="${r}" fill="none" stroke="#eef2ff" stroke-width="${stroke}" />`+
      `<circle r="${r}" fill="none" stroke="url(#g1)" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${dash} ${c-dash}" transform="rotate(-90)"/>`+
      `<text x="0" y="4" text-anchor="middle" font-size="20" font-weight="700">${percent}%</text>`+
      `<text x="0" y="26" text-anchor="middle" font-size="11" fill="#6b7280">Onboarded</text>`+
      `</g></svg>`;
  }

})();