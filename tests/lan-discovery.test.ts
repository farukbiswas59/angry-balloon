import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalRoomDirectory, localRoomInfo, parseLocalRoom } from '../game/lan-discovery.ts';
import { LanRoom } from '../game/lan-room.ts';
import { removePlayer } from '../game/engine.ts';
import type { GameSocket } from '../game/lan-native.ts';

function hostRoom() {
  let id = 10000; const host = new LanRoom(() => String(++id));
  host.open('host'); host.receive('host', JSON.stringify({ type: 'join', mode: 'create', name: 'Faruk' }), 1000); host.drain();
  return host;
}
test('LAN room info is available without joining or consuming a player slot', () => {
  const host = hostRoom(), before = host.room!.players.length;
  host.open('browser'); host.receive('browser', JSON.stringify({ type: 'room-info' }), 1000);
  const response = JSON.parse(host.drain()[0].data);
  assert.equal(response.type, 'room-info'); assert.equal(response.room.name, `Faruk's room · ${host.room!.code}`);
  assert.equal(host.room!.players.length, before); assert.equal(host.sessions.size, 1);
  assert.ok(parseLocalRoom(response.room));
  host.room!.phase = 'countdown'; assert.equal(parseLocalRoom(localRoomInfo(host.room!)), null);
  host.room!.phase = 'lobby'; host.room!.maxPlayers = before; assert.equal(parseLocalRoom(localRoomInfo(host.room!)), null);
});
test('LAN room names follow the current host and bad metadata cannot produce a joinable row', () => {
  const host = hostRoom(); host.open('friend'); host.receive('friend', JSON.stringify({ type: 'join', mode: 'join', code: host.room!.code, name: 'Friend' }), 1000);
  removePlayer(host.room!, host.room!.players.find(p => p.id === host.room!.host)!);
  assert.equal(localRoomInfo(host.room!).name, `Friend's room · ${host.room!.code}`);
  const valid = localRoomInfo(host.room!);
  for (const change of [{ code: '../xx' }, { protocol: 2 }, { players: -1 }, { players: 10 }, { maxPlayers: 99 }, { joinable: false }])
    assert.equal(parseLocalRoom({ ...valid, ...change }), null);
  assert.equal(parseLocalRoom(null), null);
});
test('discovery verifies endpoints, filters unavailable rooms and removes lost services', async () => {
  const host = hostRoom(); let metadata = localRoomInfo(host.room!);
  const urls: string[] = [], rows: string[][] = [];
  const factory = (url: string): GameSocket => {
    urls.push(url);
    const socket: GameSocket = { readyState: 0, bufferedAmount: 0, onopen: null, onmessage: null, onclose: null, onerror: null,
      send: data => { assert.equal(JSON.parse(data).type, 'room-info'); queueMicrotask(() => socket.onmessage?.({ data: JSON.stringify({ type: 'room-info', room: metadata }) })); },
      close: () => { socket.readyState = 3; socket.onclose?.(); } };
    queueMicrotask(() => { socket.readyState = 1; socket.onopen?.(); }); return socket;
  };
  const directory = new LocalRoomDirectory(factory, rooms => rows.push(rooms.map(room => room.name)));
  const flush = () => new Promise<void>(resolve => setImmediate(resolve));
  directory.event({ type: 'found', service: 'bad', address: '8.8.8.8', port: 3001 });
  directory.event({ type: 'found', service: 'faruk', address: '192.168.1.2', port: 3001 }); await flush();
  assert.deepEqual(urls, ['ws://192.168.1.2:3001/socket']); assert.deepEqual(rows.at(-1), [metadata.name]);
  metadata = { ...metadata, joinable: false }; await directory.refresh(); assert.deepEqual(rows.at(-1), []);
  metadata = { ...metadata, joinable: true }; await directory.refresh(); assert.equal(rows.at(-1)?.length, 1);
  directory.event({ type: 'found', service: 'lan:192.168.1.2', address: '192.168.1.2', port: 3001 }); await flush();
  assert.equal(rows.at(-1)?.length, 1, 'DNS-SD and broadcast discoveries are deduplicated');
  directory.event({ type: 'lost', service: 'faruk' }); assert.equal(rows.at(-1)?.length, 1);
  directory.event({ type: 'lost', service: 'lan:192.168.1.2' }); assert.deepEqual(rows.at(-1), []);
  const attempts = urls.length; await directory.refresh(); assert.equal(urls.length, attempts);
  directory.stop(); directory.event({ type: 'found', service: 'late', address: '192.168.1.3', port: 3001 }); assert.equal(urls.length, attempts);
});
test('closing discovery cancels pending probes and suppresses late room updates', async () => {
  let closed = 0, changes = 0;
  const directory = new LocalRoomDirectory(() => {
    const socket: GameSocket = { readyState: 0, bufferedAmount: 0, onopen: null, onmessage: null, onclose: null, onerror: null, send: () => {}, close: () => { closed++; socket.onclose?.(); } };
    return socket;
  }, () => changes++);
  directory.event({ type: 'found', service: 'room', address: '10.0.0.1', port: 3001 }); directory.stop();
  await new Promise(resolve => setImmediate(resolve)); assert.ok(closed >= 1); assert.equal(changes, 0);
});
