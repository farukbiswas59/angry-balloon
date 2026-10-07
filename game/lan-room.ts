import { addPlayer, chooseTeam, chooseRole, makeRoom, start, startReason, step, shoot, place, input, disconnect, removePlayer, rematch, snapshot, finite, clamp, setBotBuilder } from './engine.ts';
import { addMatchmakingBuilders } from '../server/matchmaking.ts';
import { BroadcastClock, broadcastRoom } from '../server/broadcast.ts';
import type { Room, Player } from './engine.ts';

type Session = { token: string; peer: string | null; room: Room; player: Player; socket: { readyState: number; bufferedAmount: number; send(data: string): void } | null; lastRevision: number; lastEvent: number };
export type LanPacket = { peer: string; data: string };

// The phone runs exactly the same authoritative game simulation as the cloud.
// Native sockets carry packets; the visible host WebView advances the world.
export class LanRoom {
  room: Room | null = null;
  sessions = new Map<string, Session>();
  peers = new Map<string, { session?: Session; at: number; requests: number }>();
  packets: LanPacket[] = [];
  clock = new BroadcastClock(0);
  private uid: () => string;
  constructor(uid: () => string = () => crypto.randomUUID()) { this.uid = uid; }
  open(peer: string) { if (this.peers.size < 12) this.peers.set(peer, { at: 0, requests: 0 }); }
  close(peer: string) {
    const s = this.peers.get(peer)?.session;
    if (s?.peer === peer) { s.peer = null; s.socket = null; disconnect(s.room, s.player); }
    this.peers.delete(peer);
  }
  send(peer: string, message: unknown) { this.packets.push({ peer, data: JSON.stringify(message) }); }
  receive(peer: string, raw: string, now: number) {
    const client = this.peers.get(peer);
    if (!client || raw.length > 2048) return;
    if (now - client.at >= 1000) { client.at = now; client.requests = 0; }
    if (++client.requests > 80) return;
    let m: Record<string, unknown>;
    try { m = JSON.parse(raw); if (!m || typeof m !== 'object' || Array.isArray(m)) return; } catch { return; }
    try {
      if (m.type === 'ping') { this.send(peer, { type: 'pong', at: m.at }); return; }
      if (m.type === 'resume' && !client.session) {
        const s = typeof m.token === 'string' ? this.sessions.get(m.token) : undefined;
        if (!s || !s.room.players.includes(s.player)) throw Error('Your LAN spot expired. Join again.');
        if (s.peer && s.peer !== peer) throw Error('This player is already connected.');
        client.session = s; s.peer = peer; s.socket = this.socket(peer); s.player.connected = true; s.player.inputAt = s.room.now; s.room.revision++; s.lastRevision = -1;
        this.send(peer, { type: 'joined', token: s.token, id: s.player.id, state: snapshot(s.room) }); return;
      }
      if (m.type === 'join' && !client.session) {
        if (m.mode === 'create' && !this.room) {
          const bytes = this.uid().replace(/[^a-z0-9]/gi, '').slice(-5).toUpperCase();
          const code = bytes.replace(/[01IO]/g, 'K').padEnd(5, 'K');
          this.room = makeRoom(code, '', 0, false, false);
          this.room.botBuilders = m.botBuilders !== false;
          addMatchmakingBuilders(this.room, this.uid);
        } else if (m.mode !== 'join' || !this.room || m.code !== this.room.code) throw Error('LAN room not found. Check the address and room code.');
        const room = this.room!;
        const player = addPlayer(room, this.uid(), m.name);
        if (!room.host) room.host = player.id;
        const s: Session = { token: this.uid() + this.uid(), peer, room, player, socket: this.socket(peer), lastRevision: -1, lastEvent: room.serial };
        this.sessions.set(s.token, s); client.session = s;
        this.send(peer, { type: 'joined', token: s.token, id: player.id, state: snapshot(room) }); return;
      }
      const s = client.session;
      if (!s || s.peer !== peer) return;
      const { room: r, player: p } = s;
      switch (m.type) {
        case 'team': if (!chooseTeam(r, p, m.team)) throw Error('That crew is full or the match has started.'); break;
        case 'role': if (!chooseRole(r, p, m.role)) throw Error('The Builder slot is taken.'); break;
        case 'personality': if (r.phase === 'lobby' && Number.isInteger(m.value) && Number(m.value) >= 0 && Number(m.value) < 4) { p.personality = Number(m.value); r.revision++; } break;
        case 'settings': if (r.host !== p.id || r.phase !== 'lobby') break;
          if (finite(m.duration)) r.duration = clamp(Math.round(m.duration), 60, 600);
          if (finite(m.maxPlayers)) r.maxPlayers = clamp(Math.round(m.maxPlayers), Math.max(4, r.players.length), 10);
          r.revision++; break;
        case 'bot-builder': setBotBuilder(r, p, m.team, m.enabled, this.uid()); break;
        case 'start': if (r.host === p.id && !start(r)) throw Error(startReason(r) || 'Match already started.'); break;
        case 'input': input(r, p, m.x, m.y, m.seq); break;
        case 'aim': p.aimUntil = r.now + .3; break;
        case 'shoot': shoot(r, p, m.dx, m.dy); break;
        case 'place': place(r, p, m.slot); break;
        case 'rematch': if (r.host === p.id) rematch(r); break;
        case 'leave': removePlayer(r, p); this.sessions.delete(s.token); client.session = undefined; this.send(peer, { type: 'left' }); break;
      }
    } catch (error) { this.send(peer, { type: 'error', message: error instanceof Error ? error.message : 'Could not complete that action.' }); }
  }
  private socket(peer: string) { return { readyState: 1, bufferedAmount: 0, send: (data: string) => { this.packets.push({ peer, data }); } }; }
  tick(dt: number, now: number) {
    if (this.room) {
      step(this.room, dt);
      for (const [token, session] of this.sessions) if (!this.room.players.includes(session.player)) this.sessions.delete(token);
      if (this.clock.due(now)) broadcastRoom(this.room, [...this.sessions.values()]);
    }
  }
  drain() { const packets = this.packets; this.packets = []; return packets; }
}
