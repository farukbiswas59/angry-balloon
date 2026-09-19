import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRoom,emit } from '../game/engine.ts';
import { BroadcastClock,broadcastRoom,MAX_BUFFERED_BYTES } from '../server/broadcast.ts';

function recipient(){
 const messages:string[]=[];
 return {socket:{readyState:1,bufferedAmount:0,send:(data:string)=>{messages.push(data);}},lastRevision:-1,lastEvent:0,messages};
}
test('broadcast cadence survives uneven simulation ticks without duplicate sends',()=>{
 const clock=new BroadcastClock(0);
 const times=[0,16,32,49,65,80,96,112,113,299,300,301];
 assert.deepEqual(times.filter(t=>clock.due(t)),[0,65,112,299,300]);
});
test('ten players share one serialization for a snapshot and for a frame',()=>{
 const room=makeRoom('ROOM2','');room.phase='playing';
 const peers=Array.from({length:10},recipient);
 assert.equal(broadcastRoom(room,peers),1);
 assert.equal(broadcastRoom(room,peers),1);
 assert.ok(peers.every(p=>JSON.parse(p.messages[1]).type==='frame'));
});
test('slow players receive the latest wall snapshot after their queue clears',()=>{
 const room=makeRoom('ROOM2','');room.phase='playing';
 const fast=recipient(),slow=recipient();broadcastRoom(room,[fast,slow]);
 slow.socket.bufferedAmount=MAX_BUFFERED_BYTES;
 room.walls.red[0]=1;room.revision++;emit(room,'build',{team:'red',slot:0});
 broadcastRoom(room,[fast,slow]);
 assert.equal(slow.lastRevision,0);assert.equal(slow.messages.length,1);
 room.walls.red[0]=0;room.revision++;emit(room,'break',{team:'red',slot:0});
 slow.socket.bufferedAmount=0;broadcastRoom(room,[fast,slow]);
 const latest=JSON.parse(slow.messages[1]);
 assert.equal(latest.type,'state');assert.equal(latest.state.walls.red[0],0);
 assert.equal(slow.lastRevision,room.revision);
 assert.equal(slow.lastEvent,room.serial);
});
test('a recovering client does not lose events when other clients have already received them',()=>{
 const room=makeRoom('ROOM2','');room.phase='playing';
 const fast=recipient(),slow=recipient();broadcastRoom(room,[fast,slow]);
 slow.socket.bufferedAmount=MAX_BUFFERED_BYTES;emit(room,'shot');broadcastRoom(room,[fast,slow]);
 slow.socket.bufferedAmount=0;emit(room,'pop');broadcastRoom(room,[fast,slow]);
 assert.deepEqual(JSON.parse(fast.messages.at(-1)!).events.map((e:any)=>e.type),['pop']);
 assert.deepEqual(JSON.parse(slow.messages.at(-1)!).events.map((e:any)=>e.type),['shot','pop']);
});
