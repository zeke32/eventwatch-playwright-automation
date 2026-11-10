import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDate,getPriceChangeDate,parseCapacity,getEventStatus,easternToday} from '../src/normalize.js';
import {toCsv} from '../src/export.js';
import {assertAuthorized} from '../src/scraper.js';

test('date parsing recognizes ISO and English-language event dates',()=>{
  assert.equal(parseDate('Saturday, July 24, 2027'),'2027-07-24');
  assert.equal(parseDate('2027-02-30'),null);
  assert.equal(getPriceChangeDate('Price increases June 1, 2027'),'2027-06-01');
  assert.equal(getPriceChangeDate('Rate changes on 2027-09-01'),'2027-09-01');
  assert.equal(getPriceChangeDate('None announced'),null);
});
test('inventory parsing normalizes fullness, slots and sold-out tiers',()=>{
  assert.equal(parseCapacity('85% Full').percent_full,85);
  assert.equal(parseCapacity('50 Slots Left').slots_left,50);
  assert.equal(parseCapacity('1,250 spots remaining').slots_left,1250);
  assert.equal(parseCapacity('Current Tier Closed').tier_closed,true);
});
test('temporal status includes past event and explicit closure',()=>{
  assert.equal(getEventStatus('2025-04-30','Registration Open','2026-11-10'),'Expired/Closed');
  assert.equal(getEventStatus('2027-05-09','Registration is Closed','2026-11-10'),'Expired/Closed');
  assert.equal(getEventStatus('2027-05-09','Registration Open','2026-11-10'),'Open');
  assert.equal(getEventStatus(null,'','2026-11-10'),'Layout_Modified');
});
test('Eastern calendar date is rendered as an ISO date',()=>{
  assert.equal(easternToday(new Date('2026-11-10T06:00:00Z')),'2026-11-10');
});
test('disallowed external hosts are rejected before visiting',()=>{
  assert.throws(()=>assertAuthorized('https://example.com/race'),/allowlist/);
  assert.doesNotThrow(()=>assertAuthorized('http://127.0.0.1:8400/race'));
  assert.throws(()=>assertAuthorized('file:///etc/passwd'),/allowlist/);
  assert.throws(()=>assertAuthorized('http://user:pass@127.0.0.1:8444/'),/allowlist/);
});
test('CSV output is escaped and spreadsheet formulas are neutralized',()=>{
  const text=toCsv([{event_id:'=2+2',platform:'PacePass',event_name:'Hi,"there"',errors:['Layout_Modified']}]);
  assert.match(text,/"'=2\+2"/);
  assert.match(text,/"Hi,""there"""/);
});
