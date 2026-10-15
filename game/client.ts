import { OfflinePractice } from './offline-practice';
import type { Difficulty } from './practice-presets';
import type { Snapshot } from './engine';
import { PROTOCOL, applyFrame } from './protocol';
import type { CompactFrame } from './protocol';
import { nativeAndroid } from './device';
import { NativeLanSocket } from './lan-native';
import type { GameSocket } from './lan-native';
export type Message=Record<string,unknown>;
export class Connection{practice:OfflinePractice|null=null;practiceFrame=0;practicePaused=false;local=false;serverUrl='';ws:WebSocket|GameSocket|null=null;id='';token='';state:Snapshot|null=null;status='offline';attempt=0;intent:Message|null=null;stopped=false;retry:ReturnType<typeof setTimeout>|null=null;ping:ReturnType<typeof setTimeout>|null=null;pings=0;rtt=0;jitter=0;receivedAt=0;onChange=()=>{};onError=(_s:string)=>{};onState=(_s:Snapshot)=>{};
 // Smoothed round trip in ms, as shown in the HUD.
 get latency(){return Math.round(this.rtt);}
 startPractice(name:string,difficulty:Difficulty){
  this.leave();this.local=true;this.rtt=this.jitter=0;this.practice=new OfflinePractice(name,difficulty);this.id=this.practice.player.id;this.token='';this.stopped=false;this.status='online';
  let previous=performance.now();
  const update=(now:number)=>{
   if(!this.practice||this.stopped)return;
   this.practice.advance((now-previous)/1000,document.hidden||innerWidth<innerHeight||this.practicePaused);previous=now;
   this.state=this.practice.state();this.receivedAt=now;this.onState(this.state);this.onChange();
   this.practiceFrame=requestAnimationFrame(update);
  };
  update(previous);
 }
 setPracticePaused(paused:boolean){this.practicePaused=paused;}
 stopPractice(){if(this.practiceFrame)cancelAnimationFrame(this.practiceFrame);this.practiceFrame=0;this.practice=null;this.practicePaused=false;}
 url(){const configured=this.serverUrl||process.env.NEXT_PUBLIC_GAME_SERVER_URL;if(configured)return configured.replace(/^http/,'ws').replace(/\/$/,'')+'/socket';if(location.hostname==='localhost'||location.hostname==='127.0.0.1'||/^192\.168\.|^10\./.test(location.hostname))return `ws://${location.hostname}:3001/socket`;return '';}
 // Ping quickly while the estimate settles, then every 2s. Prediction uses the smoothed value.
 schedulePing(){if(this.ping)clearTimeout(this.ping);this.ping=setTimeout(()=>{this.send({type:'ping',at:performance.now()});this.schedulePing();},this.pings<6?500:2000);}
 sample(ms:number){if(!this.pings++){this.rtt=ms;this.jitter=0;return;}this.jitter+=(Math.abs(ms-this.rtt)-this.jitter)*.25;this.rtt+=(ms-this.rtt)*.2;}
 async connect(intent?:Message){this.stopPractice();if(intent)this.intent=intent;this.stopped=false;if(!this.url()){this.status='connecting';this.onChange();try{const r=await fetch('/api/game-config');const cfg=await r.json();if(cfg&&typeof cfg==='object'&&'url' in cfg&&typeof cfg.url==='string')this.serverUrl=cfg.url;}catch{}}const url=this.url();if(!url){this.status='offline';this.onError('The multiplayer server is not connected yet. Your host needs to configure the game server address.');this.onChange();return;}this.status=this.token?'reconnecting':'connecting';this.onChange();try{this.ws=this.local&&nativeAndroid()?new NativeLanSocket(url):new WebSocket(url);}catch{this.onError('Could not connect to the game server.');return;}const ws=this.ws;const timeout=setTimeout(()=>{if(ws.readyState!==WebSocket.OPEN)ws.close();},12000);
 ws.onopen=()=>{clearTimeout(timeout);if(ws!==this.ws||this.stopped)return;this.attempt=0;this.pings=0;if(this.token)this.send({type:'resume',token:this.token,v:PROTOCOL});else if(this.intent)this.send({...this.intent,v:PROTOCOL});this.send({type:'ping',at:performance.now()});this.schedulePing();};
 ws.onmessage=(e:{data:string})=>{if(ws!==this.ws||this.stopped)return;let m;try{m=JSON.parse(e.data);}catch{return;}if(m.type==='error'){this.onError(m.message);if(this.status==='reconnecting'){this.token='';sessionStorage.removeItem('ab-session');this.stopped=true;ws.close();this.state=null;this.status='offline';this.onChange();}else if(!this.state){this.stopped=true;ws.close();this.status='offline';this.onChange();}return;}if(m.type==='pong'){if(typeof m.at==='number')this.sample(Math.max(0,performance.now()-m.at));return;}if(m.type==='joined'){this.id=m.id;this.token=m.token;sessionStorage.setItem('ab-session',m.token);sessionStorage.setItem('ab-session-local',this.local?'1':'');this.status='online';}if(m.state)this.state=m.state;
 if(m.type==='frame'&&this.state){if(m.v===2){const next=applyFrame(this.state,m as CompactFrame);if(!next){this.send({type:'sync'});return;}this.state=next;}else this.state={...this.state,...m};}
 if(m.type==='left'){this.state=null;this.token='';sessionStorage.removeItem('ab-session');this.stopped=true;ws.close();this.status='offline';}if(m.state||m.type==='frame')this.receivedAt=performance.now();if(this.state)this.onState(this.state);this.onChange();};
 ws.onclose=(event?:{code?:number})=>{clearTimeout(timeout);if(ws!==this.ws)return;if(this.ping)clearTimeout(this.ping);if(this.stopped)return;if(this.local&&event?.code===1001){this.leave();this.onError('The local host closed this room. Ask them to host a new room.');return;}this.status='reconnecting';this.onChange();this.retry=setTimeout(()=>this.connect(),Math.min(4000,500*2**this.attempt++));};ws.onerror=()=>{if(ws!==this.ws||this.stopped)return;this.onError('Connection interrupted. Retrying…');};}
 send(message:Message){if(this.practice){this.practice.send(message);return;}if(this.ws?.readyState===WebSocket.OPEN)this.ws.send(JSON.stringify(message));}
 leave(){this.stopPractice();this.send({type:'leave'});this.token='';sessionStorage.removeItem('ab-session');this.state=null;this.stopped=true;if(this.retry)clearTimeout(this.retry);if(this.ping)clearTimeout(this.ping);this.retry=null;this.ping=null;const ws=this.ws;this.ws=null;this.intent=null;ws?.close();this.status='offline';this.onChange();}
 dispose(){this.stopPractice();this.stopped=true;if(this.retry)clearTimeout(this.retry);if(this.ping)clearTimeout(this.ping);this.ws?.close();}
}
