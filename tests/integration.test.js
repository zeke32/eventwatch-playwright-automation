import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {startMockServer} from '../src/mock-server.js';
import {scrapeTargets} from '../src/scraper.js';
import {executeBatch} from '../src/batch.js';
import {uploadDropbox} from '../src/cloud.js';
import {withRunLock} from '../src/export.js';

const prepare=async()=>{const server=await startMockServer();const outputDir=await mkdtemp(path.join(os.tmpdir(),'eventwatch-test-'));return {server,outputDir,cleanup:async()=>{await server.close();await rm(outputDir,{recursive:true,force:true});}};};

test('browser scraper renders dynamic JavaScript across three fictional engines',async()=>{
  const env=await prepare();
  try{
    const rows=await scrapeTargets(env.server.targets,{asOf:'2026-11-10',concurrency:2,checkedAt:'2026-11-10T07:00:00.000Z',demoFixture:true});
    assert.equal(rows.length,7);
    assert.equal(rows.filter(r=>r.extraction_status==='OK').length,5);
    assert.equal(rows.filter(r=>r.extraction_status==='Partial').length,1);
    assert.equal(rows.filter(r=>r.extraction_status==='Failed').length,1);
    assert.equal(rows.find(r=>r.event_id==='PP-201').percent_full,85);
    assert.equal(rows.find(r=>r.event_id==='PP-202').slots_left,50);
    assert.equal(rows.find(r=>r.event_id==='TD-301').status,'Expired/Closed');
    assert.equal(rows.find(r=>r.event_id==='TD-302').status,'Expired/Closed');
    assert.equal(rows.find(r=>r.event_id==='SL-401').slots_left,37);
    assert.equal(rows.find(r=>r.event_id==='SL-402').pricing_flag,'Layout_Modified');
    assert.equal(rows.find(r=>r.event_id==='SL-402').status,'Open');
    assert.equal(rows.find(r=>r.event_id==='PP-503').errors[0],'HTTP_503');
  }finally{await env.cleanup();}
});

test('nightly batch outputs atomic CSV, JSON, HTML and log, with no duplicates',async()=>{
  const env=await prepare();
  try{
    const run=()=>executeBatch({targets:env.server.targets,outputDir:env.outputDir,asOf:'2026-11-10',demoFixture:true});
    const first=await run();
    assert.equal(first.total,7);
    assert.equal(first.failed,1);
    const rawJson=JSON.parse(await readFile(first.files.jsonPath,'utf8'));
    assert.equal(new Set(rawJson.records.map(r=>r.event_id)).size,7);
    const csv=await readFile(first.files.csvPath,'utf8');
    assert.equal(csv.trim().split('\n').length,8);
    const report=await readFile(first.files.reportPath,'utf8');
    assert.match(report,/Nightly extraction report/);
    assert.match(report,/PP-503/);
    const second=await run();
    assert.equal(second.total,7);
    assert.equal(JSON.parse(await readFile(second.files.jsonPath,'utf8')).records.length,7);
    const log=await readFile(path.join(env.outputDir,'run.ndjson'),'utf8');
    assert.match(log,/batch_completed/);
  }finally{await env.cleanup();}
});

test('a process lock prevents parallel snapshots and cleans up',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'eventwatch-lock-'));
  try{
    await withRunLock(dir,async()=>{
      await assert.rejects(()=>withRunLock(dir,async()=>{}),/Another batch/);
    });
    const value=await withRunLock(dir,async()=>42);
    assert.equal(value,42);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('Dropbox adapter requests private overwrite without sending credentials in output',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'eventwatch-upload-'));
  try{
    const {writeFile}=await import('node:fs/promises');
    const file=path.join(dir,'registrations.json');await writeFile(file,'{"ok":true}');
    const captured=[];
    const fakeFetch=async(url,request)=>{captured.push({url,request});return {ok:true,status:200,json:async()=>({id:'test-id',path_display:'/Apps/Demo/registrations.json'})};};
    const result=await uploadDropbox(file,{token:'placeholder-test-token',folder:'/Apps/Demo',fetchImpl:fakeFetch});
    assert.equal(result.path,'/Apps/Demo/registrations.json');
    const arg=JSON.parse(captured[0].request.headers['Dropbox-API-Arg']);
    assert.equal(arg.mode,'overwrite');
    assert.equal(arg.path,'/Apps/Demo/registrations.json');
    assert.equal(captured[0].url,'https://content.dropboxapi.com/2/files/upload');
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('failed cloud upload exits with error while retaining local snapshots',async()=>{
  const env=await prepare();
  const oldToken=process.env.DROPBOX_ACCESS_TOKEN, oldFolder=process.env.DROPBOX_FOLDER;
  process.env.DROPBOX_ACCESS_TOKEN='unit-test-placeholder';process.env.DROPBOX_FOLDER='/TestFolder';
  try{
    await assert.rejects(()=>executeBatch({targets:env.server.targets.slice(0,1),outputDir:env.outputDir,asOf:'2026-11-10',demoFixture:true,cloud:true,uploadFn:async()=>{throw Error('test service outage');}}),/Dropbox upload failed/);
    const rows=JSON.parse(await readFile(path.join(env.outputDir,'registrations.json'),'utf8')).records;
    assert.equal(rows.length,1);
  }finally{
    if(oldToken===undefined)delete process.env.DROPBOX_ACCESS_TOKEN;else process.env.DROPBOX_ACCESS_TOKEN=oldToken;
    if(oldFolder===undefined)delete process.env.DROPBOX_FOLDER;else process.env.DROPBOX_FOLDER=oldFolder;
    await env.cleanup();
  }
});
