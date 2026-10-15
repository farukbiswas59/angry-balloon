"use client";
import { Fragment,useEffect,useRef,useState } from 'react';
import { ArrowRight,Crosshair,Users,Plus,Settings2,Maximize,Minimize,Volume2,VolumeX,HelpCircle,Shield,Wind,ArrowLeft,Copy,Check,Trophy,Link as LinkIcon,Radio,Shuffle,X,Gamepad2,Play,Sparkles,Wifi,Target,Hammer,RotateCw } from 'lucide-react';
import { Dialog,DialogContent,DialogTitle,DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs,TabsList,TabsTrigger,TabsContent } from '@/components/ui/tabs';
import { Connection } from '@/game/client';
import BootScreen from '@/game/BootScreen';
import { ads } from '@/game/ads';
import { nativeAndroid, nativeFullscreen } from '@/game/device';
import { phoneHost } from '@/game/lan-native';
import LocalRooms from '@/game/LocalRooms';
import type { DiscoveredRoom } from '@/game/lan-discovery';
import { lanAddress } from '@/game/lan-address';
import { registerRoomTool } from '@/game/webmcp';
import type { Snapshot,Player,Team } from '@/game/engine';
import { cleanName } from '@/game/engine';
import Arena from '@/game/Arena';
import { sound,defaults } from '@/game/audio';
import type { AudioPrefs } from '@/game/audio';
import { initialPlayerName, randomPlayerName } from '@/game/player-names';
import { PRACTICE_PRESETS } from '@/game/practice-presets';
import type { Difficulty } from '@/game/practice-presets';
function Avatar({player,large=false}:{player:Pick<Player,'team'|'personality'|'role'>;large?:boolean}){const col=player.role==='builder'?1:player.personality;return <div className={'avatar '+(player.team||'blue')+(large?' large':'')} style={{backgroundPosition:`${col/3*100}% ${player.team==='red'?100:0}%`}}/>;}
// Decorative sky behind every menu: graded art, drifting balloons and a cloud floor.
function Backdrop(){return <div className="backdrop" aria-hidden="true"><div className="backdrop-sky"/>{[0,1,2,3,4].map(i=><span key={i} className={'floaty floaty-'+i}/>)}<div className="cloud-floor"/></div>;}
const MODE_NOTES:Record<string,string>={
 'lan-browse':'Tap a room to join. You can also host here or enter an address and room code manually.',
 'lan-host':'No internet needed. Your room appears on nearby phones. Keep this phone in the game.',
 'lan-join':'Enter the host address shown in their lobby, plus their room code. No internet needed.',
 quick:'Join a matching room. The host starts the game, or it starts after 1 minute when both crews are ready.',
 create:'A private room for your friends. Share the code to bring them in.',
 practice:'You and a bot Builder versus two enemy bots. Runs entirely on your device, with 30 arrows and a 2-minute match. Practice pauses when you open a menu or leave the app.',
 join:'Enter your friend’s 5-character code to join their room.',
};
const clock=(seconds:number)=>`${Math.floor(Math.max(0,seconds)/60).toString().padStart(2,'0')}:${Math.floor(Math.max(0,seconds)%60).toString().padStart(2,'0')}`;
export default function Home(){const conn=useRef<Connection|null>(null);const playDialog=useRef<HTMLDivElement|null>(null);const customName=useRef(false);const [state,setState]=useState<Snapshot|null>(null),[status,setStatus]=useState('offline'),[id,setId]=useState(''),[dialog,setDialog]=useState(''),[name,setName]=useState(''),[code,setCode]=useState(''),[mode,setMode]=useState('quick'),[difficulty,setDifficulty]=useState<Difficulty>('medium'),[error,setError]=useState(''),[notice,setNotice]=useState(''),[prefs,setPrefs]=useState<AudioPrefs>(defaults),[copied,setCopied]=useState(false),[custom,setCustom]=useState(false),[how,setHow]=useState('shooter'),[botBuilders,setBotBuilders]=useState(true),[preferredTeam,setPreferredTeam]=useState('any'),[isFullscreen,setIsFullscreen]=useState(false),[privacyRequired,setPrivacyRequired]=useState(ads.privacyRequired),[lanIp,setLanIp]=useState(''),[hostAddresses,setHostAddresses]=useState<string[]>([]),[preparing,setPreparing]=useState(false),[latency,setLatency]=useState(0);const initial=useRef(false);
useEffect(()=>{const c=new Connection();conn.current=c;const unregister=registerRoomTool(c);let lastPaint=0,lastPhase='',lastStatus='',pending:ReturnType<typeof setTimeout>|undefined;
const paint=()=>{if(pending)clearTimeout(pending);pending=undefined;lastPaint=performance.now();lastPhase=c.state?.phase||'';lastStatus=c.status;setState(c.state);setStatus(c.status);setId(c.id);setLatency(c.latency);};
c.onChange=()=>{const active=!!c.practice||c.state?.phase==='playing'||c.state?.phase==='sudden';if(!active||lastPhase!==c.state?.phase||lastStatus!==c.status||performance.now()-lastPaint>=100)paint();else if(!pending)pending=setTimeout(paint,100-(performance.now()-lastPaint));};c.onError=s=>setError(s);const savedName=localStorage.getItem('ab-name');const firstName=initialPlayerName(savedName,localStorage.getItem('ab-name-mode'));customName.current=firstName===savedName;setName(firstName);try{const saved={...defaults,...JSON.parse(localStorage.getItem('ab-audio')||'{}')};setPrefs(saved);sound.prefs=saved;}catch{}const room=new URLSearchParams(location.search).get('room');if(room&&/^[A-Z2-9]{5}$/.test(room)){setCode(room);setMode('join');setDialog('play');}else {const token=sessionStorage.getItem('ab-session');if(token&&sessionStorage.getItem('ab-session-local')!=='1'){c.token=token;c.connect();}else if(token){sessionStorage.removeItem('ab-session');}}return()=>{if(pending)clearTimeout(pending);unregister();c.dispose();if(nativeAndroid())void phoneHost.stop();};},[]);
useEffect(()=>{conn.current?.setPracticePaused(!!dialog);},[dialog]);
useEffect(()=>ads.subscribe(()=>setPrivacyRequired(ads.privacyRequired)),[]);
useEffect(()=>{if(state?.phase==='ended'&&!conn.current?.local)ads.policy.complete(`${state.code}:${state.endAt}`);},[state?.phase,state?.code,state?.endAt]);
useEffect(()=>{const changed=()=>setIsFullscreen(nativeAndroid()||!!document.fullscreenElement);changed();document.addEventListener('fullscreenchange',changed);return()=>document.removeEventListener('fullscreenchange',changed);},[]);
useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),3500);return()=>clearTimeout(t);},[notice]);
useEffect(()=>{if(state?.phase==='countdown'&&!initial.current){initial.current=true;setDialog('');sound.unlock();if(!localStorage.getItem('ab-tutorial')){setNotice('Left thumb: fly. Right thumb: pull the bow, or tap a build slot.');localStorage.setItem('ab-tutorial','1');}}if(state?.phase==='lobby')initial.current=false;},[state?.phase]);
const me=state?.players.find(p=>p.id===id),host=state?.host===id,playing=!!state&&['countdown','playing','sudden','ended'].includes(state.phase);
function open(which:string,nextMode='quick'){sound.unlock();sound.fx('tap');setError('');setMode(nextMode);setDialog(which);}
async function play(room?:DiscoveredRoom){
 const playMode=room?'lan-join':mode;
 const joinCode=room?.code||code.trim().toUpperCase();
 const c=conn.current;if(!c||preparing)return;
 const n=cleanName(name.trim()||randomPlayerName());setName(n);localStorage.setItem('ab-name',n);localStorage.setItem('ab-name-mode',customName.current&&name.trim()?'custom':'preset');setError('');setPreparing(true);
 try {
  if(playMode==='practice'){c.startPractice(n,difficulty);setDialog('');sound.unlock();return;}
  if(playMode==='lan-host'){
   setPreparing(true);phoneHost.onError=message=>setError(message);
   const info=await phoneHost.start();setHostAddresses(info.addresses.map(ip=>`${ip}:${info.port}`));c.local=true;c.serverUrl='http://127.0.0.1:3001';
  }else if(playMode==='lan-join'){
   const address=lanAddress(room?.address||lanIp);c.local=true;c.serverUrl=address;setHostAddresses([]);
  }else{c.local=false;c.serverUrl='';setHostAddresses([]);await ads.initialize();}
  c.token='';await c.connect({type:'join',mode:playMode==='lan-host'?'create':playMode==='lan-join'?'join':playMode,name:n,code:joinCode,botBuilders,team:preferredTeam});setDialog('');sound.unlock();
 }catch(error){setError(error instanceof Error?error.message:'Could not start local play.');}
 finally{setPreparing(false);}
}
function send(m:Record<string,unknown>){conn.current?.send(m);sound.fx('tap');}
function changePref<K extends keyof AudioPrefs>(key:K,value:AudioPrefs[K]){setPrefs(p=>{const next={...p,[key]:value};sound.prefs=next;localStorage.setItem('ab-audio',JSON.stringify(next));return next;});sound.unlock();}
async function fullscreen(){
 if(nativeAndroid()){try{await nativeFullscreen(!isFullscreen);setIsFullscreen(!isFullscreen);}catch{setNotice('Could not switch fullscreen.');}return;}
 const entering=!document.fullscreenElement;
 try{
  if(entering){
   if(!document.documentElement.requestFullscreen){setNotice('Fullscreen is unavailable in this browser. Add the game to your home screen for more space.');return;}
   await document.documentElement.requestFullscreen();
  }else await document.exitFullscreen();
 }catch{setNotice('Could not switch fullscreen. Try the fullscreen button in your browser.');return;}
 const orientation=screen.orientation as ScreenOrientation&{lock?:(value:string)=>Promise<void>};
 if(entering){try{await orientation.lock?.('landscape');}catch{}}else orientation.unlock?.();
}

async function copyRoom(){if(!state)return;try{const url=location.origin==='https://localhost'?state.code:`${location.origin}/?room=${state.code}`;await navigator.clipboard.writeText(url);setCopied(true);setTimeout(()=>setCopied(false),2000);}catch{setNotice(`Share this room code: ${state.code}`);}}
function leave(){const completed=conn.current?.state?.phase==='ended';const local=!!conn.current?.local;conn.current?.leave();setDialog('');setError('');sound.mode='lobby';if(nativeAndroid()&&hostAddresses.length)void phoneHost.stop();setHostAddresses([]);if(completed&&!local)void ads.afterResults(false);}
const ready=!!state&&state.players.length>=4&&state.players.every(p=>p.team&&p.connected)&&(['blue','red'] as Team[]).every(t=>state.players.filter(p=>p.team===t).length>=2);
const roleIcon=(role:string)=>role==='builder'?<Shield size={16}/>:<Crosshair size={16}/>;
const ping=state?.practiceDifficulty?'local':latency<80?'good':latency<160?'fair':'poor';
const timeLeft=state?(state.phase==='countdown'?state.duration:state.endAt-state.now):0;
return <main className={'game-shell'+(playing?' in-battle':state?.phase==='lobby'?' in-lobby':'')} onPointerDown={()=>{if(!sound.ctx)sound.unlock();}}><BootScreen/>{!playing&&<Backdrop/>}
{!playing&&<header className="topbar">
 <a className="wordmark" href="/" aria-label="Angry Balloon home" onClick={e=>{if(state){e.preventDefault();setDialog('leave');}}}><span className="wordmark-top">ANGRY</span><span className="wordmark-main">BALLOON</span></a>
 <div className="toplinks">
  <span className="live-label"><i/>TEAM BATTLES · 4–10 PLAYERS</span>
  <button className="icon-btn" aria-label={prefs.music?'Mute music':'Enable music'} onClick={()=>changePref('music',!prefs.music)}>{prefs.music?<Volume2 size={19}/>:<VolumeX size={19}/>}</button>
  <button className="icon-btn" aria-label="Game settings" onClick={()=>open('settings')}><Settings2 size={19}/></button>
  <button className="icon-btn" aria-label={isFullscreen?'Exit fullscreen':'Enter fullscreen'} title={isFullscreen?'Exit fullscreen':'Enter fullscreen'} onClick={fullscreen}>{isFullscreen?<Minimize size={19}/>:<Maximize size={19}/>}</button>
 </div>
</header>}
{!state&&!['connecting','reconnecting'].includes(status)&&<><section className="home">
 <div className="home-copy">
  <div className="kicker"><Sparkles size={14}/> THE SKY IS YOUR BATTLEFIELD</div>
  <h1>Small balloons.{' '}<br/><em>Big attitude.</em></h1>
  <p className="lede">Fly, build, shoot, pop. Grab your crew and settle it in the sky.</p>
  <div className="cta-stack">
   <button className="btn btn-sun btn-xl" onClick={()=>open('play','quick')}><Play size={22} fill="currentColor"/> QUICK PLAY <ArrowRight size={22}/></button>
   <div className="cta-row">
    <button className="btn btn-paper" onClick={()=>open('play','create')}><Plus size={18}/> CREATE ROOM</button>
    <button className="btn btn-paper" onClick={()=>open('play','join')}><Users size={18}/> JOIN ROOM</button>
   </div>
   {nativeAndroid()&&<button className="btn btn-mint" onClick={()=>open('play','lan-browse')}><Wifi size={19}/> SAME WI-FI / HOTSPOT <ArrowRight size={18}/></button>}
   <button className="practice-card" onClick={()=>open('play','practice')}><span className="practice-icon"><Gamepad2 size={22}/></span><span className="practice-text"><b>OFFLINE PRACTICE</b><small>2 bot opponents · Easy / Medium / Hard</small></span><ArrowRight size={18}/></button>
   <span className="underplay">No sign-up. Just a name and a little anger.</span>
  </div>
 </div>
 <div className="poster" aria-hidden="true"><div className="poster-card">
  <div className="poster-head"><Wind size={14}/> SKYBOUND ARENA <span>01</span></div>
  <div className="poster-fight">
   <div className="fighter blue"><div className="sprite"/><span className="sticker blue">BLUE CREW</span></div>
   <div className="vs-burst"><span>VS</span></div>
   <div className="fighter red"><div className="sprite"/><span className="sticker red">RED CREW</span></div>
  </div>
  <div className="poster-foot"><span>BUILD YOUR WALL.</span><b>BREAK THEIRS.</b></div>
 </div></div>
</section>
<footer className="home-footer">
 <div className="tip"><span className="tip-icon"><Crosshair size={18}/></span><p><b>Draw. Release. Pop.</b><span>One arrow. One very bad day.</span></p></div>
 <div className="tip"><span className="tip-icon"><Shield size={18}/></span><p><b>One crew. Two roles.</b><span>Shooters attack. Builders have your back.</span></p></div>
 <button className="btn btn-ink" onClick={()=>open('help')}><HelpCircle size={17}/> HOW TO PLAY</button>
</footer></>}
{!state&&['connecting','reconnecting'].includes(status)&&<section className="connecting"><div className="sheet connect-card" role="status"><div className="connect-balloon"/><h2>{status==='reconnecting'?'Reconnecting…':'Finding your sky…'}</h2><p>{status==='reconnecting'?'Your spot is reserved for 20 seconds.':'Connecting to the multiplayer server.'}</p><button className="btn btn-paper" onClick={leave}>CANCEL</button></div></section>}
{state?.phase==='lobby'&&<section className="lobby">
 <div className="lobby-top">
  <div><div className="kicker">{conn.current?.local?'LOCAL NETWORK · PRIVATE ROOM':state.training?'PRACTICE · LABELED BOTS':state.public?'QUICK PLAY · PUBLIC ROOM':'FRIENDS ONLY · PRIVATE ROOM'}</div><h2>Choose your crew.</h2></div>
  <button className="room-ticket" onClick={copyRoom} aria-label={`Copy room code ${state.code}`}><span>ROOM CODE</span><b>{state.code}</b>{copied?<Check size={18}/>:<Copy size={18}/>}</button>
 </div>
 <div className="crews">{(['blue','red'] as Team[]).map((t,index)=>{const members=state.players.filter(p=>p.team===t),builder=members.find(p=>p.role==='builder');return <Fragment key={t}><section className={'crew-card '+t}>
  <header className="crew-head"><h3>{t} crew</h3><span>{members.length}/5</span></header>
  <ul className="roster">{members.map(p=><li className={'member'+(p.id===id?' is-me':'')} key={p.id}><Avatar player={p}/><div className="who"><b>{p.name}{p.id===id&&<small className="badge sun">YOU</small>}{p.bot&&<small className="badge">BOT</small>}{p.id===state.host&&<small className="badge ink">HOST</small>}</b><span>{!p.connected?'Reconnecting…':p.role==='builder'?'Builder':'Shooter'}</span></div><span className="role-icon">{roleIcon(p.role)}</span></li>)}
   {Array.from({length:Math.max(0,2-members.length)},(_,i)=><li className="member empty" key={'empty'+i}><Users size={17}/><span>Waiting for a crewmate</span></li>)}</ul>
  <div className="crew-meta"><span><Shield size={13}/> Builder {builder?'1/1':'0/1'}</span><span><Crosshair size={13}/> Shooters {members.filter(p=>p.role==='shooter').length}/4</span></div>
  <div className="toggle-row"><div><label htmlFor={'bot-'+t}>BOT BUILDER</label><small>{builder?.bot?'Server-controlled defense':builder?'Human Builder selected':'Let a bot defend this crew'}</small></div><Switch id={'bot-'+t} checked={!!builder?.bot} disabled={!host||state.public||!!builder&&!builder.bot||!builder&&(members.length>=5||state.players.length>=state.maxPlayers)} onCheckedChange={enabled=>send({type:'bot-builder',team:t,enabled})}/></div>
  <button className={'btn btn-team '+t} disabled={me?.team===t||members.length>=5} onClick={()=>send({type:'team',team:t})}>{me?.team===t?<><Check size={18}/> YOUR CREW</>:<>JOIN {t.toUpperCase()} <ArrowRight size={18}/></>}</button>
 </section>{index===0&&<div className="crews-vs" aria-hidden="true">VS</div>}</Fragment>;})}</div>
 <div className="lobby-controls">
  <div className="control"><span className="field-label">YOUR ROLE</span><div className="segmented"><button disabled={!me?.team} className={me?.role==='shooter'?'selected':''} onClick={()=>send({type:'role',role:'shooter'})}><Crosshair size={15}/> SHOOTER</button><button disabled={!me?.team||state.players.some(p=>p.id!==id&&p.team===me?.team&&p.role==='builder')} className={me?.role==='builder'?'selected':''} onClick={()=>send({type:'role',role:'builder'})}><Shield size={15}/> BUILDER</button></div></div>
  <div className="control"><span className="field-label">MATCH TIME</span><div className="segmented">{[120,180,300].map(n=><button key={n} disabled={!host||state.public} className={state.duration===n&&!custom?'selected':''} onClick={()=>{setCustom(false);send({type:'settings',duration:n});}}>{n/60} MIN</button>)}<button disabled={!host||state.public} className={custom?'selected':''} onClick={()=>setCustom(!custom)}>CUSTOM</button></div>{custom&&<label className="inline-field"><input className="field" aria-label="Custom minutes" type="number" min={1} max={10} value={state.duration/60} onChange={e=>{const n=Number(e.target.value);if(n>=1&&n<=10)send({type:'settings',duration:n*60});}}/>minutes (1–10)</label>}</div>
  <div className="control start"><button className="btn btn-sun btn-lg" disabled={!host||!ready} onClick={()=>send({type:'start'})}>{host?'START GAME':'WAITING FOR HOST'} <ArrowRight size={20}/></button><span className="hint">{state.public?(state.matchmakingSeconds?`Auto-start in ${state.matchmakingSeconds}s · ${ready?'Host can start now.':'Each crew needs at least 2.'}`:ready?'Starting game…':'Timer finished · waiting for both crews.'):(ready?'One Builder per crew is assigned automatically.':'At least 2 players per crew to take flight.')}</span></div>
 </div>
 <div className="lobby-extras">
  <div className="looks"><span className="field-label">YOUR LOOK</span>{[0,1,2,3].map(n=><button key={n} aria-label={['Cocky','Goofy','Grumpy','Mischievous'][n]} aria-pressed={me?.personality===n} className={me?.personality===n?'chosen':''} onClick={()=>send({type:'personality',value:n})}><Avatar player={{team:me?.team||'blue',personality:n,role:'shooter'}}/></button>)}</div>
  {host&&!state.public&&<label className="inline-field">ROOM LIMIT<input className="field" aria-label="Room player limit" type="number" min={Math.max(4,state.players.length)} max={10} value={state.maxPlayers} onChange={e=>send({type:'settings',maxPlayers:Number(e.target.value)})}/></label>}
  {hostAddresses.length>0&&<span className="lan-address" title="Keep this phone in the game while hosting"><Radio size={14}/> HOST {hostAddresses.join(' / ')}</span>}
  <span className="spacer"/>
  <button className="btn btn-paper btn-sm" onClick={copyRoom}><LinkIcon size={15}/> INVITE</button>
  <button className="btn btn-ghost btn-sm" onClick={()=>setDialog('leave')}><ArrowLeft size={15}/> LEAVE</button>
 </div>
 {state.players.some(p=>!p.team)&&<div className="unassigned">Choosing a crew: {state.players.filter(p=>!p.team).map(p=>p.name).join(', ')}</div>}
</section>}
{playing&&state&&conn.current&&<><Arena connection={conn.current} state={state}/>
 <div className="scoreboard">
  <div className="score-team blue"><span>BLUE</span><b>{String(state.score.blue).padStart(2,'0')}</b></div>
  <div className={'score-clock'+(state.phase==='sudden'?' sudden':timeLeft<30&&state.phase==='playing'?' urgent':'')}><span>{state.phase==='sudden'?'FIRST POP WINS':state.practiceDifficulty?`OFFLINE · ${state.practiceDifficulty.toUpperCase()}`:state.training?'PRACTICE · BOTS':state.phase==='countdown'?'GET READY':'SKYBOUND ARENA'}</span><b>{state.phase==='sudden'?'SUDDEN DEATH':clock(timeLeft)}</b></div>
  <div className="score-team red"><b>{String(state.score.red).padStart(2,'0')}</b><span>RED</span></div>
 </div>
 <div className="battle-menu"><button className="icon-btn" aria-label={isFullscreen?'Exit fullscreen':'Enter fullscreen'} title={isFullscreen?'Exit fullscreen':'Enter fullscreen'} onClick={fullscreen}>{isFullscreen?<Minimize size={17}/>:<Maximize size={17}/>}</button><button className="icon-btn" aria-label="Battle settings" onClick={()=>setDialog('settings')}><Settings2 size={17}/></button><button className="icon-btn" aria-label="Leave match" onClick={()=>setDialog('leave')}><X size={17}/></button></div>
 <div className={'role-chip '+(me?.team||'blue')}>{roleIcon(me?.role||'shooter')}<b>{me?.role.toUpperCase()}</b><span className={'ping '+ping} title="Round-trip time to the game server">{state.practiceDifficulty?'ON DEVICE':`${latency} ms`}</span></div>
 {status==='reconnecting'&&<div className="network-banner" role="status">RECONNECTING… Your spot is reserved.</div>}
 {state.phase==='ended'&&<div className="results-backdrop"><section className={'sheet results '+(state.winner||'')}>
  <div className="results-burst"><Trophy size={34}/></div>
  <div className="kicker">THE SKY HAS SPOKEN</div>
  <h2>{state.winner?.toUpperCase()} CREW WINS!</h2>
  <div className="final-score"><span className="blue">{state.score.blue}<small>BLUE CREW</small></span><i>VS</i><span className="red">{state.score.red}<small>RED CREW</small></span></div>
  <div className="awards">{([['BALLOON HUNTER','kills',Target],['SHARPSHOOTER','accuracy',Crosshair],['WALL MASTER','built',Shield],['WALL BREAKER','broken',Hammer]] as const).map(([title,stat,Icon])=>{const eligible=state.players.filter(p=>stat!=='accuracy'||p.stats.fired>0),best=[...eligible].sort((a,b)=>stat==='accuracy'?b.stats.hits/(b.stats.fired||1)-a.stats.hits/(a.stats.fired||1):b.stats[stat]-a.stats[stat])[0];const value=best?(stat==='accuracy'?`${Math.round(best.stats.hits/(best.stats.fired||1)*100)}%`:best.stats[stat]):'—';return <div className={'award '+(best?.team||'')} key={stat}><Icon size={18}/><span>{title}</span><b>{best?.name||'No shots fired'}</b><small>{value} {stat==='kills'?'pops':stat==='built'?'boxes built':stat==='broken'?'boxes broken':'accuracy'}</small></div>;})}</div>
  <p className="personal-stats">YOUR BATTLE · <b>{me?.stats.kills}</b> pops · <b>{me?.stats.deaths}</b> deaths · <b>{me?.stats.fired}</b> arrows fired</p>
  <div className="result-actions"><button className="btn btn-sun btn-lg" disabled={!host} onClick={()=>send({type:'rematch'})}>{host?'REMATCH':'WAITING FOR HOST'} <ArrowRight size={20}/></button><button className="btn btn-paper" onClick={leave}>{state.practiceDifficulty?'BACK TO MENU':'PLAY AGAIN'}</button>{state.practiceDifficulty?<button className="btn btn-paper" onClick={()=>{leave();open('play','practice');}}>DIFFICULTY</button>:<button className="btn btn-paper" disabled={!host} onClick={()=>send({type:'rematch'})}>LOBBY</button>}</div>
 </section></div>}</>}
{notice&&<div className="toast" role="status">{notice}</div>}{error&&<div className="error-toast" role="alert"><span>{error}</span><button aria-label="Dismiss error" onClick={()=>setError('')}><X size={16}/></button></div>}
<Dialog open={!!dialog} onOpenChange={v=>!v&&setDialog('')}><DialogContent ref={playDialog} tabIndex={-1} onOpenAutoFocus={event=>{if(dialog==='play'){event.preventDefault();playDialog.current?.focus({preventScroll:true});}}} className={'game-dialog'+(dialog==='help'?' wide-dialog':'')+(dialog==='privacy'?' privacy-dialog':'')}>
 <DialogTitle>{dialog==='play'?(mode.startsWith('lan')?'Same sky. Same Wi-Fi.':mode==='join'?'Join your crew':mode==='create'?'Make some trouble':mode==='practice'?'Offline practice':'Ready to rumble?'):dialog==='privacy'?'Privacy policy':dialog==='settings'?'Make it your sky':dialog==='leave'?'Leave this crew?':'A little know-how.'}</DialogTitle>
 <DialogDescription>{dialog==='play'?(mode==='practice'?'Your device. Your pace. No internet needed.':mode.startsWith('lan')?'Connect all phones to the same Wi-Fi or hotspot.':'Pick a name. Bring some attitude.'):dialog==='privacy'?'Angry Balloon · Developed by Faruk Biswas':dialog==='settings'?'Sound and feedback, just the way you like them.':dialog==='leave'?'Leaving releases your spot in this room.':'Fly. Defend. Make the other crew pop.'}</DialogDescription>
 {dialog==='play'&&<form className={'play-form mode-'+mode} onSubmit={e=>{e.preventDefault();if(mode!=='lan-browse')void play();}}>
  <label className="field-label" htmlFor="player-name">YOUR NAME</label>
  <div className="name-field"><input className="field" id="player-name" maxLength={16} placeholder="SkyShot" value={name} onChange={e=>{customName.current=true;setName(e.target.value);}} autoComplete="nickname"/><button type="button" className="icon-btn" aria-label="Random player name" onClick={()=>{customName.current=false;setName(randomPlayerName(name));}}><Shuffle size={18}/></button></div>
  {mode==='practice'&&<fieldset className="presets"><legend className="field-label">CHOOSE YOUR CHALLENGE</legend><div>{(Object.keys(PRACTICE_PRESETS) as Difficulty[]).map(level=><button type="button" key={level} aria-pressed={difficulty===level} className={'preset '+level+(difficulty===level?' selected':'')} onClick={()=>setDifficulty(level)}><b>{PRACTICE_PRESETS[level].label}</b><small>{PRACTICE_PRESETS[level].description}</small></button>)}</div></fieldset>}
  {mode.startsWith('lan')&&<div className="segmented"><button type="button" className={mode==='lan-browse'?'selected':''} onClick={()=>setMode('lan-browse')}>ROOMS</button><button type="button" className={mode==='lan-host'?'selected':''} onClick={()=>setMode('lan-host')}>HOST</button><button type="button" className={mode==='lan-join'?'selected':''} onClick={()=>setMode('lan-join')}>MANUAL</button></div>}
  {mode==='lan-browse'&&<LocalRooms join={room=>void play(room)} manual={()=>setMode('lan-join')}/>}
  {mode==='lan-join'&&<><label className="field-label" htmlFor="host-address">HOST ADDRESS</label><input className="field" id="host-address" placeholder="192.168.1.10:3001" value={lanIp} onChange={e=>setLanIp(e.target.value)} required autoComplete="off" inputMode="url"/></>}
  {(mode==='join'||mode==='lan-join')&&<><label className="field-label" htmlFor="room-code">ROOM CODE</label><input className="field code-input" id="room-code" maxLength={5} placeholder="AB7K9" value={code} onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g,''))} required pattern="[A-Z2-9]{5}"/></>}
  {(mode==='quick'||mode==='create'||mode==='lan-host')&&<div className="match-preferences">{mode==='quick'&&<><span className="field-label">PREFERRED CREW</span><div className="segmented" role="group" aria-label="Preferred crew">{['any','blue','red'].map(t=><button type="button" key={t} aria-pressed={preferredTeam===t} className={(preferredTeam===t?'selected ':'')+t} onClick={()=>setPreferredTeam(t)}>{t==='any'?'EITHER CREW':t.toUpperCase()}</button>)}</div></>}<div className="toggle-row"><div><label htmlFor="quick-bots">BOT BUILDERS</label><small>One labeled bot per crew. Humans are Shooters.</small></div><Switch id="quick-bots" checked={botBuilders} onCheckedChange={setBotBuilders}/></div></div>}
  <div className="mode-note"><Users size={17}/><span>{MODE_NOTES[mode]}</span></div>
  {mode!=='lan-browse'&&<button type="submit" disabled={preparing} className="btn btn-sun btn-lg">{preparing?(mode==='lan-host'?'STARTING LOCAL HOST…':'STARTING GAME…'):mode==='lan-host'?'HOST LOCAL ROOM':mode==='lan-join'?'JOIN LOCAL ROOM':mode==='create'?'CREATE ROOM':mode==='join'?'JOIN ROOM':mode==='practice'?'START OFFLINE PRACTICE':'QUICK PLAY'} <ArrowRight size={20}/></button>}
  {mode==='quick'&&<button className="link-btn" type="button" onClick={()=>setMode('practice')}>Offline practice against bots <ArrowRight size={14}/></button>}
 </form>}
 {dialog==='settings'&&<div className="settings">{(['music','sfx','laughs','haptics'] as const).map(key=><div className="toggle-row" key={key}><label htmlFor={'toggle-'+key}>{({music:'Music',sfx:'Sound effects',laughs:'Character reactions',haptics:'Haptic feedback'})[key]}</label><Switch id={'toggle-'+key} checked={prefs[key]} onCheckedChange={v=>changePref(key,v)}/></div>)}{(['musicVolume','sfxVolume'] as const).map(key=><div className="volume-row" key={key}><label>{key==='musicVolume'?'Music volume':'Effects volume'}<span>{Math.round(prefs[key]*100)}%</span></label><Slider aria-label={key==='musicVolume'?'Music volume':'Effects volume'} min={0} max={100} step={1} value={[prefs[key]*100]} onValueChange={v=>changePref(key,v[0]/100)}/></div>)}<div className="settings-links"><button className="btn btn-paper btn-sm" onClick={()=>setDialog('privacy')}><Shield size={15}/> PRIVACY POLICY</button>{privacyRequired&&<button className="btn btn-paper btn-sm" onClick={()=>ads.privacy().catch(()=>setNotice('Privacy options are unavailable right now. Please try again with internet.'))}>AD PRIVACY OPTIONS</button>}<button className="btn btn-paper btn-sm" onClick={fullscreen}>{isFullscreen?<Minimize size={15}/>:<Maximize size={15}/>} {isFullscreen?'EXIT FULLSCREEN':'FULLSCREEN'}</button></div></div>}
 {dialog==='help'&&<><Tabs value={how} onValueChange={setHow}><TabsList className="help-tabs"><TabsTrigger value="shooter"><Crosshair size={17}/> SHOOTER</TabsTrigger><TabsTrigger value="builder"><Shield size={17}/> BUILDER</TabsTrigger></TabsList><TabsContent value="shooter"><div className="steps"><div><span>01</span><h3>Fly</h3><p>Left thumb on the joystick. Keep moving. Stay unpopped.</p></div><div><span>02</span><h3>Draw</h3><p>Pull the bow backward. Follow the dotted arc.</p></div><div><span>03</span><h3>Release</h3><p>Let go to fire. One enemy pop = one point.</p></div></div><p className="tip-line">30 arrows each. Every enemy crate gives +3. Stay in the centre circle for 2 seconds to get +5; it returns after 2 seconds. Friendly walls let your arrows through.</p></TabsContent><TabsContent value="builder"><div className="steps"><div><span>01</span><h3>Fly</h3><p>Use the left joystick. Dodge while you defend.</p></div><div><span>02</span><h3>Build</h3><p>Tap the right-hand grid. One box every 0.5 seconds.</p></div><div><span>03</span><h3>Protect</h3><p>Rebuild broken slots. 18 floating boxes maximum.</p></div></div><p className="tip-line">Builders can’t shoot. You have unlimited boxes. Your crew needs exactly one of you.</p></TabsContent></Tabs><div className="help-footer"><span>DESKTOP: WASD / ARROW KEYS + MOUSE</span><button className="btn btn-sun" onClick={()=>{localStorage.setItem('ab-tutorial','1');setDialog('');}}>GOT IT <Check size={16}/></button></div></>}
 {dialog==='privacy'&&<iframe className="privacy-frame" src="/privacy.html" title="Angry Balloon privacy policy"/>}
 {dialog==='leave'&&<div className="leave-actions"><button className="btn btn-paper" onClick={()=>setDialog('')}>STAY WITH CREW</button><button className="btn btn-danger" onClick={leave}>LEAVE ROOM</button></div>}
</DialogContent></Dialog>
<div className="rotate"><RotateCw size={64} className="rotate-icon"/><h2>Rotate your phone</h2><p>ANGRY BALLOON IS PLAYED IN LANDSCAPE</p>{playing&&<small>Your controls resume when you rotate back.<br/>{state?.practiceDifficulty?'Offline practice is paused.':'The live match continues for the other players.'}</small>}</div></main>}
