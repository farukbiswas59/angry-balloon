import type { Room, Snapshot, Phase, Team, Event } from './engine.ts';

// Protocol 2 sends gameplay frames as positional rows instead of full player
// objects. Clients that do not announce it keep receiving protocol 1 frames,
// so older installed Android builds stay compatible with an updated server.
export const PROTOCOL = 2;

// x, y, vx, vy, ammo, deadUntil, shieldUntil, aimUntil, happyUntil, seq,
// ammoCircleTime, connected, shotAt, buildAt
export type PlayerRow = [number, number, number, number, number, number, number, number, number, number, number, 0 | 1, number, number];
// id, owner index, team (0 blue, 1 red), x, y, vx, vy, born
export type ArrowRow = [number, number, 0 | 1, number, number, number, number, number];
export type CompactFrame = {
  type: 'frame'; v: 2; k: number; r: number; lr: number; now: number; phase: Phase;
  score: Record<Team, number>; ammoCircle: { readyAt: number }; w: Record<Team, number[]>;
  p: PlayerRow[]; a: ArrowRow[]; events: Event[];
};

// Sub-pixel positions and sub-millisecond times are invisible on screen but
// triple the size of every frame.
const px = (n: number) => Math.round(n * 10) / 10;
const ms = (n: number) => Math.round(n * 1000) / 1000;

// Revisions that only touch walls, ammo or the pickup are fully described by a
// compact frame. Everything else (roster, roles, phase) needs a full snapshot.
export const structure = (s: { revision: number; liveRevision?: number }) => s.revision - (s.liveRevision || 0);

export function encodeFrame(room: Room, lastEvent: number) {
  const index = new Map(room.players.map((p, i) => [p.id, i]));
  const frame: CompactFrame = {
    type: 'frame', v: 2, k: structure(room), r: room.revision, lr: room.liveRevision,
    now: ms(room.now), phase: room.phase, score: room.score,
    ammoCircle: { readyAt: ms(room.ammoCircle.readyAt) }, w: room.walls,
    p: room.players.map(p => [px(p.x), px(p.y), px(p.vx), px(p.vy), p.ammo, ms(p.deadUntil), ms(p.shieldUntil),
      ms(p.aimUntil), ms(p.happyUntil), p.seq, ms(p.ammoCircleTime), p.connected ? 1 : 0, ms(p.shotAt), ms(p.buildAt)]),
    a: room.arrows.map(a => [a.id, index.get(a.owner) ?? -1, a.team === 'blue' ? 0 : 1, px(a.x), px(a.y), px(a.vx), px(a.vy), ms(a.born)]),
    events: room.events.filter(event => event.id > lastEvent),
  };
  return JSON.stringify(frame);
}

// Returns null when the frame was encoded against a different roster; the
// caller then asks the server for a fresh snapshot.
export function applyFrame(state: Snapshot, f: CompactFrame): Snapshot | null {
  if (f.k !== structure(state) || f.p.length !== state.players.length) return null;
  const players = state.players.map((player, i) => {
    const q = f.p[i];
    return { ...player, x: q[0], y: q[1], vx: q[2], vy: q[3], ammo: q[4], deadUntil: q[5], shieldUntil: q[6], aimUntil: q[7],
      happyUntil: q[8], seq: q[9], ammoCircleTime: q[10], connected: q[11] === 1, shotAt: q[12], buildAt: q[13] };
  });
  const arrows = f.a.map(a => ({ id: a[0], owner: state.players[a[1]]?.id ?? '', team: (a[2] ? 'red' : 'blue') as Team,
    x: a[3], y: a[4], vx: a[5], vy: a[6], born: a[7] }));
  return { ...state, now: f.now, phase: f.phase, score: f.score, ammoCircle: f.ammoCircle, walls: f.w,
    players, arrows, events: f.events, revision: f.r, liveRevision: f.lr };
}
