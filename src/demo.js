import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {startMockServer} from './mock-server.js';
import {executeBatch} from './batch.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const server=await startMockServer();
try{
  const outputDir=path.join(ROOT,'output');
  const result=await executeBatch({targets:server.targets,outputDir,asOf:'2026-11-10',demoFixture:true});
  console.log(JSON.stringify({summary:{total:result.total,ok:result.ok,partial:result.partial,failed:result.failed,closed:result.closed},files:result.files},null,2));
}finally{await server.close();}
