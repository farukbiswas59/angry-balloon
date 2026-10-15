import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRoom, addPlayer, chooseTeam, chooseRole, start, step, snapshot, shoot, place, emit, C } from '../game/engine.ts';
import { encodeFrame, applyFrame } from '../game/protocol.ts';
import type { CompactFrame } from '../game/protocol.ts';
import type { Snapshot } from '../game/engine.ts';

type Packet = Omit<CompactFrame, 'type'> & { type: string; state: Snapshot };
import { broadcastRoom } from '../server/broadcast.ts';

function battle() {
  const room = makeRoom('ROOM2', '');
  const ids = ['b1', 'b2', 'r1', 'r2'];
  for (const id of ids) { const p = addPlayer(room, id, id); chooseTeam(room, p, id[0] === 'b' ? 'blue' : 'red'); }
  chooseRole(room, room.players[1], 'builder'); chooseRole(room, room.players[3], 'builder');
  start(room);
  for (let i = 0; i < 200; i++) step(room, 1 / 60, () => .5);
  return room;
}
function recipient(protocol?: number) {
  const messages: Packet[] = [];
  return { socket: { readyState: 1, bufferedAmount: 0, send: (data: string) => { messages.push(JSON.parse(data)); } }, lastRevision: -1, lastEvent: 0, protocol, messages };
}

test('compact frames rebuild the same gameplay state at a fraction of the size', () => {
  const room = battle();
  const base = JSON.parse(JSON.stringify(snapshot(room)));
  shoot(room, room.players[0], 80, -40);
  for (let i = 0; i < 5; i++) step(room, 1 / 60, () => .5);
  const compact = encodeFrame(room, base.events.at(-1)?.id ?? 0);
  const legacy = JSON.stringify({ type: 'frame', players: room.players, arrows: room.arrows, score: room.score, ammoCircle: room.ammoCircle, now: room.now, phase: room.phase, events: [] });
  assert.ok(compact.length < legacy.length / 2, `compact ${compact.length}B vs legacy ${legacy.length}B`);
  const next = applyFrame(base, JSON.parse(compact))!;
  assert.ok(next);
  for (const [i, p] of room.players.entries()) {
    assert.ok(Math.abs(next.players[i].x - p.x) <= .05 && Math.abs(next.players[i].y - p.y) <= .05);
    assert.equal(next.players[i].ammo, p.ammo);
    assert.equal(next.players[i].name, p.name);
  }
  assert.equal(next.arrows.length, 1);
  assert.equal(next.arrows[0].owner, room.players[0].id);
  assert.equal(next.arrows[0].team, 'blue');
});

test('a frame encoded for a different roster is rejected so the client can resync', () => {
  const room = battle();
  const stale = JSON.parse(JSON.stringify(snapshot(room)));
  room.revision++;
  assert.equal(applyFrame(stale, JSON.parse(encodeFrame(room, 0))), null);
});

test('wall changes stay in compact frames for new clients but resend snapshots to old ones', () => {
  const room = battle();
  const modern = recipient(2), old = recipient();
  broadcastRoom(room, [modern, old]);
  assert.equal(modern.messages[0].type, 'state');
  const builder = room.players.find(p => p.role === 'builder' && p.team === 'red')!;
  assert.ok(place(room, builder, 4));
  broadcastRoom(room, [modern, old]);
  assert.equal(old.messages[1].type, 'state');
  assert.equal(modern.messages[1].type, 'frame');
  const applied = applyFrame(modern.messages[0].state, modern.messages[1] as unknown as CompactFrame)!;
  assert.equal(applied.walls.red[4], 2);
});

test('urgent flushes only reach players with unseen events', () => {
  const room = battle();
  const a = recipient(2), b = recipient(2);
  broadcastRoom(room, [a, b]);
  assert.equal(broadcastRoom(room, [a, b], true), 0);
  assert.equal(a.messages.length, 1);
  emit(room, 'shot', { player: 'b1' });
  broadcastRoom(room, [a, b], true);
  assert.equal(a.messages.length, 2);
  assert.deepEqual(a.messages[1].events.map(e => e.type), ['shot']);
});

test('shots start where the shooter saw themselves, within a bounded tolerance', () => {
  const room = battle();
  const p = room.players[0];
  assert.ok(shoot(room, p, 80, -40, p.x + 30, p.y - 10));
  assert.equal(room.arrows[0].x, p.x + 30);
  room.now += 1;
  assert.ok(shoot(room, p, 80, -40, p.x + C.originSlack + 50, p.y));
  assert.equal(room.arrows[1].x, p.x);
});
