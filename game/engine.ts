// Pure authoritative simulation. All times are monotonic seconds.
export type Team='blue'|'red';
export type Role='shooter'|'builder';
export type Phase='lobby'|'countdown'|'playing'|'sudden'|'ended';
export const C={width:1280,height:720,speed:235,gravity:270,maxForce:850,minForce:180,draw:130,sensitivity:6.5,arrowLife:5,maxArrows:96,shotCooldown:.32,buildCooldown:.5,rewardChance:.18,grace:20,protection:.5,shooterRespawn:.5,builderRespawn:1.5,box:42,arrowTip:21,botRepairDelay:.85};
export type Stats={kills:number;deaths:number;fired:number;hits:number;built:number;broken:number;rewards:number};
export type Player={id:string;name:string;team:Team|null;role:Role;personality:number;bot:boolean;connected:boolean;disconnectedAt:number;x:number;y:number;vx:number;vy:number;ix:number;iy:number;inputAt:number;seq:number;ammo:number;deadUntil:number;shieldUntil:number;shotAt:number;buildAt:number;aimUntil:number;happyUntil:number;stats:Stats};
export type Arrow={id:number;owner:string;team:Team;x:number;y:number;vx:number;vy:number;born:number};
export type Event={id:number;type:string;at:number;[key:string]:unknown};
export type Room={code:string;host:string;public:boolean;training:boolean;phase:Phase;botBuilders:boolean;matchAt:number;matchmakingSeconds:number|null;matchRoster:string;duration:number;maxPlayers:number;players:Player[];walls:Record<Team,number[]>;botRepairAfter:Record<Team,number[]>;arrows:Arrow[];score:Record<Team,number>;now:number;startAt:number;endAt:number;winner:Team|null;events:Event[];serial:number;revision:number;created:number;emptyAt:number;lastActive:number};
export const stats=():Stats=>({kills:0,deaths:0,fired:0,hits:0,built:0,broken:0,rewards:0});
export const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
export const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
export function cleanName(value:unknown){let s=typeof value==='string'?value.normalize('NFKC').replace(/[^\p{L}\p{N} _-]/gu,'').trim().slice(0,16):'';if(/fuck|shit|nigg|cunt|hitler/i.test(s))s='SkyRider';return s||'SkyRider';}
export function makeRoom(code:string,host:string,now=0,isPublic=false,training=false):Room{return {code,host,public:isPublic,training,phase:'lobby',botBuilders:false,matchAt:0,matchmakingSeconds:null,matchRoster:'',duration:180,maxPlayers:10,players:[],walls:{blue:Array(18).fill(0),red:Array(18).fill(0)},botRepairAfter:{blue:Array(18).fill(0),red:Array(18).fill(0)},arrows:[],score:{blue:0,red:0},now,startAt:0,endAt:0,winner:null,events:[],serial:0,revision:0,created:now,emptyAt:0,lastActive:now};}
export function emit(r:Room,type:string,extra:Record<string,unknown>={}){r.events.push({id:++r.serial,type,at:r.now,...extra});if(r.events.length>80)r.events.shift();}
export function addPlayer(r:Room,id:string,name:unknown,bot=false){if(r.phase!=='lobby')throw Error('That battle has already started.');if(r.players.length>=r.maxPlayers)throw Error('This room is full.');const p:Player={id,name:cleanName(name),team:null,role:'shooter',personality:r.players.length%4,bot,connected:true,disconnectedAt:0,x:0,y:0,vx:0,vy:0,ix:0,iy:0,inputAt:r.now,seq:0,ammo:30,deadUntil:0,shieldUntil:0,shotAt:-1,buildAt:-1,aimUntil:0,happyUntil:0,stats:stats()};r.players.push(p);r.revision++;return p;}
export function chooseTeam(r:Room,p:Player,team:unknown){if(r.phase!=='lobby'||(team!=='blue'&&team!=='red'))return false;if(p.team===team)return true;if(r.players.filter(q=>q.team===team).length>=5)return false;p.team=team;p.role='shooter';r.revision++;return true;}
export function chooseRole(r:Room,p:Player,role:unknown){if(r.phase!=='lobby'||!p.team||(role!=='shooter'&&role!=='builder'))return false;if(role==='builder'&&r.players.some(q=>q!==p&&q.team===p.team&&q.role==='builder'))return false;p.role=role;r.revision++;return true;}
export function startReason(r:Room){if(r.players.some(p=>!p.connected))return 'Waiting for a disconnected player to return.';if(r.players.length<4)return 'Bring at least 4 players to the sky.';if(r.players.some(p=>!p.team))return 'Everyone needs to choose a crew.';if(['blue','red'].some(t=>r.players.filter(p=>p.team===t).length<2))return 'Each crew needs at least 2 players.';return '';}
export function spawn(r:Room,p:Player,random=Math.random){p.x=p.team==='blue'?100+random()*170:1010+random()*170;p.y=130+random()*410;p.deadUntil=0;p.shieldUntil=r.now+C.protection;p.vx=p.vy=0;emit(r,'respawn',{player:p.id,x:p.x,y:p.y});}
export function ensureBuilders(r:Room){for(const t of ['blue','red'] as Team[]){const team=r.players.filter(p=>p.team===t);if(team.length&&!team.some(p=>p.role==='builder')){const p=team.find(p=>p.connected)||team[0];p.role='builder';emit(r,'builder',{player:p.id});}}}
export function start(r:Room){if(r.phase!=='lobby'||startReason(r))return false;ensureBuilders(r);r.phase='countdown';r.startAt=r.now+3;r.endAt=r.startAt+r.duration;r.winner=null;r.score={blue:0,red:0};r.walls={blue:Array(18).fill(0),red:Array(18).fill(0)};r.botRepairAfter={blue:Array(18).fill(0),red:Array(18).fill(0)};r.arrows=[];for(const p of r.players){p.stats=stats();p.ammo=30;p.ix=p.iy=0;p.shotAt=p.buildAt=-1;spawn(r,p);p.shieldUntil=r.startAt+C.protection;}emit(r,'countdown');r.revision++;return true;}
export function grid(team:Team,slot:number){const col=slot%3,row=Math.floor(slot/3);return {x:team==='blue'?410+col*46:870-col*46,y:220+row*46};}
export function active(r:Room){return r.phase==='playing'||r.phase==='sudden';}
export function place(r:Room,p:Player,slot:unknown,random=Math.random){if(!active(r)||!p.connected||p.role!=='builder'||!p.team||p.deadUntil||!Number.isInteger(slot)||Number(slot)<0||Number(slot)>17||r.now-p.buildAt<C.buildCooldown||r.walls[p.team][Number(slot)]||(p.bot&&r.now<r.botRepairAfter[p.team][Number(slot)]))return false;p.buildAt=r.now;r.walls[p.team][Number(slot)]=random()<C.rewardChance?2:1;p.stats.built++;emit(r,'build',{team:p.team,slot,player:p.id});r.revision++;return true;}
export function shotVector(dx:number,dy:number){const len=Math.hypot(dx,dy),power=clamp(len*C.sensitivity,C.minForce,C.maxForce);return {vx:dx/(len||1)*power,vy:dy/(len||1)*power};}
export function shoot(r:Room,p:Player,dx:unknown,dy:unknown){if(!active(r)||!p.connected||p.role!=='shooter'||!p.team||p.deadUntil||p.ammo<1||!finite(dx)||!finite(dy)||Math.hypot(dx,dy)<5||r.now-p.shotAt<C.shotCooldown||r.arrows.length>=C.maxArrows)return false;const v=shotVector(dx,dy);p.shotAt=r.now;p.ammo--;p.stats.fired++;r.arrows.push({id:++r.serial,owner:p.id,team:p.team,x:p.x,y:p.y,vx:v.vx,vy:v.vy,born:r.now});emit(r,'shot',{player:p.id,x:p.x,y:p.y});return true;}
export function input(r:Room,p:Player,x:unknown,y:unknown,seq:unknown){if(!active(r)||!finite(x)||!finite(y)||!finite(seq)||seq<=p.seq)return false;const len=Math.max(1,Math.hypot(x,y));p.ix=x/len;p.iy=y/len;p.seq=seq;p.inputAt=r.now;return true;}
export function finish(r:Room,winner:Team){r.phase='ended';r.winner=winner;r.arrows=[];emit(r,'win',{team:winner});r.revision++;}
export function pop(r:Room,p:Player,a:Arrow){if(p.deadUntil||r.now<p.shieldUntil||p.team===a.team)return false;const killer=r.players.find(q=>q.id===a.owner);p.stats.deaths++;p.deadUntil=r.now+(p.role==='builder'?C.builderRespawn:C.shooterRespawn);p.ix=p.iy=0;if(killer){killer.stats.kills++;killer.stats.hits++;killer.happyUntil=r.now+.85;}r.score[a.team]++;emit(r,'pop',{player:p.id,killer:a.owner,x:p.x,y:p.y,personality:killer?.personality??0});if(r.phase==='sudden')finish(r,a.team);return true;}
export function arrowHead(x:number,y:number,vx:number,vy:number){const speed=Math.hypot(vx,vy)||1;return {x:x+vx/speed*C.arrowTip,y:y+vy/speed*C.arrowTip};}
// Sweep through the visible arrowhead, not just the shaft center.
// Swept collisions choose the first target along the flight segment, preventing tunneling/double hits.
export function segmentCircle(x:number,y:number,nx:number,ny:number,cx:number,cy:number,r:number){const dx=nx-x,dy=ny-y,ox=x-cx,oy=y-cy,A=dx*dx+dy*dy,B=2*(ox*dx+oy*dy),D=B*B-4*A*(ox*ox+oy*oy-r*r);if(ox*ox+oy*oy<=r*r)return 0;if(!A||D<0)return Infinity;const t=(-B-Math.sqrt(D))/(2*A);return t>=0&&t<=1?t:Infinity;}
export function segmentBox(x:number,y:number,nx:number,ny:number,cx:number,cy:number){let low=0,high=1;for(const [p,d,c] of [[x,nx-x,cx],[y,ny-y,cy]]){if(Math.abs(d)<1e-8){if(p<c-C.box/2||p>c+C.box/2)return Infinity;}else{let a=(c-C.box/2-p)/d,b=(c+C.box/2-p)/d;if(a>b)[a,b]=[b,a];low=Math.max(low,a);high=Math.min(high,b);if(low>high)return Infinity;}}return low;}
export function disconnect(r:Room,p:Player){p.connected=false;p.disconnectedAt=r.now;p.ix=p.iy=0;r.revision++;}
export function removePlayer(r:Room,p:Player){r.players=r.players.filter(q=>q!==p);if(r.host===p.id)r.host=r.players.find(q=>q.connected&&!q.bot)?.id||r.players.find(q=>!q.bot)?.id||'';if(active(r)||r.phase==='countdown')ensureBuilders(r);r.revision++;}
export function rematch(r:Room){if(r.phase!=='ended')return false;r.phase='lobby';r.matchAt=0;r.matchmakingSeconds=null;r.matchRoster='';r.winner=null;r.arrows=[];r.revision++;return true;}
export function botStep(r:Room,p:Player,random=Math.random){if(!active(r)||p.deadUntil)return;const side=p.team==='blue'?1:-1;p.ix=Math.sin(r.now*.7+p.personality)*.35;p.iy=Math.cos(r.now*1.1+p.personality)*.6;p.inputAt=r.now;if(p.role==='builder'){const order=[7,10,4,13,1,16,6,9,3,12,0,15,8,11,5,14,2,17];const slot=order.find(s=>!r.walls[p.team!][s]&&r.now>=r.botRepairAfter[p.team!][s]);if(slot!==undefined)place(r,p,slot,random);}else if(r.now-p.shotAt>1.1+random()*.8){const target=r.players.filter(q=>q.team!==p.team&&!q.deadUntil)[Math.floor(random()*r.players.filter(q=>q.team!==p.team&&!q.deadUntil).length)];if(target){const dx=target.x-p.x,tt=Math.max(.4,Math.abs(dx)/650);shoot(r,p,dx/tt/6.5,(target.y-p.y-.5*C.gravity*tt*tt)/tt/6.5+(random()-.5)*20);}}if(p.x<80||p.x>1200)p.ix=side;}
export function step(r:Room,dt:number,random=Math.random){r.now+=dt;for(const p of [...r.players])if(!p.connected&&r.now-p.disconnectedAt>=C.grace)removePlayer(r,p);updateMatchmaking(r);if(r.phase==='countdown'&&r.now>=r.startAt){r.phase='playing';emit(r,'fight');r.revision++;}if(!active(r))return;if(r.phase==='playing'&&r.now>=r.endAt){if(r.score.blue===r.score.red){r.phase='sudden';emit(r,'sudden');r.revision++;}else{finish(r,r.score.blue>r.score.red?'blue':'red');return;}}
for(const p of r.players){if(p.bot)botStep(r,p,random);if(p.deadUntil){if(r.now>=p.deadUntil)spawn(r,p,random);else continue;}if(r.now-p.inputAt>.2)p.ix=p.iy=0;p.vx=p.ix*C.speed;p.vy=p.iy*C.speed;p.x=clamp(p.x+p.vx*dt,45,C.width-45);p.y=clamp(p.y+p.vy*dt,100,C.height-100);}
const kept:Arrow[]=[];for(const a of r.arrows){if(!active(r))break;const nx=a.x+a.vx*dt,ny=a.y+a.vy*dt+.5*C.gravity*dt*dt;const tip=arrowHead(nx,ny,a.vx,a.vy+C.gravity*dt);const enemy:Team=a.team==='blue'?'red':'blue';let best=Infinity,box=-1,victim:Player|undefined;for(let s=0;s<18;s++){if(!r.walls[enemy][s])continue;const g=grid(enemy,s),t=segmentBox(a.x,a.y,tip.x,tip.y,g.x,g.y);if(t<best){best=t;box=s;victim=undefined;}}for(const p of r.players){if(p.team!==enemy||p.deadUntil||r.now<p.shieldUntil)continue;const t=segmentCircle(a.x,a.y,tip.x,tip.y,p.x,p.y,25);if(t<best){best=t;box=-1;victim=p;}}
if(box>=0){const reward=r.walls[enemy][box]===2,killer=r.players.find(p=>p.id===a.owner);r.walls[enemy][box]=0;r.botRepairAfter[enemy][box]=r.now+C.botRepairDelay;if(killer){killer.stats.broken++;killer.stats.hits++;if(reward&&killer.role==='shooter'){killer.ammo+=3;killer.stats.rewards++;}}emit(r,'break',{team:enemy,slot:box,player:a.owner,reward});r.revision++;continue;}if(victim){pop(r,victim,a);continue;}a.x=nx;a.y=ny;a.vy+=C.gravity*dt;if(a.x>-100&&a.x<C.width+100&&a.y>-400&&a.y<C.height+100&&r.now-a.born<C.arrowLife)kept.push(a);}r.arrows=active(r)?kept:[];}
export function snapshot(r:Room){return {code:r.code,host:r.host,public:r.public,training:r.training,botBuilders:r.botBuilders,matchmakingSeconds:r.matchmakingSeconds,phase:r.phase,duration:r.duration,maxPlayers:r.maxPlayers,players:r.players,walls:r.walls,arrows:r.arrows,score:r.score,now:r.now,startAt:r.startAt,endAt:r.endAt,winner:r.winner,events:r.events,revision:r.revision};}
export type Snapshot=ReturnType<typeof snapshot>;

// Only private-room hosts may edit bot rosters. Bot players use the same simulation rules.
export function setBotBuilder(r:Room,actor:Player,team:unknown,enabled:unknown,id:string){
 if(r.phase!=='lobby'||r.host!==actor.id||r.public)throw Error('Only the private-room host can change bot Builders before battle.');
 if((team!=='blue'&&team!=='red')||typeof enabled!=='boolean')throw Error('Choose a valid crew and bot setting.');
 const builder=r.players.find(p=>p.team===team&&p.role==='builder');
 if(!enabled){if(builder?.bot)removePlayer(r,builder);return;}
 if(builder?.bot)return;
 if(builder)throw Error('A player is already the Builder. They must choose Shooter first.');
 if(r.players.filter(p=>p.team===team).length>=5)throw Error('That crew is full. A bot Builder needs one player slot.');
 const bot=addPlayer(r,id,team==='blue'?'Blue Builder':'Red Builder',true);
 chooseTeam(r,bot,team);chooseRole(r,bot,'builder');
}
export const MATCHMAKING_WAIT=8;
export function updateMatchmaking(r:Room){
 if(!r.public||r.phase!=='lobby')return;
 const roster=r.players.map(p=>`${p.id}:${p.team}:${p.role}:${p.connected}`).sort().join('|');
 if(startReason(r)){if(r.matchAt||r.matchmakingSeconds!==null){r.matchAt=0;r.matchmakingSeconds=null;r.revision++;}r.matchRoster=roster;return;}
 if(!r.matchAt||r.matchRoster!==roster){r.matchAt=r.now+MATCHMAKING_WAIT;r.matchRoster=roster;}
 const left=Math.max(0,Math.ceil(r.matchAt-r.now));
 if(left!==r.matchmakingSeconds){r.matchmakingSeconds=left;r.revision++;}
 if(r.now>=r.matchAt)start(r);
}
