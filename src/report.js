const esc = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const count = (rows, predicate) => rows.filter(predicate).length;
export function renderReport({records, generated_at, as_of}) {
  const total=records.length, healthy=count(records,r=>r.extraction_status==='OK'), partial=count(records,r=>r.extraction_status==='Partial');
  const failed=count(records,r=>r.extraction_status==='Failed'), closed=count(records,r=>r.status==='Expired/Closed');
  const display=(v)=>v===null||v===undefined||v===''?'<span class="muted">—</span>':esc(v);
  const statusBadge=v=>`<span class="badge ${v==='OK'?'success':v==='Partial'?'warning':v==='Failed'?'danger':''}">${esc(v)}</span>`;
  const rows=records.map(r=>`<tr>
      <td class="event"><strong>${display(r.event_name)}</strong><span class="sub">${esc(r.event_id)} · ${display(r.platform)}</span></td>
      <td>${display(r.event_date)}</td><td>${display(r.capacity_raw)}</td><td>${display(r.next_price_change)}</td>
      <td><span class="${r.status==='Expired/Closed'?'closed':r.status==='Open'?'state':'unavailable'}">${display(r.status)}</span></td><td>${statusBadge(r.extraction_status)}</td>
    </tr>`).join('');
  const exceptions=records.filter(r=>r.errors?.length).map(r=>`<div class="exception"><div class="exception-ico">!</div><div><strong>${esc(r.event_id)} · ${esc(r.platform)}</strong><p>${esc(r.errors.join(' · '))}</p></div><span class="${r.extraction_status==='Failed'?'tag failure':'tag'}">${esc(r.extraction_status)}</span></div>`).join('');
  const providers=[...new Set(records.map(r=>r.platform))].filter(Boolean);
  const providersHtml=providers.map(p=>{
    const rr=records.filter(r=>r.platform===p);const good=count(rr,r=>r.extraction_status==='OK');
    return `<div class="provider"><div class="provider-label">${esc(p)}</div><div class="provider-value">${good}<small>/${rr.length}</small></div><div class="provider-sub">Complete extractions</div><div class="track"><div class="fill" style="width:${100*good/rr.length}%"></div></div></div>`;
  }).join('');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>EventWatch · Nightly run report</title><style>
:root{--navy:#11283e;--ink:#1d2d42;--sub:#718398;--teal:#217964;--border:#e4eaf1;--surface:#fff}
*{box-sizing:border-box}body{margin:0;background:#f4f6fa;color:var(--ink);font:15px/1.5 Inter,Arial,system-ui,sans-serif}
header{background:#0d263c;color:white;padding:25px 0}header .width{display:flex;align-items:center;justify-content:space-between}
.width{max-width:1200px;margin:auto;padding:0 30px}.brand{display:flex;gap:12px;align-items:center;font-size:23px;font-weight:800;letter-spacing:-.5px}
.logo{background:#48c5a4;width:33px;height:33px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#0d263c;font-weight:bold}
.topright{font-size:12px;color:#b9cfdb;letter-spacing:.9px}.topright b{color:#76ead0}main{padding-top:38px;padding-bottom:70px}
.eyebrow{font-size:11px;letter-spacing:1.6px;color:#289681;text-transform:uppercase;font-weight:800}h1{font-size:34px;line-height:1.15;letter-spacing:-1.3px;margin:9px 0 6px;color:#122a43}
.subtitle{color:#708399;font-size:14px;margin:0 0 24px}.notice{display:inline-flex;align-items:center;gap:6px;border:1px solid #c7e7da;border-radius:50px;background:#f0f9f4;color:#27765f;padding:6px 12px;font-size:11px;font-weight:800;margin-bottom:24px}
.kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:13px;margin-bottom:24px}.kpi{background:white;border:1px solid #e6ecf3;border-radius:15px;padding:19px 20px;box-shadow:0 5px 14px rgba(20,40,70,.025)}
.kpi .label{font-size:12px;font-weight:600;color:#6b7f95}.kpi .value{font-size:32px;font-weight:800;letter-spacing:-.9px;margin-top:8px;color:#172e46}.kpi .trend{margin-top:4px;font-size:11px;color:#8594a7}.kpi.green .value{color:#248a74}.kpi.amber .value{color:#b57b23}.kpi.red .value{color:#bd5555}
.columns{display:grid;grid-template-columns:1fr 1fr;gap:19px;margin-bottom:23px}.card{background:white;border:1px solid #e4eaf1;border-radius:16px;box-shadow:0 6px 18px rgba(20,40,70,.025);overflow:hidden}
.card-title{padding:21px 24px 16px;border-bottom:1px solid #edf0f4;display:flex;align-items:center;justify-content:space-between}.card-title h2{font-size:16px;margin:0;letter-spacing:-.3px}.card-title span{color:#8c9aab;font-size:11px}
.provider-list{padding:13px 24px 24px;display:grid;grid-template-columns:repeat(3,1fr);gap:17px}.provider{padding-top:10px}.provider-label{font-size:11px;color:#657d95;font-weight:700;min-height:34px}.provider-value{font-size:28px;font-weight:800;color:#18334d;line-height:1.3}.provider-value small{font-size:17px;color:#8294a4}.provider-sub{font-size:10px;color:#8393a6;margin-bottom:11px}.track{width:100%;height:6px;background:#e9f0f6;border-radius:6px;overflow:hidden}.fill{height:100%;border-radius:6px;background:#35af95}
.exceptions{padding:11px 22px 16px}.exception{display:flex;gap:12px;padding:12px 0;align-items:center;border-bottom:1px solid #f0f2f5}.exception:last-child{border-bottom:0}.exception-ico{background:#fff2e4;border-radius:8px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;color:#bf862d;font-weight:900;flex:none}.exception strong{font-size:12px}.exception p{color:#7c889a;font-size:11px;margin:2px 0 0}.tag{margin-left:auto;background:#fff2e4;border-radius:18px;padding:5px 10px;color:#ac731c;font-size:10px;font-weight:700;white-space:nowrap}.tag.failure{background:#fceded;color:#bd5959}
.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:880px;text-align:left}thead{background:#f8fafc}th{font-size:10px;letter-spacing:.65px;text-transform:uppercase;color:#7b8da0;padding:14px 22px}td{padding:14px 22px;font-size:12px;white-space:nowrap;border-top:1px solid #eef1f5;color:#455b73}
.event strong{display:block;color:#18364f;font-size:12px}.sub{display:block;color:#8a98a8;font-size:10px;margin-top:3px}.badge,.state,.closed{border-radius:6px;padding:5px 8px;font-size:10px;font-weight:800}.badge.success{background:#e4f7ef;color:#167759}.badge.warning{background:#fff3dd;color:#a76a1d}.badge.danger{background:#fce9e9;color:#b74747}.state{background:#ebf7f0;color:#247454}.closed{background:#f1f2f5;color:#7f8d9d}
.unavailable{background:#f1f2f5;color:#68798a}.muted{color:#b0bdc9}footer{font-size:11px;color:#94a2b0;padding:28px 2px 5px}
@media(max-width:950px){.kpis{grid-template-columns:repeat(3,1fr)}.columns{grid-template-columns:1fr}}@media(max-width:600px){.width{padding:0 14px}h1{font-size:27px}.kpis{grid-template-columns:repeat(2,1fr)}.provider-list{grid-template-columns:1fr 1fr}}
</style></head><body><header><div class="width"><div class="brand"><span class="logo">E</span> EventWatch</div><div class="topright">NODE.JS + PLAYWRIGHT <b>●</b> DEMO</div></div></header>
<main class="width"><div class="eyebrow">Automated registry monitoring</div><h1>Nightly extraction report</h1>
<p class="subtitle">Snapshot as of ${esc(as_of)} · Generated ${esc(generated_at.replace('T',' ').slice(0,19))} UTC · Local synthetic fixtures</p>
<div class="notice">✓ INDEPENDENT PORTFOLIO DEMONSTRATION · 100% SYNTHETIC DATA</div>
<section class="kpis"><div class="kpi"><div class="label">URLs processed</div><div class="value">${total}</div><div class="trend">Unique event identifiers</div></div>
<div class="kpi green"><div class="label">Complete records</div><div class="value">${healthy}</div><div class="trend">All fields resolved</div></div>
<div class="kpi amber"><div class="label">Partial records</div><div class="value">${partial}</div><div class="trend">Layout modifications isolated</div></div>
<div class="kpi red"><div class="label">Failed targets</div><div class="value">${failed}</div><div class="trend">Queue keeps processing</div></div>
<div class="kpi"><div class="label">Expired or closed</div><div class="value">${closed}</div><div class="trend">Date and status checks</div></div></section>
<div class="columns"><section class="card"><div class="card-title"><h2>Source coverage</h2><span>Completed / Total</span></div><div class="provider-list">${providersHtml}</div></section>
<section class="card"><div class="card-title"><h2>Exceptions &amp; resilience</h2><span>Validation details</span></div><div class="exceptions">${exceptions||'<p>No errors recorded.</p>'}</div></section></div>
<section class="card"><div class="card-title"><h2>Unified registration inventory</h2><span>${total} event IDs · CSV and JSON outputs</span></div><div class="table-wrap"><table><thead><tr><th>Event</th><th>Event date</th><th>Registration capacity</th><th>Next price change</th><th>Temporal status</th><th>Extraction</th></tr></thead><tbody>${rows}</tbody></table></div></section>
<footer>Portfolio simulation only. No real registration providers, anti-bot systems, proxies, or private accounts were contacted.</footer></main></body></html>`;
}
