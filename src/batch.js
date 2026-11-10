import path from 'node:path';
import {appendFile, mkdir} from 'node:fs/promises';
import {scrapeTargets} from './scraper.js';
import {easternToday} from './normalize.js';
import {saveResults, atomicWrite, withRunLock} from './export.js';
import {renderReport} from './report.js';
import {uploadDropbox} from './cloud.js';

export async function executeBatch({targets, outputDir, asOf=easternToday(), concurrency=2, cloud=false, demoFixture=false, uploadFn=uploadDropbox}) {
  return withRunLock(outputDir,async()=>{
    const startedAt=new Date().toISOString();
    const logPath=path.join(outputDir,'run.ndjson');
    await mkdir(outputDir,{recursive:true});
    const log=async entry=>appendFile(logPath,JSON.stringify({timestamp:new Date().toISOString(),...entry})+'\n');
    const warnings=[];
    const onLog=entry=>{ warnings.push(entry); };
    const rows=await scrapeTargets(targets,{asOf,concurrency,checkedAt:startedAt,onLog,demoFixture});
    for(const event of warnings)await log(event);
    const {csvPath,jsonPath}=await saveResults({rows,outputDir,asOf,generatedAt:startedAt});
    const reportPath=path.join(outputDir,'report.html');
    await atomicWrite(reportPath,renderReport({records:rows,generated_at:startedAt,as_of:asOf}));
    const result={total:rows.length,ok:rows.filter(r=>r.extraction_status==='OK').length,partial:rows.filter(r=>r.extraction_status==='Partial').length,failed:rows.filter(r=>r.extraction_status==='Failed').length,closed:rows.filter(r=>r.status==='Expired/Closed').length,files:{csvPath,jsonPath,reportPath},cloud:'Not configured'};
    let uploadError=null;
    if(cloud){
      const token=process.env.DROPBOX_ACCESS_TOKEN;
      const folder=process.env.DROPBOX_FOLDER;
      if(!token||!folder)throw new Error('Cloud upload requested but DROPBOX_ACCESS_TOKEN and DROPBOX_FOLDER are missing');
      try{await uploadFn(csvPath,{token,folder});await uploadFn(jsonPath,{token,folder});result.cloud='Uploaded to Dropbox';}
      catch(e){result.cloud='Upload failed';uploadError=new Error('Dropbox upload failed; local snapshots remain available');await log({level:'error',event:'cloud_upload_failed',code:String(e.message).slice(0,130)});}
    }
    await log({level:uploadError?'error':'info',event:'batch_completed',total:result.total,ok:result.ok,partial:result.partial,failed:result.failed,cloud:result.cloud});
    if(uploadError)throw uploadError;
    return {...result,rows};
  });
}
