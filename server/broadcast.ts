import { snapshot } from '../game/engine.ts';
import type { Room } from '../game/engine.ts';

type Socket = { readyState: number; bufferedAmount: number; send(data: string): void };
export type Recipient = { socket: Socket | null; lastRevision: number; lastEvent: number };

// Never queue seconds of stale gameplay behind a slow connection.
export const MAX_BUFFERED_BYTES = 64 * 1024;
export function canSend(socket: Socket | null): socket is Socket {
  return !!socket && socket.readyState === 1 && socket.bufferedAmount < MAX_BUFFERED_BYTES;
}

// Keep a 20Hz broadcast schedule independently of simulation catch-up ticks.
export class BroadcastClock {
  next: number;
  constructor(now: number) { this.next = now; }
  due(now: number) {
    if (now < this.next) return false;
    this.next += (Math.floor((now - this.next) / 50) + 1) * 50;
    return true;
  }
}

export function broadcastRoom(room: Room, recipients: Recipient[]) {
  let full: string | undefined;
  const frames = new Map<number, string>();
  let encodings = 0;
  for (const recipient of recipients) {
    if (!canSend(recipient.socket)) continue;
    const changed = recipient.lastRevision !== room.revision;
    if (!changed && (room.phase === 'lobby' || room.phase === 'ended')) continue;
    let packet: string;
    if (changed) {
      if (full === undefined) {
        full = JSON.stringify({ type: 'state', state: snapshot(room) });
        encodings++;
      }
      packet = full;
    } else {
      let frame = frames.get(recipient.lastEvent);
      if (frame === undefined) {
        frame = JSON.stringify({ type: 'frame', players: room.players, arrows: room.arrows,
          score: room.score, now: room.now, phase: room.phase,
          events: room.events.filter(event => event.id > recipient.lastEvent) });
        frames.set(recipient.lastEvent, frame);
        encodings++;
      }
      packet = frame;
    }
    recipient.socket.send(packet);
    // Advance only after enqueueing; otherwise a dropped wall snapshot can be lost forever.
    recipient.lastRevision = room.revision;
    recipient.lastEvent = room.serial;
  }
  return encodings;
}
