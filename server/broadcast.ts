import { snapshot } from '../game/engine.ts';
import { encodeFrame, structure } from '../game/protocol.ts';
import type { Room } from '../game/engine.ts';

type Socket = { readyState: number; bufferedAmount: number; send(data: string): void };
export type Recipient = { socket: Socket | null; lastRevision: number; lastEvent: number; protocol?: number; lastStructure?: number };

// Never queue seconds of stale gameplay behind a slow connection.
export const MAX_BUFFERED_BYTES = 64 * 1024;
// 30Hz keeps the worst-case age of a regular update at 33ms. Urgent flushes
// (shots, pops, builds) go out on the next 60Hz tick instead of waiting.
export const BROADCAST_MS = 1000 / 30;
export function canSend(socket: Socket | null): socket is Socket {
  return !!socket && socket.readyState === 1 && socket.bufferedAmount < MAX_BUFFERED_BYTES;
}

// Keep a fixed broadcast schedule independently of simulation catch-up ticks.
export class BroadcastClock {
  next: number;
  interval: number;
  constructor(now: number, interval = 50) { this.next = now; this.interval = interval; }
  due(now: number) {
    if (now < this.next) return false;
    this.next += (Math.floor((now - this.next) / this.interval) + 1) * this.interval;
    return true;
  }
}

// `urgent` sends only to recipients with unseen events or wall/roster changes.
export function broadcastRoom(room: Room, recipients: Recipient[], urgent = false) {
  let full: string | undefined;
  const frames = new Map<string, string>();
  const shape = structure(room);
  let encodings = 0;
  for (const recipient of recipients) {
    if (!canSend(recipient.socket)) continue;
    const compact = (recipient.protocol || 1) >= 2;
    // Compact frames carry walls and ammo, so only roster/phase edits need a snapshot.
    const changed = compact ? recipient.lastStructure !== shape || recipient.lastRevision === -1 : recipient.lastRevision !== room.revision;
    const live = recipient.lastRevision !== room.revision;
    if (!changed && !live && (room.phase === 'lobby' || room.phase === 'ended')) continue;
    if (urgent && !changed && !live && recipient.lastEvent === room.serial) continue;
    let packet: string;
    if (changed) {
      if (full === undefined) {
        full = JSON.stringify({ type: 'state', state: snapshot(room) });
        encodings++;
      }
      packet = full;
    } else {
      const key = (compact ? 'c' : 'l') + recipient.lastEvent;
      let frame = frames.get(key);
      if (frame === undefined) {
        frame = compact ? encodeFrame(room, recipient.lastEvent) : JSON.stringify({ type: 'frame', players: room.players, arrows: room.arrows,
          score: room.score, ammoCircle: room.ammoCircle, now: room.now, phase: room.phase,
          events: room.events.filter(event => event.id > recipient.lastEvent) });
        frames.set(key, frame);
        encodings++;
      }
      packet = frame;
    }
    recipient.socket.send(packet);
    // Advance only after enqueueing; otherwise a dropped wall snapshot can be lost forever.
    recipient.lastRevision = room.revision;
    recipient.lastStructure = shape;
    recipient.lastEvent = room.serial;
  }
  return encodings;
}
