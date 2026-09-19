import test from 'node:test';import assert from 'node:assert/strict';
import { makeRoom,addPlayer,chooseTeam,chooseRole,start,step,place,shoot,pop,grid,input,disconnect,removePlayer,rematch,C,cleanName } from '../game/engine.ts';
import type { Arrow } from '../game/engine.ts';
function setup(){const r=makeRoom('TEST2','p0');const ps=Array.from({length:4},(_,i)=>addPlayer(r,'p'+i,'Player'+i));ps.forEach((p,i)=>chooseTeam(r,p,i<2?'blue':'red'));return {r,ps};}
function battle(){const s=setup();start(s.r);step(s.r,3.6);s.ps.forEach((p,i)=>{p.x=i<2?150+i*70:1100-(i-2)*70;p.y=200+i*80;});return s;}
function arrow(owner:string,team:'blue'|'red',x:number,y:number,vx=0):Arrow{return {id:987,owner,team,x,y,vx,vy:0,born:0};}
test('room capacity and team capacity enforced',()=>{const r=makeRoom('ABCDE','p0');const ps=Array.from({length:10},(_,i)=>addPlayer(r,'p'+i,'Test'));assert.throws(()=>addPlayer(r,'extra','extra'),/full/);for(let i=0;i<5;i++)assert.ok(chooseTeam(r,ps[i],'blue'));assert.equal(chooseTeam(r,ps[5],'blue'),false);assert.equal(chooseTeam(r,ps[0],'purple'),false);});
test('minimum four and two per crew; unassigned players block start',()=>{const {r,ps}=setup();removePlayer(r,ps[3]);assert.equal(start(r),false);const p=addPlayer(r,'p4','Extra');assert.equal(start(r),false);chooseTeam(r,p,'blue');assert.equal(start(r),false);chooseTeam(r,p,'red');assert.ok(start(r));});
test('one Builder per team, auto-assignment, roles locked during battle',()=>{const {r,ps}=setup();assert.ok(chooseRole(r,ps[1],'builder'));assert.equal(chooseRole(r,ps[0],'builder'),false);start(r);assert.equal(r.players.filter(p=>p.role==='builder').length,2);assert.equal(ps[1].role,'builder');assert.equal(chooseRole(r,ps[0],'builder'),false);assert.equal(chooseTeam(r,ps[0],'red'),false);});
test('30 initial arrows, consumption, shot limits, no ammo regeneration',()=>{const {r,ps}=battle(),p=ps[1];assert.equal(p.ammo,30);assert.ok(shoot(r,p,100,-20));assert.equal(p.ammo,29);assert.equal(shoot(r,p,100,0),false);assert.equal(shoot(r,ps[0],100,0),false);p.ammo=0;step(r,.5);assert.equal(shoot(r,p,100,0),false);step(r,10);assert.equal(p.ammo,0);});
test('malformed shots and impossible movement are rejected or normalized',()=>{const {r,ps}=battle(),p=ps[1];assert.equal(shoot(r,p,NaN,0),false);assert.equal(shoot(r,p,Infinity,0),false);assert.equal(input(r,p,NaN,0,1),false);assert.ok(input(r,p,9999,9999,1));assert.ok(Math.hypot(p.ix,p.iy)<=1);assert.equal(input(r,p,1,0,1),false);const x=p.x;step(r,.1);assert.ok(Math.abs(p.x-x)<=C.speed*.1);step(r,.3);assert.equal(p.ix,0);});
test('builder-only placement, 500ms cooldown, 18 fixed slots, no removal',()=>{const {r,ps}=battle(),p=ps[0];assert.equal(place(r,ps[1],0),false);assert.equal(place(r,p,-1),false);assert.equal(place(r,p,18),false);assert.ok(place(r,p,0));assert.equal(place(r,p,1),false);step(r,.501);assert.ok(place(r,p,1));for(let s=2;s<18;s++){step(r,.501);assert.ok(place(r,p,s));}assert.equal(r.walls.blue.filter(Boolean).length,18);step(r,1);assert.equal(place(r,p,0),false);assert.equal(r.walls.blue.filter(Boolean).length,18);});
test('enemy box absorbs one arrow, reward returns exactly three to attacker',()=>{const {r,ps}=battle(),p=ps[1],g=grid('red',0);r.walls.red[0]=2;r.walls.red[3]=1;p.ammo=12;r.arrows=[arrow(p.id,'blue',g.x-40,g.y,850)];for(let i=0;i<4;i++)step(r,1/60);assert.equal(r.walls.red[0],0);assert.equal(r.walls.red[3],1);assert.equal(r.arrows.length,0);assert.equal(p.ammo,15);assert.equal(p.stats.rewards,1);assert.equal(p.stats.broken,1);assert.equal(r.score.blue,0);});
test('friendly arrows pass through own boxes and teammates',()=>{const {r,ps}=battle(),g=grid('blue',0);r.walls.blue[0]=1;ps[0].x=g.x;ps[0].y=g.y;r.arrows=[arrow(ps[1].id,'blue',g.x-30,g.y,850)];step(r,.1);assert.equal(r.walls.blue[0],1);assert.equal(ps[0].stats.deaths,0);assert.equal(r.arrows.length,1);});
test('one hit, one kill and score; no double hits',()=>{const {r,ps}=battle();ps[2].x=800;ps[2].y=300;ps[3].x=850;ps[3].y=300;r.arrows=[arrow(ps[1].id,'blue',750,300,850)];step(r,.1);assert.equal(r.score.blue,1);assert.equal(ps[2].stats.deaths,1);assert.equal(ps[3].stats.deaths,0);assert.equal(r.arrows.length,0);});
test('collision picks nearest object even when a balloon stands ahead of wall',()=>{const {r,ps}=battle();const g=grid('red',0);r.walls.red[0]=1;ps[3].x=g.x-50;ps[3].y=g.y;r.arrows=[arrow(ps[1].id,'blue',g.x-100,g.y,850)];step(r,.15);assert.equal(ps[3].stats.deaths,1);assert.equal(r.walls.red[0],1);});
test('Shooter respawns after .5s, Builder after 1.5s, shield lasts .5s',()=>{const {r,ps}=battle(),a=arrow(ps[1].id,'blue',0,0);assert.ok(pop(r,ps[3],a));assert.ok(pop(r,ps[2],a));step(r,.49);assert.ok(ps[3].deadUntil);step(r,.02);assert.equal(ps[3].deadUntil,0);assert.ok(ps[2].deadUntil);assert.equal(pop(r,ps[3],a),false);step(r,.49);assert.equal(pop(r,ps[3],a),false);step(r,.02);assert.ok(pop(r,ps[3],a));step(r,.49);assert.equal(ps[2].deadUntil,0);});
test('timer resolves winner or enters untimed sudden death; first kill wins',()=>{const {r,ps}=battle();r.endAt=r.now+.1;step(r,.11);assert.equal(r.phase,'sudden');step(r,100);assert.equal(r.phase,'sudden');pop(r,ps[3],arrow(ps[1].id,'blue',0,0));assert.equal(r.phase,'ended');assert.equal(r.winner,'blue');assert.ok(rematch(r));assert.equal(r.phase,'lobby');start(r);assert.equal(ps[1].ammo,30);assert.equal(r.score.blue,0);const other=battle();other.r.score.red=4;other.r.endAt=other.r.now+.1;step(other.r,.11);assert.equal(other.r.winner,'red');});
test('disconnect grace retains ammo and role; expiry replaces Builder and host',()=>{const {r,ps}=battle();ps[0].ammo=19;disconnect(r,ps[0]);step(r,19.9);assert.ok(r.players.includes(ps[0]));assert.equal(ps[0].ammo,19);ps[0].connected=true;step(r,.2);assert.ok(r.players.includes(ps[0]));disconnect(r,ps[0]);step(r,20.01);assert.equal(r.players.includes(ps[0]),false);assert.equal(ps[1].role,'builder');assert.equal(r.host,ps[1].id);});
test('boxes float indefinitely; empty slot can be rebuilt',()=>{const {r,ps}=battle();r.walls.blue[0]=1;r.walls.blue[3]=1;r.walls.blue[3]=0;step(r,50);assert.equal(r.walls.blue[0],1);assert.ok(place(r,ps[0],3));});
test('name cleaning strips markup, limits length and filters profanity',()=>{assert.equal(cleanName('<script>alert(1)</script>').includes('<'),false);assert.ok(cleanName('a'.repeat(100)).length<=16);assert.equal(cleanName('fuck'),'SkyRider');});

test('the visible arrowhead breaks an enemy crate before the shaft center reaches it',()=>{
 for(const team of ['blue','red'] as const){
  const {r,ps}=battle(),enemy=team==='blue'?'red':'blue',p=ps[team==='blue'?1:3],g=grid(enemy,7),direction=team==='blue'?1:-1;
  r.walls[enemy][7]=1;
  r.arrows=[arrow(p.id,team,g.x-direction*40,g.y,direction*850)];
  step(r,1/60);
  assert.equal(r.walls[enemy][7],0,`${team} arrowhead must destroy the crate on contact`);
  assert.equal(r.arrows.length,0);
  assert.equal(p.stats.broken,1);
 }
});

test('a bot cannot hide a destroyed crate by rebuilding it on the next simulation tick',()=>{
 const {r,ps}=battle(),g=grid('red',8);
 ps[2].bot=true;
 r.walls.red.fill(1);
 r.arrows=[arrow(ps[1].id,'blue',g.x-25,g.y,850)];
 step(r,1/60);
 assert.equal(r.walls.red[8],0);
 for(let i=0;i<30;i++)step(r,1/60);
 assert.equal(r.walls.red[8],0,'the destroyed slot must stay visibly empty while the bot reacts');
 for(let i=0;i<40;i++)step(r,1/60);
 assert.equal(r.walls.red[8]>0,true,'the bot may rebuild after its reaction delay');
 assert.equal(ps[1].stats.broken,1);
});
