import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selfTest, buildPacket, fromHex, toHex, FrameParser, rc4, checksum, buildBrewPayload } from '../js/protocol.js';
import { detectModel, summarizeStatus } from '../js/models.js';
import { recipeFields } from '../js/family9101.js';

test('Protokoll-Vektoren aus docs/NIVONA.md', () => {
  for (const r of selfTest()) assert.ok(r.ok, `${r.name}: erwartet ${r.expected}, erhalten ${r.actual}`);
});

test('Live-Request HR 104 mit Session 3E 15', () => {
  const pkt = buildPacket('HR', fromHex('0068'), { sessionKey: fromHex('3E15') });
  assert.equal(toHex(pkt), '53 48 52 21 DD 01 25 AD 45');
});

test('Parser: ACK, zwei Frames in einer Notification, 0x45 im Chiffrat', () => {
  const frames = [];
  const p = new FrameParser((f) => frames.push(f));
  // HX-Antwort (process=8) verschlüsselt bauen, wie die Maschine sie sendet
  const body = fromHex('0008000000000000');
  const hx = Uint8Array.of(0x53, 0x48, 0x58, ...rc4(Uint8Array.of(...body, checksum('HX', body))), 0x45);
  const ack = Uint8Array.of(0x53, 0x41, 0xbe, 0x45);
  p.feed(Uint8Array.of(...ack, ...hx));
  assert.equal(frames.length, 2);
  assert.equal(frames[0].command, 'A');
  assert.equal(frames[1].command, 'HX');
  assert.ok(frames[1].ok);
  assert.equal(toHex(frames[1].payload), '00 08 00 00 00 00 00 00');
});

test('HE-Brühpayload', () => {
  assert.equal(toHex(buildBrewPayload(2, 0x0b)), '00 0B 00 02 00 01 ' + Array(12).fill('00').join(' '));
});

test('NIVO 9103 (live-Name) nutzt den 9101-Ablauf', () => {
  const m = detectModel('91031109110825013---');
  assert.equal(m.familyKey, 'EF1109');
  assert.equal(m.plan, 'ef1109');
  assert.equal(m.brewMode, 0x04);
  assert.equal(m.writePrecondition, 98);
  assert.equal(m.myCoffeeSlots, 16);
  assert.equal(m.recipes[1].name, 'Espresso');
});

test('9101-Register: vertauschte Basen, Felder je Getränk, temporäres Rezept ab 9000', () => {
  const espresso = recipeFields(1);
  assert.deepEqual(espresso.map((f) => f.key), ['strength', 'profile', 'coffee_temperature', 'two_cups', 'coffee_amount']);
  assert.equal(espresso.find((f) => f.key === 'strength').readReg, 10003);
  assert.equal(espresso.find((f) => f.key === 'strength').writeReg, 9001);
  assert.equal(recipeFields(0).find((f) => f.key === 'coffee_amount').readReg, 10112);
  assert.equal(recipeFields(9).find((f) => f.key === 'water_amount').max, 500);
  const chilled = recipeFields(10).find((f) => f.key === 'profile');
  assert.deepEqual([chilled.min, chilled.max], [5, 5]);
});

test('9101-Startpayloads', () => {
  assert.equal(toHex(buildBrewPayload(0, 0x04, true).slice(0, 6)), '00 04 00 00 00 01');
  assert.equal(toHex(buildBrewPayload(1, 0x04, false).slice(0, 6)), '00 04 00 01 00 00');
});

test('Status je Familie', () => {
  const nivo = detectModel('9103');
  assert.equal(summarizeStatus({ process: 3, message: 0 }, nivo).tone, 'ok');
  assert.equal(summarizeStatus({ process: -1, message: 0 }, nivo).tone, 'ok');
  assert.equal(summarizeStatus({ process: 4, message: 0 }, nivo).tone, 'busy');
  assert.equal(summarizeStatus({ process: 3, message: 255 }, nivo).text, 'Rezept ungültig');
  assert.equal(summarizeStatus({ process: 8, message: 0 }, detectModel('756')).tone, 'ok');
  assert.equal(summarizeStatus({ process: 8, message: 20 }, detectModel('756')).tone, 'confirm');
});

test('Modellerkennung', () => {
  assert.equal(detectModel('756573071020106-----').familyKey, 700);
  assert.equal(detectModel('8107123').recipes.length, 11);
  assert.equal(detectModel('9103xyz').familyKey, 'EF1109');
  assert.equal(detectModel('NIVO 9103').familyKey, 'EF1109');
  assert.equal(detectModel('NIVO 9103').myCoffeeSlots, 16);
  assert.equal(detectModel('NICR 756').familyKey, 700);
  assert.equal(detectModel('NIVO 8107').recipes.length, 11);
  assert.equal(detectModel('xyz'), null);
});
