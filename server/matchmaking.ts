import { addPlayer,chooseTeam,chooseRole } from '../game/engine.ts';
import type { Room,Team } from '../game/engine.ts';
export type MatchPreference={team:Team|null;botBuilders:boolean};
export function preference(team:unknown,bots:unknown):MatchPreference{
 if(team!==undefined&&team!==null&&team!=='any'&&team!=='blue'&&team!=='red')throw Error('Choose Blue, Red, or either crew.');
 if(bots!==undefined&&typeof bots!=='boolean')throw Error('Choose whether to use bot Builders.');
 return {team:team==='blue'||team==='red'?team:null,botBuilders:bots!==false};
}
export function availableTeam(r:Room,wanted:Team|null):Team|null{
 const blue=r.players.filter(p=>p.team==='blue').length,red=r.players.filter(p=>p.team==='red').length;
 if(r.players.length>=r.maxPlayers)return null;
 if(wanted)return (wanted==='blue'?blue:red)<5?wanted:null;
 return blue<=red&&blue<5?'blue':red<5?'red':blue<5?'blue':null;
}
export function selectMatch(rooms:Iterable<Room>,prefs:MatchPreference):Room|undefined{
 return [...rooms].filter(r=>r.public&&!r.training&&r.phase==='lobby'&&r.botBuilders===prefs.botBuilders&&r.players.some(p=>!p.bot&&p.connected)&&availableTeam(r,prefs.team))
 .sort((a,b)=>b.players.filter(p=>!p.bot).length-a.players.filter(p=>!p.bot).length||b.now-a.now||a.code.localeCompare(b.code))[0];
}
export function addMatchmakingBuilders(r:Room,id:()=>string){
 if(!r.botBuilders)return;
 for(const t of ['blue','red'] as Team[]){const p=addPlayer(r,id(),t==='blue'?'Blue Builder':'Red Builder',true);chooseTeam(r,p,t);chooseRole(r,p,'builder');}
}
