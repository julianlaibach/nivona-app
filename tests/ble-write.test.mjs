import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NivonaMachine } from '../js/machine.js';
import { buildPacket, buildBrewPayload } from '../js/protocol.js';

function fakeMachine() {
  const m = new NivonaMachine();
  const writes = [];
  m.device = { gatt: { connected: true } };
  m.session = Uint8Array.of(0x12, 0x34);
  m.chars.write = { properties: { write: true }, writeValueWithResponse: async (b) => { writes.push(Uint8Array.from(b)); } };
  return { m, writes };
}

test('HE (25 Byte) wird in 20-Byte-Stücke zerlegt, Inhalt unverändert', async () => {
  const { m, writes } = fakeMachine();
  await assert.rejects(m.startBrew(1, 4, false), /Timeout/);
  const sent = Uint8Array.from(writes.flatMap((w) => [...w]));
  assert.equal(sent.length, 25);
  assert.deepEqual(writes.map((w) => w.length), [20, 5]);
  assert.equal(sent[0], 0x53); assert.equal(sent.at(-1), 0x45);
});

test('kurze Frames (HR) gehen in einem Stück', async () => {
  const { m, writes } = fakeMachine();
  await assert.rejects(m.request('HR', Uint8Array.of(0, 200), { timeout: 50 }), /Timeout/);
  assert.equal(writes.length, 1);
  assert.ok(writes[0].length <= 20);
});
