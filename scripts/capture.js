import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile,mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {startMockServer} from '../src/mock-server.js';
import {executeBatch} from '../src/batch.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const outputDir=path.join(root,'output');
const docs=path.join(root,'docs');
await mkdir(docs,{recursive:true});
let browser;
const mock=await startMockServer();
try{
  await executeBatch({targets:mock.targets,outputDir,asOf:'2026-11-10',demoFixture:true});
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
  const page=await browser.newPage({viewport:{width:1000,height:750},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await page.setContent(await readFile(path.join(outputDir,'report.html'),'utf8'),{waitUntil:'load'});
  await page.screenshot({path:path.join(docs,'portfolio_cover.png')});
  await page.setViewportSize({width:1200,height:900});
  await page.screenshot({path:path.join(docs,'report_full.png'),fullPage:true});
  const fixture=await fetch(mock.baseUrl+'/startline/harbor-marathon');
  await page.setContent(await fixture.text(),{waitUntil:'domcontentloaded'});
  await page.locator('[data-test="site-ready"]').waitFor({state:'attached'});
  await page.locator('#load-details').click();
  await page.setViewportSize({width:1000,height:750});
  await page.screenshot({path:path.join(docs,'dynamic_event_page.png')});
  if(errors.length)throw Error('Page errors: '+errors.join(', '));
  await page.close();
  console.log('Screenshots created: docs/portfolio_cover.png, docs/report_full.png, docs/dynamic_event_page.png');
}finally{await browser?.close();await mock.close();}
