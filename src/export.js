import {mkdir, open, readFile, rename, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';

export const COLUMNS = [
  'event_id','platform','event_name','source_url','event_date','status','capacity_raw','percent_full','slots_left','tier_closed',
  'pricing_raw','next_price_change','date_flag','capacity_flag','pricing_flag','extraction_status','checked_at','errors'
];
const escaping = (value) => {
  const raw = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  const safe = /^[=+@]|^-\D/.test(raw) ? `'${raw}` : raw; // protect spreadsheet users from formula injection
  return '"' + safe.replaceAll('"', '""') + '"';
};
export function toCsv(rows) { return [COLUMNS.map(escaping).join(','), ...rows.map(row => COLUMNS.map(k => escaping(row[k])).join(','))].join('\n') + '\n'; }
export async function atomicWrite(target, content) {
  const temp = `${target}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`;
  await mkdir(path.dirname(target), {recursive: true});
  try { await writeFile(temp, content, {mode: 0o600}); await rename(temp, target); }
  catch (e) {await rm(temp, {force: true}); throw e;}
}
export async function saveResults({rows, outputDir, asOf, generatedAt = new Date().toISOString()}) {
  await mkdir(outputDir, {recursive: true});
  const csvPath = path.join(outputDir, 'registrations.csv'), jsonPath = path.join(outputDir, 'registrations.json');
  const snapshot = {demo: true, generated_at: generatedAt, as_of: asOf, records: rows};
  await atomicWrite(csvPath, toCsv(rows));
  await atomicWrite(jsonPath, JSON.stringify(snapshot, null, 2) + '\n');
  return {csvPath, jsonPath};
}
export async function withRunLock(outputDir, fn) {
  await mkdir(outputDir, {recursive: true});
  const lockPath = path.join(outputDir, '.eventwatch.lock');
  let file;
  try {file = await open(lockPath, 'wx'); await file.writeFile(JSON.stringify({pid: process.pid, at: new Date().toISOString()}));}
  catch (e) {if(e.code === 'EEXIST') throw new Error(`Another batch may be running (${lockPath}); inspect the lock before clearing it.`); throw e;}
  try {return await fn();}
  finally {await file.close(); await rm(lockPath, {force: true});}
}
