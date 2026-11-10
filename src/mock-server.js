import http from 'node:http';

/** Synthetic event fixtures. Names, descriptions and services are entirely fictional. */
export const mockEvents = [
  {event_id:'PP-201',platform:'pacepass',route:'/pacepass/coastline-ultra',event_name:'Coastline Ultra 50K',event_date:'July 24, 2027',capacity_raw:'85% Full',pricing_raw:'Price increases on June 1, 2027',status_text:'Registration Open'},
  {event_id:'PP-202',platform:'pacepass',route:'/pacepass/ridgeway-trail',event_name:'Ridgeway Trail Run',event_date:'August 14, 2027',capacity_raw:'50 Slots Left',pricing_raw:'Next price increase: July 1, 2027',status_text:'Registration Open'},
  {event_id:'TD-301',platform:'traildesk',route:'/traildesk/summit-relay',event_name:'Summit Relay 25K',event_date:'May 9, 2027',capacity_raw:'Current Tier Closed',pricing_raw:'Last price tier ended April 15, 2027',status_text:'Registration is Closed'},
  {event_id:'TD-302',platform:'traildesk',route:'/traildesk/cedar-crossing',event_name:'Cedar Crossing Half',event_date:'September 11, 2025',capacity_raw:'72% Full',pricing_raw:'Price increases August 11, 2025',status_text:'Registration Open'},
  {event_id:'SL-401',platform:'startline',route:'/startline/harbor-marathon',event_name:'Harbor Marathon',event_date:'October 2, 2027',capacity_raw:'37 Spots Remaining',pricing_raw:'Rate changes on September 1, 2027',status_text:'Registration Open',expand:true},
  {event_id:'SL-402',platform:'startline',route:'/startline/forest-duathlon',event_name:'Forest Duathlon',event_date:'November 21, 2027',capacity_raw:'61% Full',pricing_raw:null,status_text:'Registration Open',expand:true},
  {event_id:'PP-503',platform:'pacepass',route:'/pacepass/server-error',event_name:'Disconnected Example',unavailable:true}
];
const escape = value => String(value || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const style = `
*{box-sizing:border-box}body{margin:0;color:#192941;font-family:Inter,system-ui,Arial,sans-serif;background:#f4f6fc}
.nav{height:72px;background:#102d45;color:white;display:flex;align-items:center;justify-content:space-between;padding:0 max(5%,calc((100% - 1160px)/2))}
.logo{font-size:23px;font-weight:780;letter-spacing:-1px}.label{font-size:11px;letter-spacing:1.3px;text-transform:uppercase;opacity:.7}
main{max-width:960px;margin:54px auto;padding:0 22px}.eyebrow{text-transform:uppercase;font-size:12px;font-weight:800;letter-spacing:1.5px;color:#2d7d78}
h1{font-size:46px;letter-spacing:-2px;margin:9px 0 11px}.subtitle{color:#678099;margin-bottom:36px;font-size:15px}
.card{background:white;border:1px solid #e1e7f1;border-radius:20px;box-shadow:0 18px 40px rgba(24,47,75,.06);overflow:hidden;padding:33px}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}.detail{border:1px solid #e4eaf0;border-radius:15px;padding:20px;background:#fbfcff;min-height:112px}
.key{font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#72849c;font-weight:750;margin-bottom:13px}
.val{font-size:23px;font-weight:760;color:#16334b;line-height:1.3}.pill{display:inline-flex;align-items:center;border-radius:999px;padding:8px 13px;background:#e6f8f1;color:#207854;font-weight:700;font-size:14px}
.btn{border:0;background:#173850;color:white;border-radius:10px;padding:13px 20px;font-weight:700;cursor:pointer;margin:4px 0 17px}
.foot{margin-top:25px;font-size:13px;color:#8593a8;text-align:center}
@media(max-width:700px){main{margin:25px auto}.grid{grid-template-columns:1fr}h1{font-size:34px}.card{padding:20px}}`;
const panel = (k,html) => `<div class="detail"><div class="key">${k}</div><div class="val">${html}</div></div>`;
function eventDetails(ev) {
  if(ev.platform==='pacepass') return `
   <div class="grid">${panel('Event date',`<span data-test="event-date">${escape(ev.event_date)}</span>`)}${panel('Registration capacity',`<span data-test="event-capacity">${escape(ev.capacity_raw)}</span>`)}
   ${panel('Pricing timeline',ev.pricing_raw ? `<span data-test="price-timeline">${escape(ev.pricing_raw)}</span>`:'<span>Information currently unavailable</span>')}
   ${panel('Registration status',`<span class="pill" data-test="registration-status">${escape(ev.status_text)}</span>`)}</div>`;
  if(ev.platform==='traildesk') return `<section class="event-header">${panel('Scheduled date',`<div class="date">${escape(ev.event_date)}</div>`)}</section>
   <div class="grid"><div class="availability">${panel('Capacity',`<div class="summary">${escape(ev.capacity_raw)}</div>`)}</div>
   <div class="price-panel">${panel('Upcoming pricing',ev.pricing_raw?`<div class="next-date">${escape(ev.pricing_raw)}</div>`:'<div>Not available</div>')}</div></div>
   <p class="pill event-badge">${escape(ev.status_text)}</p>`;
  return `<div class="grid">${panel('Race date',`<span data-field="race-date">${escape(ev.event_date)}</span>`)}
   ${panel('Capacity',`<span data-field="spots">${escape(ev.capacity_raw)}</span>`)}
   ${panel('Pricing',ev.pricing_raw ? `<span data-field="next-rate">${escape(ev.pricing_raw)}</span>`:'<span>No pricing data published</span>')}
   ${panel('Status',`<span class="pill" data-field="status">${escape(ev.status_text)}</span>`)}</div>`;
}
function renderEvent(ev) {
  const brand = {pacepass:'PacePass',traildesk:'TrailDesk',startline:'StartLine'}[ev.platform];
  const name = ev.platform === 'pacepass' ? `<h1 data-test="event-title">${escape(ev.event_name)}</h1>` : ev.platform === 'traildesk' ? `<div class="event-header"><h1>${escape(ev.event_name)}</h1></div>` : `<h1 data-field="race-name">${escape(ev.event_name)}</h1>`;
  const details = eventDetails(ev);
  const pageBody = ev.expand ? `<button class="btn" type="button" id="load-details" aria-expanded="false">Show registration details</button><div id="extra" hidden>${details}</div>` : details;
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(ev.event_name)} | ${brand}</title><style>${style}</style></head>
  <body><nav class="nav"><div class="logo">${brand}</div><div class="label">Demo registration service</div></nav><main><div class="eyebrow">Upcoming endurance events</div><div id="rendered"><div class="card">Loading registration details…</div></div>
  <p class="foot">Synthetic event information · Internal portfolio demonstration · No actual registrations</p></main>
  <script>setTimeout(()=>{document.getElementById('rendered').innerHTML=${JSON.stringify(`${name}<p class="subtitle">Event registration and availability details</p><article class="card">${pageBody}</article>`)};const b=document.getElementById('load-details');if(b)b.addEventListener('click',()=>{document.getElementById('extra').hidden=false;b.setAttribute('aria-expanded','true');b.textContent='Registration details loaded';});const ready=document.createElement('div');ready.dataset.test='site-ready';document.body.appendChild(ready);},240);</script>
  </body></html>`;
}
export async function startMockServer() {
  const server = http.createServer((req,res)=>{
    const route = new URL(req.url,'http://127.0.0.1').pathname;
    const ev = mockEvents.find(x=>x.route===route);
    if(!ev){res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');return;}
    if(ev.unavailable){res.writeHead(503,{'Content-Type':'text/plain','Retry-After':'5'});res.end('Synthetic 503 response for fault tolerance testing');return;}
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
    res.end(renderEvent(ev));
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const baseUrl=`http://127.0.0.1:${server.address().port}`;
  return {server,baseUrl,targets:mockEvents.map(({event_id,platform,route})=>({event_id,platform,url:baseUrl+route})),close:()=>new Promise((res,rej)=>server.close(e=>e?rej(e):res()))};
}
