import {chromium} from 'playwright';
import {adapters} from './adapters.js';
import {parseDate, getPriceChangeDate, getEventStatus, parseCapacity, LAYOUT_MODIFIED} from './normalize.js';

const permittedProtocols = new Set(['http:','https:']);
export function allowedHosts() {
  return new Set(['localhost','127.0.0.1',...String(process.env.ALLOWED_TARGET_HOSTS || '').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean)]);
}
export function assertAuthorized(url, hosts=allowedHosts()) {
  const parsed = new URL(url);
  if(!permittedProtocols.has(parsed.protocol)||parsed.username||parsed.password||!hosts.has(parsed.hostname.toLowerCase())) {
    throw new Error('Target URL is not on the explicit authorized-host allowlist');
  }
  return parsed;
}

async function getText(page, selector, field, issues) {
  try {
    const value = (await page.locator(selector).first().innerText({timeout: 900})).trim();
    if(!value)throw Error('Empty field');
    return value.replace(/\s+/g,' ');
  } catch {
    issues.push(`${field}: ${LAYOUT_MODIFIED}`);
    return LAYOUT_MODIFIED;
  }
}

async function scrapeOne(context, target, {asOf, checkedAt, hosts, onLog, demoFixture=false}) {
  const adapter=adapters[target.platform];
  const result={
    event_id:target.event_id, platform:adapter?.label||target.platform, event_name:null,source_url:target.url,
    event_date:null,status:null,capacity_raw:null,percent_full:null,slots_left:null,tier_closed:null,pricing_raw:null,
    next_price_change:null,date_flag:'OK',capacity_flag:'OK',pricing_flag:'OK',extraction_status:'OK',checked_at:checkedAt,errors:[]
  };
  const issues=[];
  let page;
  try {
    if(!adapter) throw new Error('Unknown adapter for source');
    assertAuthorized(target.url,hosts);
    page=await context.newPage();
    const maxAttempts=3;
    for(let attempt=1;attempt<=maxAttempts;attempt++){
      try{
        let response;
        if(demoFixture){
          // Local fixtures are fetched by Node and their dynamic JS runs in Playwright.
          // This works even in browser sandboxes that block localhost navigation.
          if(!['127.0.0.1','localhost'].includes(new URL(target.url).hostname))throw Error('Demo fixture mode only supports loopback hosts');
          response=await fetch(target.url,{redirect:'error',signal:AbortSignal.timeout(10000)});
          if(!response.ok)throw Error(`HTTP_${response.status}`);
          await page.setContent(await response.text(),{waitUntil:'domcontentloaded'});
        }else{
          response=await page.goto(target.url,{waitUntil:'domcontentloaded',timeout:12000});
          if(!response||response.status()>=400)throw Error(`HTTP_${response?.status()||'NoResponse'}`);
          assertAuthorized(page.url(),hosts);
        }
        break;
      }catch(err){
        const code=String(err?.message||'').split('\n')[0];
        const retryable=/^HTTP_(?:429|502|503|504)$/.test(code)||/net::ERR_|Timeout/i.test(code);
        if(!retryable||attempt===maxAttempts)throw err;
        onLog?.({level:'warn',event:'transient_retry',event_id:target.event_id,attempt,code:code.slice(0,55)});
        await new Promise(resolve=>setTimeout(resolve,150*attempt));
      }
    }
    await page.locator('[data-test="site-ready"]').waitFor({state:'attached',timeout:4500});
    const detailsButton=page.locator('#load-details');
    if(await detailsButton.count()) await detailsButton.click({timeout:1500});
    const [name,dateRaw,capacityRaw,pricingRaw,statusRaw]=await Promise.all([
      getText(page,adapter.name,'event_name',issues), getText(page,adapter.date,'event_date',issues),
      getText(page,adapter.capacity,'capacity',issues),getText(page,adapter.pricing,'pricing',issues),
      getText(page,adapter.status,'registration_status',issues)
    ]);
    result.event_name=name;
    result.event_date=parseDate(dateRaw);
    result.capacity_raw=capacityRaw;
    const capacity=parseCapacity(capacityRaw);
    result.percent_full=capacity.percent_full;
    result.slots_left=capacity.slots_left;
    result.tier_closed=capacity.tier_closed;
    result.pricing_raw=pricingRaw;
    result.next_price_change=getPriceChangeDate(pricingRaw);
    result.status=getEventStatus(result.event_date,statusRaw,asOf);
    if(dateRaw===LAYOUT_MODIFIED||!result.event_date){result.date_flag=LAYOUT_MODIFIED;issues.push('event_date: unrecognized/missing date');}
    if(capacityRaw===LAYOUT_MODIFIED){result.capacity_flag=LAYOUT_MODIFIED;}
    if(pricingRaw===LAYOUT_MODIFIED){result.pricing_flag=LAYOUT_MODIFIED;}
    else if(!result.next_price_change){result.pricing_flag='Date_Unrecognized';issues.push('pricing: date not recognized');}
    result.extraction_status=issues.length?'Partial':'OK';
    result.errors=issues;
  } catch (error) {
    const message=String(error?.message||error).split('\n')[0];
    result.extraction_status='Failed';
    result.status='Unavailable';
    result.errors.push(/^HTTP_/.test(message)?message:'Navigation_or_access_failed');
    onLog?.({level:'warn',event:'url_failed',event_id:target.event_id,code:result.errors[0]});
  } finally {
    if(page)await page.close();
  }
  return result;
}

export async function scrapeTargets(targets,{asOf,concurrency=2,checkedAt=new Date().toISOString(),onLog,demoFixture=false}={}) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(asOf||''))throw new Error('asOf must be an ISO date (YYYY-MM-DD)');
  if(!Array.isArray(targets)||!targets.length)throw Error('Targets list cannot be empty');
  const hosts=allowedHosts();
  const ids=new Set();
  for(const target of targets){
    if(!target.event_id||!target.platform||!target.url)throw Error('Target must specify event_id, platform and url');
    if(ids.has(target.event_id))throw Error(`Duplicate event ID: ${target.event_id}`);
    ids.add(target.event_id);
    assertAuthorized(target.url,hosts);
  }
  const proxy=process.env.AUTHORIZED_PROXY_SERVER ? {server:process.env.AUTHORIZED_PROXY_SERVER,
    ...(process.env.AUTHORIZED_PROXY_USERNAME?{username:process.env.AUTHORIZED_PROXY_USERNAME}:{}),
    ...(process.env.AUTHORIZED_PROXY_PASSWORD?{password:process.env.AUTHORIZED_PROXY_PASSWORD}:{})}:undefined;
  const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{}),...(proxy?{proxy}:{})});
  let context;
  try{
    context=await browser.newContext({locale:'en-US',viewport:{width:1240,height:900},serviceWorkers:'block'});
    await context.route('**/*',async route=>{
      const url=route.request().url();
      try{assertAuthorized(url,hosts);await route.continue();}catch{await route.abort('blockedbyclient');}
    });
    const results=Array(targets.length);
    let index=0;
    const worker=async()=>{while(index<targets.length){const i=index++; results[i]=await scrapeOne(context,targets[i],{asOf,checkedAt,hosts,onLog,demoFixture}); onLog?.({level:'info',event:'url_processed',event_id:targets[i].event_id,status:results[i].extraction_status});}};
    await Promise.all(Array.from({length:Math.min(Math.max(1,concurrency),4,targets.length)},()=>worker()));
    return results;
  }finally{await context?.close();await browser.close();}
}
