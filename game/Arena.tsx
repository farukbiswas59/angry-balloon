"use client";
import { useEffect,useRef } from 'react';
import { C,clamp,grid,shotVector,arrowHead,segmentBox } from './engine';
import type { Snapshot,Player,Team,Arrow } from './engine';
import type { Connection } from './client';
import { sound } from './audio';
import { drawExpression, playerExpression } from './expressions';
import type { Reaction, Expression } from './expressions';
import { INK,PAPER,SUN,MINT,TEAM,label,tag,drawCrate,clouds,drawArrow,drawBow } from './art';
type Point={x:number;y:number};
type Ghost={x:number;y:number;vx:number;vy:number;at:number;team:Team;hidden:boolean};
type Particle={x:number;y:number;vx:number;vy:number;life:number;max:number;color:string;size:number;spin:number;angle:number};
type Ring={x:number;y:number;life:number;max:number;color:string;radius:number};
type Floater={x:number;y:number;text:string;life:number;max:number;color:string;size:number;burst?:boolean};

export default function Arena({connection,state}:{connection:Connection;state:Snapshot}){const canvas=useRef<HTMLCanvasElement>(null),latest=useRef(state);latest.current=state;
useEffect(()=>{const el=canvas.current;if(!el)return;const context=el.getContext('2d');if(!context)return;const ctx:CanvasRenderingContext2D=context;const view:HTMLCanvasElement=el;
const sprites=new Image();sprites.src='/art/balloons.png';const sky=new Image();sky.src='/art/sky.png';
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;let touch=matchMedia('(pointer: coarse)').matches;
let frame=0,last=performance.now(),seen=0,prevCountdown=4,shake=0;let scale=1,ox=0,oy=0,w=0,h=0;
const reactions=new Map<string,Reaction>();let lastExpression:Expression='idle';
const keys=new Set<string>(),smooth=new Map<string,Point>(),wallSeen=new Map<string,number>();
let joystick:{id:number;origin:Point;current:Point}|null=null,aim:{id:number;origin:Point;current:Point}|null=null;
const particles:Particle[]=[],rings:Ring[]=[],floaters:Floater[]=[];let banner:{text:string;until:number}|null=null;
let latestPacket:Snapshot|null=null,rxAt=performance.now();
// Own balloon: `predicted` is where we believe we are; `visual` eases corrections out over ~80ms.
let predicted:Point|null=null;const visual={x:0,y:0},history:{t:number;x:number;y:number}[]=[];
// Input goes out when it changes (max 30Hz) plus a 100ms keepalive while moving; the server idles input after 200ms.
let seq=latest.current.players.find(p=>p.id===connection.id)?.seq||0,sent={x:0,y:0},sentAt=0,lastAim=0;
// Shots and crates appear on release/tap, then hand over to the server's authoritative copy.
const ghosts:Ghost[]=[],arrowOffset=new Map<number,{x:number;y:number;at:number}>(),pendingBuilds=new Map<number,number>();
let localShotAt=-1e9,localBuildAt=-1e9;
const online=()=>!connection.practice;const current=()=>connection.state||latest.current;const me=()=>current().players.find(p=>p.id===connection.id);
const world=(e:PointerEvent):Point=>{const b=view.getBoundingClientRect();return {x:(e.clientX-b.left-ox)/scale,y:(e.clientY-b.top-oy)/scale};};
const canPlay=()=>innerWidth>=innerHeight&&!document.hidden&&connection.status==='online'&&!connection.practicePaused&&(current().phase==='playing'||current().phase==='sudden');
const rtt=()=>online()?connection.rtt:0;const fs=(n:number)=>Math.max(n,10/scale);
const position=():Point|null=>predicted&&{x:predicted.x+visual.x,y:predicted.y+visual.y};
const ammo=(p:Player)=>Math.max(0,p.ammo-ghosts.length);
// Touch controls hug the real screen edges, so on 19.5:9 phones they sit in the side margins instead of over the arena.
const controls=()=>{const R=(w-ox)/scale,B=(h-oy)/scale,L=-ox/scale;return {L,joy:{x:L+145,y:B-150},pad:{x:R-170,y:B-180},grid:{x:R-179,y:B-319},label:B-48};};
const sendInput=(x:number,y:number,now:number)=>{connection.send({type:'input',x,y,seq:++seq});sent={x,y};sentAt=now;};
function resize(){const rect=view.getBoundingClientRect();w=rect.width;h=rect.height;const dpr=Math.min(devicePixelRatio,2);view.width=w*dpr;view.height=h*dpr;scale=Math.min(w/C.width,h/C.height);ox=(w-C.width*scale)/2;oy=(h-C.height*scale)/2;ctx.setTransform(dpr,0,0,dpr,0,0);}
const observer=new ResizeObserver(resize);observer.observe(view);resize();
function build(slot:number){const p=me(),now=performance.now();if(!p?.team)return;if(!online()){connection.send({type:'place',slot});return;}
 // Mirror the server's checks (with a little jitter margin) so a ghost crate is almost never rejected.
 if(current().walls[p.team][slot]||pendingBuilds.has(slot)||now-localBuildAt<(C.buildCooldown+.04)*1000)return;
 localBuildAt=now;pendingBuilds.set(slot,now);sound.fx('build');connection.send({type:'place',slot});}
function fire(dx:number,dy:number){const p=me(),now=performance.now();if(!p?.team)return;sound.vibrate(8);if(!online()){connection.send({type:'shoot',dx,dy});return;}
 if(!predicted||Math.hypot(dx,dy)<5||ammo(p)<1||now-localShotAt<(C.shotCooldown+.03)*1000)return;
 const v=shotVector(dx,dy);localShotAt=now;ghosts.push({x:predicted.x,y:predicted.y,vx:v.vx,vy:v.vy,at:now,team:p.team,hidden:false});
 connection.send({type:'shoot',dx,dy,x:Math.round(predicted.x*10)/10,y:Math.round(predicted.y*10)/10});sound.fx('shot');}
function down(e:PointerEvent){sound.unlock();if(e.pointerType==='touch')touch=true;if(!canPlay())return;const p=me();if(!p||p.deadUntil)return;const q=world(e),ui=controls();try{view.setPointerCapture(e.pointerId);}catch{}if(q.x<ui.L+280&&q.y>ui.joy.y-130&&!joystick){joystick={id:e.pointerId,origin:q,current:q};return;}if(p.role==='builder'){// Right-thumb grid mirrors the actual wall: same slot order for both crews.
const col=Math.floor((q.x-ui.grid.x+21)/48),row=Math.floor((q.y-ui.grid.y+21)/48);if(col>=0&&col<3&&row>=0&&row<6){build(row*3+col);return;}for(let s=0;s<18;s++){const g=grid(p.team!,s);if(Math.abs(q.x-g.x)<23&&Math.abs(q.y-g.y)<23){build(s);return;}}}else if(!aim&&ammo(p)>0){const pos=position()||p;if(Math.hypot(q.x-ui.pad.x,q.y-ui.pad.y)<125||Math.hypot(q.x-pos.x,q.y-pos.y)<80){aim={id:e.pointerId,origin:q,current:q};connection.send({type:'aim'});sound.fx('tension');}}}
function move(e:PointerEvent){const q=world(e);if(joystick?.id===e.pointerId)joystick.current=q;if(aim?.id===e.pointerId){aim.current=q;if(performance.now()-lastAim>=100){connection.send({type:'aim'});lastAim=performance.now();}}}
function up(e:PointerEvent){if(joystick?.id===e.pointerId)joystick=null;if(aim?.id===e.pointerId){if(e.type!=='pointercancel'&&canPlay())fire(aim.origin.x-aim.current.x,aim.origin.y-aim.current.y);aim=null;}}
function reset(){keys.clear();joystick=null;aim=null;sendInput(0,0,performance.now());}const keyDown=(e:KeyboardEvent)=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'].includes(e.key)){e.preventDefault();keys.add(e.key);}},keyUp=(e:KeyboardEvent)=>keys.delete(e.key);view.addEventListener('pointerdown',down);view.addEventListener('pointermove',move);view.addEventListener('pointerup',up);view.addEventListener('pointercancel',up);window.addEventListener('keydown',keyDown);window.addEventListener('keyup',keyUp);window.addEventListener('blur',reset);window.addEventListener('orientationchange',reset);document.addEventListener('visibilitychange',reset);
function burst(x:number,y:number,color:string,count:number,speed:number,size=6){for(let i=0;i<count&&particles.length<160;i++){const a=Math.random()*Math.PI*2,v=speed*(.4+Math.random()*.6),life=.45+Math.random()*.35;particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-60,life,max:life,color,size:size*(.6+Math.random()*.6),spin:(Math.random()-.5)*14,angle:Math.random()*6});}}
function ring(x:number,y:number,color:string,radius:number,max=.4){rings.push({x,y,life:max,max,color,radius});}
function floater(x:number,y:number,text:string,color=SUN,size=22,burstStar=false){floaters.push({x,y,text,life:burstStar?.7:1,max:burstStar?.7:1,color,size,burst:burstStar});}
// Server arrows are extrapolated from the last packet, stopped at enemy walls, and eased from the ghost that preceded them.
function arrowAt(a:Arrow,s:Snapshot,age:number,now:number){const enemy:Team=a.team==='blue'?'red':'blue',tip=arrowHead(a.x+a.vx*age,a.y+a.vy*age+.5*C.gravity*age*age,a.vx,a.vy+C.gravity*age);let hit=1;for(let slot=0;slot<18;slot++){if(!s.walls[enemy][slot])continue;const g=grid(enemy,slot);hit=Math.min(hit,segmentBox(a.x,a.y,tip.x,tip.y,g.x,g.y));}let x=a.x+a.vx*age,y=a.y+a.vy*age+.5*C.gravity*age*age;if(hit<1){x=a.x+(tip.x-a.x)*hit-(tip.x-x);y=a.y+(tip.y-a.y)*hit-(tip.y-y);}const o=arrowOffset.get(a.id);if(o){const f=Math.exp(-(now-o.at)/110);x+=o.x*f;y+=o.y*f;if(f<.02)arrowOffset.delete(a.id);}return {x,y,angle:Math.atan2(a.vy+C.gravity*age,a.vx)};}
function ghostAt(g:Ghost,now:number){const t=(now-g.at)/1000;return {x:g.x+g.vx*t,y:g.y+g.vy*t+.5*C.gravity*t*t,angle:Math.atan2(g.vy+C.gravity*t,g.vx)};}
function render(now:number){const dt=Math.min((now-last)/1000,.04);last=now;const s=current(),p=me(),age=online()?Math.min((now-rxAt)/1000,.1):0;
if(latestPacket!==s){latestPacket=s;rxAt=connection.receivedAt||now;if(p){if(!online()||!predicted||p.deadUntil){predicted={x:p.x,y:p.y};history.length=0;visual.x=visual.y=0;}else{
 // The server's position reflects our inputs from one round trip ago, so compare against that moment.
 const then=rxAt-rtt();let ref:Point=predicted;for(let i=history.length-1;i>=0;i--){ref=history[i];if(history[i].t<=then)break;}const dx=p.x-ref.x,dy=p.y-ref.y;
 if(Math.hypot(dx,dy)>140){predicted={x:p.x,y:p.y};history.length=0;visual.x=visual.y=0;}else if(dx||dy){const nx=clamp(predicted.x+dx,45,C.width-45),ny=clamp(predicted.y+dy,100,C.height-100);visual.x-=nx-predicted.x;visual.y-=ny-predicted.y;predicted.x=nx;predicted.y=ny;for(const e of history){e.x+=dx;e.y+=dy;}}}}}
const gameNow=s.now+(online()?Math.min((now-rxAt)/1000,.15):0);let ix=(keys.has('d')||keys.has('ArrowRight')?1:0)-(keys.has('a')||keys.has('ArrowLeft')?1:0),iy=(keys.has('s')||keys.has('ArrowDown')?1:0)-(keys.has('w')||keys.has('ArrowUp')?1:0);if(joystick){ix=(joystick.current.x-joystick.origin.x)/65;iy=(joystick.current.y-joystick.origin.y)/65;}const len=Math.max(1,Math.hypot(ix,iy));ix=Math.round(ix/len*100)/100;iy=Math.round(iy/len*100)/100;if(!canPlay()||!p||p.deadUntil)ix=iy=0;
const moving=ix!==0||iy!==0,wasMoving=sent.x!==0||sent.y!==0;if((Math.abs(ix-sent.x)>.04||Math.abs(iy-sent.y)>.04||moving!==wasMoving)&&(now-sentAt>=33||!moving))sendInput(ix,iy,now);else if(moving&&now-sentAt>=100)sendInput(ix,iy,now);
if(p&&!online())predicted={x:p.x,y:p.y};else if(p&&predicted&&!p.deadUntil){if(canPlay()){predicted.x=clamp(predicted.x+ix*C.speed*dt,45,C.width-45);predicted.y=clamp(predicted.y+iy*C.speed*dt,100,C.height-100);}history.push({t:now,x:predicted.x,y:predicted.y});while(history.length&&history[0].t<now-1500)history.shift();}
const ease=reducedMotion?1:1-Math.exp(-dt*13);visual.x-=visual.x*ease;visual.y-=visual.y*ease;
if(!canPlay()){joystick=null;aim=null;}
for(const ev of s.events){if(ev.id<=seen)continue;seen=ev.id;if(gameNow-ev.at>1)continue;const mine=ev.player===connection.id;
 // Our own shots and builds already played their sound locally when the thumb lifted.
 const predictedLocally=mine&&online()&&(ev.type==='shot'||ev.type==='build');
 if(ev.type==='shot'&&predictedLocally){const ghost=ghosts.shift();const arrow=s.arrows.find(a=>a.id===ev.id-1);if(ghost&&arrow){const from=ghostAt(ghost,now),to=arrowAt(arrow,s,age,now);arrowOffset.set(arrow.id,{x:from.x-to.x,y:from.y-to.y,at:now});}}
 if(ev.type==='build'){const g=grid(ev.team as Team,Number(ev.slot));ring(g.x,g.y,PAPER,32,.3);if(predictedLocally)pendingBuilds.delete(Number(ev.slot));}
 if(!predictedLocally&&['pop','break','shot','build','respawn','win','countdown','fight'].includes(ev.type))sound.fx(ev.type==='win'?(ev.team===p?.team?'win':'lose'):ev.type==='fight'?'win':ev.type);
 if(ev.type==='fight')banner={text:'POP ’EM!',until:now+900};if(ev.type==='sudden')banner={text:'SUDDEN DEATH',until:now+1400};
 if(ev.type==='builder'&&mine){floater(640,300,'YOU’RE THE BUILDER!',SUN,30);sound.fx('reward');}
 if(ev.type==='pop'){const victim=s.players.find(q=>q.id===ev.player),x=Number(ev.x),y=Number(ev.y);reactions.set(String(ev.killer),{expression:'cheer',until:gameNow+1.1});reactions.set(String(ev.player),{expression:'angry',until:gameNow+1.2});burst(x,y,TEAM[victim?.team||'red'].main,22,420,7);burst(x,y,PAPER,6,260,4);ring(x,y,PAPER,70,.35);floater(x,y-10,'POP!',SUN,30,true);if(mine){sound.vibrate(35);shake=14;}if(ev.killer===connection.id){floater(x,y-50,'+1',MINT,24);shake=Math.max(shake,4);}}
 if(ev.type==='respawn'&&s.phase!=='countdown'){reactions.set(String(ev.player),{expression:'angry',until:gameNow+.35,after:{expression:'dizzy',until:gameNow+1.2}});ring(Number(ev.x),Number(ev.y),PAPER,46,.4);}
 if(ev.type==='build')reactions.set(String(ev.player),{expression:'wink',until:gameNow+.55});
 if(ev.type==='ammo-circle'||ev.type==='break'&&ev.reward)reactions.set(String(ev.player),{expression:'cheer',until:gameNow+.85});
 if(ev.type==='ammo-circle'){ring(C.width/2,C.height/2,SUN,110,.5);if(mine){sound.fx('reward');floater(p?.x||640,(p?.y||360)-40,'+5 ARROWS',MINT,24);}}
 if(ev.type==='break'){const g=grid(ev.team as Team,Number(ev.slot));burst(g.x,g.y,'#c27536',14,300,6);burst(g.x,g.y,TEAM[ev.team as Team].main,5,220,5);ring(g.x,g.y,'#f0b46c',40,.3);if(mine){floater(g.x,g.y-30,'+3 ARROWS',MINT,20);sound.fx('reward');}if(p?.team===ev.team&&p?.role==='builder')shake=Math.max(shake,3);}}
if(p&&!p.deadUntil){const expression=playerExpression(p,s,gameNow,reactions.get(p.id));if(expression!==lastExpression){sound.expression(expression,p.personality);lastExpression=expression;}}
for(let i=ghosts.length-1;i>=0;i--)if(now-ghosts[i].at>450+rtt()*2)ghosts.splice(i,1);
for(const [slot,at] of pendingBuilds)if(p?.team&&s.walls[p.team][slot]||now-at>600+rtt()*1.5)pendingBuilds.delete(slot);
sound.mode=s.phase==='sudden'?'sudden':s.endAt-gameNow<30?'urgent':s.phase==='playing'?'battle':'lobby';
// Backdrop in screen space: graded sky with a slight parallax on the player's position.
ctx.setTransform(Math.min(devicePixelRatio,2),0,0,Math.min(devicePixelRatio,2),0,0);ctx.fillStyle='#3a2c6e';ctx.fillRect(0,0,w,h);const me0=position();
if(sky.complete&&sky.naturalWidth){const zoom=Math.max(w/sky.width,h/sky.height)*1.06,bw=sky.width*zoom,bh=sky.height*zoom,px=me0?(me0.x-640)/640:0,py=me0?(me0.y-360)/360:0;ctx.drawImage(sky,(w-bw)/2-px*w*.012+(reducedMotion?0:Math.sin(now/18000)*6),(h-bh)/2-py*h*.01,bw,bh);}
const grade=ctx.createLinearGradient(0,0,0,h);grade.addColorStop(0,'rgba(36,26,84,.55)');grade.addColorStop(.42,'rgba(60,40,110,.08)');grade.addColorStop(1,'rgba(255,140,90,.12)');ctx.fillStyle=grade;ctx.fillRect(0,0,w,h);
if(shake>.3&&!reducedMotion){ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);}shake*=Math.exp(-dt*9);
ctx.translate(ox,oy);ctx.scale(scale,scale);const L=-ox/scale,R=(w-ox)/scale,T=-oy/scale,B=(h-oy)/scale;
// Crew territories and the midline.
let tint=ctx.createLinearGradient(L,0,420,0);tint.addColorStop(0,'rgba(47,155,255,.22)');tint.addColorStop(1,'rgba(47,155,255,0)');ctx.fillStyle=tint;ctx.fillRect(L,T,420-L,B-T);
tint=ctx.createLinearGradient(R,0,860,0);tint.addColorStop(0,'rgba(255,77,61,.22)');tint.addColorStop(1,'rgba(255,77,61,0)');ctx.fillStyle=tint;ctx.fillRect(860,T,R-860,B-T);
ctx.setLineDash([2,14]);ctx.lineCap='round';ctx.strokeStyle='rgba(255,246,227,.35)';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(640,100);ctx.lineTo(640,620);ctx.stroke();ctx.setLineDash([]);
// Cloud floor, drifting slowly and tiled across any letterbox.
const bank=clouds(),drift=reducedMotion?0:(now/60)%1280;for(let x=Math.floor((L+drift)/1280)*1280-drift;x<R;x+=1280)ctx.drawImage(bank,Math.floor(x),560,1281,220);
const active=s.phase==='playing'||s.phase==='sudden';
// Older installed clients remain compatible; only new snapshots show the pickup.
if(s.ammoCircle&&active){const x=C.width/2,y=C.height/2,radius=C.ammoCircleRadius,ready=gameNow>=s.ammoCircle.readyAt,progress=clamp((p?.ammoCircleTime||0)/C.ammoCircleHold,0,1);ctx.save();ctx.globalAlpha=ready?1:.35;ctx.fillStyle='rgba(255,197,49,.18)';ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();ctx.setLineDash([12,9]);ctx.lineDashOffset=reducedMotion?0:-now/45;ctx.strokeStyle=SUN;ctx.lineWidth=4;ctx.stroke();ctx.setLineDash([]);
 if(ready){if(progress){ctx.lineCap='round';ctx.strokeStyle=INK;ctx.lineWidth=12;ctx.beginPath();ctx.arc(x,y,radius+9,-Math.PI/2,-Math.PI/2+progress*Math.PI*2);ctx.stroke();ctx.strokeStyle=MINT;ctx.lineWidth=7;ctx.stroke();}for(const i of [-1,0,1]){ctx.save();ctx.translate(x+i*10,y-8);ctx.rotate(-Math.PI/2+i*.22);ctx.scale(.55,.55);drawArrow(ctx,p?.team||'blue',false);ctx.restore();}label(ctx,progress?`${Math.max(0,C.ammoCircleHold-(p?.ammoCircleTime||0)).toFixed(1)}s`:'+5',x,y+26,fs(20),SUN);}ctx.restore();}
// Walls; new crates pop in.
for(const team of ['blue','red'] as const)for(let slot=0;slot<18;slot++){const g=grid(team,slot),key=team+slot,value=s.walls[team][slot]||(p?.team===team&&pendingBuilds.has(slot)?1:0);if(value){if(!wallSeen.has(key))wallSeen.set(key,now);const t=clamp((now-wallSeen.get(key)!)/160,0,1),pop=reducedMotion?1:.7+.3*t+Math.sin(t*Math.PI)*.12;drawCrate(ctx,team,g.x,g.y,s.walls[team][slot]?1:.6,pop);}else{wallSeen.delete(key);if(p?.role==='builder'&&p.team===team){ctx.strokeStyle='rgba(255,246,227,.45)';ctx.lineWidth=2;ctx.setLineDash([5,5]);ctx.beginPath();ctx.roundRect(g.x-19,g.y-19,38,38,7);ctx.stroke();ctx.setLineDash([]);}}}
for(const q of s.players){let pos=smooth.get(q.id)||{x:q.x,y:q.y};if(q.id===connection.id&&predicted&&!q.deadUntil)pos=position()!;else{const tx=q.x+q.vx*age,ty=q.y+q.vy*age;if(Math.hypot(tx-pos.x,ty-pos.y)>150||!online())pos={x:tx,y:ty};else{pos.x+=(tx-pos.x)*Math.min(1,dt*18);pos.y+=(ty-pos.y)*Math.min(1,dt*18);}}smooth.set(q.id,pos);if(q.deadUntil){if(q.id===connection.id)tag(ctx,`BACK IN ${Math.max(0,q.deadUntil-gameNow).toFixed(1)}s`,640,360,fs(26),INK);continue;}
 const team=q.team||'blue',happy=q.happyUntil>gameNow,focused=q.aimUntil>gameNow,spriteIndex=q.role==='builder'?1:happy?3:focused?2:q.personality,self=q.id===connection.id;
 if(gameNow<q.shieldUntil){const bubble=ctx.createRadialGradient(pos.x-10,pos.y-14,4,pos.x,pos.y,40);bubble.addColorStop(0,'rgba(255,255,255,.35)');bubble.addColorStop(1,'rgba(155,216,255,.18)');ctx.fillStyle=bubble;ctx.strokeStyle='rgba(255,255,255,.85)';ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(pos.x,pos.y,40,0,Math.PI*2);ctx.fill();ctx.stroke();}
 ctx.save();ctx.translate(pos.x,pos.y);ctx.rotate(reducedMotion?0:Math.sin(now/550+q.personality)*.05);const expression=playerExpression(q,s,gameNow,reactions.get(q.id));if(expression!=='idle')drawExpression(ctx,q,expression,gameNow+q.personality,reducedMotion);else if(sprites.complete&&sprites.naturalWidth)ctx.drawImage(sprites,spriteIndex*sprites.width/4,team==='blue'?0:sprites.height/2,sprites.width/4,sprites.height/2,-45,-45,90,90);ctx.restore();
 if(q.role==='builder'){ctx.save();ctx.translate(pos.x+30,pos.y+14);ctx.fillStyle=SUN;ctx.strokeStyle=INK;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-11);ctx.lineTo(10,-6);ctx.quadraticCurveTo(10,7,0,12);ctx.quadraticCurveTo(-10,7,-10,-6);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();}
 else{let angle=team==='blue'?0:Math.PI;if(self&&aim)angle=Math.atan2(aim.origin.y-aim.current.y,aim.origin.x-aim.current.x);drawBow(ctx,pos.x+Math.cos(angle)*34,pos.y+Math.sin(angle)*34,angle,aim&&self?Math.min(45,Math.hypot(aim.origin.x-aim.current.x,aim.origin.y-aim.current.y)/3):0,team);}
 tag(ctx,q.name+(q.bot?' · BOT':''),pos.x,pos.y-56,fs(12),self?SUN:TEAM[team].deep,self?INK:PAPER);
 if(self){const bob=reducedMotion?0:Math.sin(now/180)*3,y=pos.y-80+bob;ctx.fillStyle=SUN;ctx.strokeStyle=INK;ctx.lineWidth=2.5;ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(pos.x-8,y-6);ctx.lineTo(pos.x+8,y-6);ctx.lineTo(pos.x,y+4);ctx.closePath();ctx.fill();ctx.stroke();}
 if(!q.connected)tag(ctx,'RECONNECTING',pos.x,pos.y-84,fs(10),'#6d6690');}
for(const a of s.arrows){const at=arrowAt(a,s,age,now);ctx.save();ctx.translate(at.x,at.y);ctx.rotate(at.angle);drawArrow(ctx,a.team);ctx.restore();}
// Ghost arrows fly immediately; hide them where the server is about to report a hit.
for(const g of ghosts){const at=ghostAt(g,now),enemy:Team=g.team==='blue'?'red':'blue',tip=arrowHead(at.x,at.y,Math.cos(at.angle),Math.sin(at.angle));if(at.x<-100||at.x>C.width+100||at.y>C.height+100)g.hidden=true;for(let slot=0;slot<18&&!g.hidden;slot++){if(!s.walls[enemy][slot])continue;const c=grid(enemy,slot);if(Math.abs(tip.x-c.x)<C.box/2&&Math.abs(tip.y-c.y)<C.box/2)g.hidden=true;}for(const q of s.players)if(q.team===enemy&&!q.deadUntil&&gameNow>=q.shieldUntil&&Math.hypot(tip.x-q.x,tip.y-q.y)<25)g.hidden=true;if(g.hidden)continue;ctx.save();ctx.translate(at.x,at.y);ctx.rotate(at.angle);drawArrow(ctx,g.team);ctx.restore();}
const pos=position();if(aim&&p&&pos){const dx=aim.origin.x-aim.current.x,dy=aim.origin.y-aim.current.y,v=shotVector(dx,dy);for(let i=1;i<23;i++){const t=i*.065,x=pos.x+v.vx*t,y=pos.y+v.vy*t+.5*C.gravity*t*t;if(x<0||x>1280||y>680)break;ctx.globalAlpha=1-i/25;ctx.fillStyle=i%2?PAPER:SUN;ctx.strokeStyle=INK;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,Math.max(2,5-i*.13),0,Math.PI*2);ctx.fill();ctx.stroke();}ctx.globalAlpha=1;}
for(let i=rings.length-1;i>=0;i--){const r=rings[i];r.life-=dt;if(r.life<0){rings.splice(i,1);continue;}const t=1-r.life/r.max;ctx.globalAlpha=1-t;ctx.strokeStyle=r.color;ctx.lineWidth=6*(1-t)+1;ctx.beginPath();ctx.arc(r.x,r.y,r.radius*(.3+t*.7),0,Math.PI*2);ctx.stroke();}ctx.globalAlpha=1;
for(let i=particles.length-1;i>=0;i--){const v=particles[i];v.life-=dt;if(v.life<0){particles.splice(i,1);continue;}v.x+=v.vx*dt;v.y+=v.vy*dt;v.vy+=520*dt;v.vx*=1-dt*1.5;v.angle+=v.spin*dt;ctx.globalAlpha=Math.min(1,v.life/v.max*1.6);ctx.save();ctx.translate(v.x,v.y);ctx.rotate(v.angle);ctx.fillStyle=v.color;ctx.strokeStyle=INK;ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(-v.size/2,-v.size/3);ctx.lineTo(v.size/2,-v.size/2);ctx.lineTo(v.size/3,v.size/2);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();}ctx.globalAlpha=1;
for(let i=floaters.length-1;i>=0;i--){const f=floaters[i];f.life-=dt;if(f.life<0){floaters.splice(i,1);continue;}const t=1-f.life/f.max,grow=reducedMotion?1:Math.min(1,t*6)*(1+Math.sin(Math.min(1,t*6)*Math.PI)*.25);f.y-=(f.burst?10:42)*dt;ctx.globalAlpha=Math.min(1,f.life/f.max*3);ctx.save();ctx.translate(f.x,f.y);ctx.scale(grow,grow);if(f.burst){ctx.fillStyle=TEAM.red.main;ctx.strokeStyle=INK;ctx.lineWidth=3;ctx.lineJoin='round';ctx.beginPath();for(let k=0;k<20;k++){const r=k%2?24:40,a=k/20*Math.PI*2+.2;ctx.lineTo(Math.cos(a)*r*1.25,Math.sin(a)*r);}ctx.closePath();ctx.fill();ctx.stroke();}label(ctx,f.text,0,0,fs(f.size),f.color);ctx.restore();}ctx.globalAlpha=1;
if(s.phase==='sudden'){const pulse=reducedMotion?.5:.5+Math.sin(now/220)*.5,vig=ctx.createRadialGradient(640,360,300,640,360,820);vig.addColorStop(0,'rgba(255,77,61,0)');vig.addColorStop(1,`rgba(255,77,61,${.18+pulse*.2})`);ctx.fillStyle=vig;ctx.fillRect(L,T,R-L,B-T);}
if(s.phase==='countdown'){const left=s.startAt-gameNow,n=Math.max(1,Math.ceil(left)),f=left-Math.floor(left),bounce=reducedMotion?1:1+Math.max(0,f-.75)*1.6;if(n!==prevCountdown){sound.fx('countdown');prevCountdown=n;}ctx.fillStyle='rgba(29,24,56,.5)';ctx.fillRect(L,T,R-L,B-T);tag(ctx,'BLUE CREW',505,235,fs(24),TEAM.blue.main);label(ctx,'VS',640,236,fs(30),SUN);tag(ctx,'RED CREW',775,235,fs(24),TEAM.red.main);ctx.save();ctx.translate(640,380);ctx.scale(bounce,bounce);label(ctx,String(n),0,0,150,SUN);ctx.restore();label(ctx,p?.role==='builder'?'YOU’RE THE BUILDER! GUARD THE WALL.':'DRAW BACK. LET IT FLY.',640,500,fs(24),PAPER);}
if(banner&&now<banner.until){const t=1-(banner.until-now)/900,grow=reducedMotion?1:Math.min(1,t*5)*(1+Math.sin(Math.min(1,t*5)*Math.PI)*.2);ctx.save();ctx.translate(640,330);ctx.scale(grow,grow);ctx.rotate(-.04);label(ctx,banner.text,0,0,84,s.phase==='sudden'?TEAM.red.main:SUN);ctx.restore();}
// Touch controls sit in the bottom band (y > 620), where balloons can never fly.
const ui=controls(),PAD=ui.pad;if(touch){const joy=joystick?.origin||ui.joy,kx=joy.x+ix*40,ky=joy.y+iy*40;ctx.globalAlpha=joystick?.95:.7;ctx.fillStyle='rgba(29,24,56,.38)';ctx.strokeStyle='rgba(255,246,227,.7)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(joy.x,joy.y,62,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle=SUN;ctx.strokeStyle=INK;ctx.lineWidth=3.5;ctx.beginPath();ctx.arc(kx,ky,26,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='rgba(255,255,255,.55)';ctx.beginPath();ctx.ellipse(kx-8,ky-9,8,5,-.6,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;label(ctx,'MOVE',ui.joy.x,ui.label,fs(13),PAPER);}
if(p?.role==='shooter'){const team=p.team||'blue',pull=aim?Math.hypot(aim.origin.x-aim.current.x,aim.origin.y-aim.current.y):0,power=Math.min(1,pull/C.draw),a=aim?Math.atan2(aim.origin.y-aim.current.y,aim.origin.x-aim.current.x):team==='blue'?0:Math.PI,count=ammo(p);
 ctx.fillStyle='rgba(29,24,56,.3)';ctx.strokeStyle='rgba(255,246,227,.45)';ctx.lineWidth=2.5;ctx.setLineDash([3,9]);ctx.lineCap='round';ctx.beginPath();ctx.arc(PAD.x,PAD.y,92,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([]);
 if(aim){ctx.strokeStyle=INK;ctx.lineWidth=11;ctx.beginPath();ctx.arc(PAD.x,PAD.y,92,-Math.PI/2,-Math.PI/2+power*Math.PI*2);ctx.stroke();ctx.strokeStyle=power>.95?TEAM.red.main:SUN;ctx.lineWidth=6;ctx.stroke();}
 drawBow(ctx,PAD.x,PAD.y,a,aim?Math.min(45,pull/3):0,team,1.8);
 if(count)tag(ctx,aim?`POWER ${Math.round(power*100)}%`:`${count} ARROWS`,PAD.x,ui.label,fs(14),aim?SUN:count<=3?TEAM.red.main:INK,aim?INK:PAPER);else tag(ctx,'FLY TO CENTRE · +5',PAD.x,ui.label,fs(13),SUN,INK);}
else if(p?.team){const ready=gameNow-p.buildAt>=C.buildCooldown&&now-localBuildAt>=C.buildCooldown*1000;for(let slot=0;slot<18;slot++){const x=ui.grid.x+(slot%3)*48,y=ui.grid.y+Math.floor(slot/3)*48;if(s.walls[p.team][slot]||pendingBuilds.has(slot))drawCrate(ctx,p.team,x,y,s.walls[p.team][slot]?.9:.55,.95);else{ctx.fillStyle=ready?'rgba(29,24,56,.45)':'rgba(29,24,56,.25)';ctx.strokeStyle=ready?'rgba(255,246,227,.75)':'rgba(255,246,227,.3)';ctx.lineWidth=2;ctx.setLineDash([5,4]);ctx.beginPath();ctx.roundRect(x-20,y-20,40,40,8);ctx.fill();ctx.stroke();ctx.setLineDash([]);label(ctx,'+',x,y+1,fs(22),ready?PAPER:'rgba(255,246,227,.5)');}}tag(ctx,ready?'TAP TO BUILD':'RECHARGING…',ui.grid.x+48,ui.label+22,fs(12),ready?SUN:'#6d6690',ready?INK:PAPER);}
ctx.setTransform(1,0,0,1,0,0);frame=requestAnimationFrame(render);}
frame=requestAnimationFrame(render);return()=>{cancelAnimationFrame(frame);observer.disconnect();view.removeEventListener('pointerdown',down);view.removeEventListener('pointermove',move);view.removeEventListener('pointerup',up);view.removeEventListener('pointercancel',up);window.removeEventListener('keydown',keyDown);window.removeEventListener('keyup',keyUp);window.removeEventListener('blur',reset);window.removeEventListener('orientationchange',reset);document.removeEventListener('visibilitychange',reset);};},[connection]);return <canvas ref={canvas} className="battle-canvas" aria-label="Battlefield. Move with WASD or the left joystick. Pull the bow and release to fire. Builders tap wall slots. Stay in the centre circle for two seconds to collect five arrows."/>;}
