import test from 'node:test';
import assert from 'node:assert/strict';
import { LanRoom } from '../game/lan-room.ts';
import { lanAddress } from '../game/lan-address.ts';

test('LAN addresses accept private ranges and reject public hosts and URL tricks', () => {
  for (const ip of ['192.168.1.10','172.16.2.3','172.31.2.3','10.0.0.1','127.0.0.1']) assert.equal(lanAddress(ip), `http://${ip}:3001`);
  for (const ip of ['8.8.8.8','172.32.0.1','192.168.999.1','localhost','192.168.1.1@evil.com','192.168.1.1:80','192.168.1.1/socket']) assert.throws(() => lanAddress(ip));
});
test('a phone hosts a private bot-builder room and two humans can start and reconnect', () => {
  let i = 10000; const host = new LanRoom(() => String(++i));
  const receive = (peer: string, m: object) => host.receive(peer, JSON.stringify(m), 1000);
  host.open('one'); host.open('two');
  receive('one',{ type:'join', mode:'create', name:'Host', botBuilders:true });
  const joined = JSON.parse(host.drain()[0].data);
  assert.equal(host.room!.players.filter(p => p.bot).length, 2);
  receive('two',{ type:'join', mode:'join', code:host.room!.code, name:'Friend' });
  host.drain();
  receive('one',{type:'team',team:'blue'}); receive('two',{type:'team',team:'red'});
  receive('two',{type:'start'}); assert.equal(host.room!.phase,'lobby');
  receive('one',{type:'start'}); assert.equal(host.room!.phase,'countdown');
  for (let n = 0; n < 240; n++) host.tick(1/60,n*1000/60);
  assert.equal(host.room!.phase,'playing');
  const player=host.room!.players.find(p=>p.id===joined.id)!;assert.equal(player.ammo,50);
  player.x=640;player.y=360;player.ammo=0;
  for(let n=0;n<120;n++)host.tick(1/60,4000+n*1000/60);
  assert.equal(player.ammo,5);
  assert.ok(host.room!.ammoCircle.readyAt>host.room!.now);
  assert.ok(host.drain().some(packet => JSON.parse(packet.data).type === 'frame'));
  host.close('one'); assert.equal(host.room!.players.find(p => p.id === joined.id)!.connected,false);
  host.open('resumed'); receive('resumed',{type:'resume',token:joined.token});
  assert.equal(JSON.parse(host.drain().at(-1)!.data).type,'joined');
  receive('resumed',{type:'leave'}); assert.equal(host.room!.players.some(p => p.id === joined.id),false);
});
