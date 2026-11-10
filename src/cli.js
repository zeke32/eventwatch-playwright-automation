import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {executeBatch} from './batch.js';
import {easternToday} from './normalize.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
const positional=args.filter(value=>!value.startsWith('--'));
const input=positional[0]||path.join(ROOT,'data','targets.example.json');
const date=positional[1]||easternToday();
const targets=JSON.parse(await readFile(input,'utf8'));
const cloud=process.argv.includes('--dropbox');
const outputDir=process.env.EVENTWATCH_OUTPUT_DIR||path.join(ROOT,'output');
const result=await executeBatch({targets,outputDir,asOf:date,cloud});
console.log(JSON.stringify({total:result.total,ok:result.ok,partial:result.partial,failed:result.failed,cloud:result.cloud,files:result.files},null,2));
