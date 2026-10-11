import { addPlayer, chooseTeam, chooseRole, input, makeRoom, place, rematch, shoot, snapshot, start, step } from './engine.ts';
import { practiceDifficulty } from './practice-presets.ts';
import type { Difficulty } from './practice-presets.ts';

// No sockets, native bridge, timers, storage or network calls. The browser owns
// the clock, so tests and the Android WebView run the same fixed-step match.
export class OfflinePractice {
  readonly room = makeRoom('SOLO2', 'practice-you', 0, false, true);
  readonly player;
  private accumulator = 0;
  private random: () => number;
  constructor(name: string, difficulty: Difficulty, random = Math.random) {
    this.random = random;
    this.room.practiceDifficulty = practiceDifficulty(difficulty);
    this.room.duration = 120;
    this.room.maxPlayers = 4;
    this.player = addPlayer(this.room, 'practice-you', name);
    chooseTeam(this.room, this.player, 'blue');
    const ally = addPlayer(this.room, 'practice-ally', 'Buddy Builder', true);
    chooseTeam(this.room, ally, 'blue'); chooseRole(this.room, ally, 'builder');
    const builder = addPlayer(this.room, 'practice-builder', 'Crate Captain', true);
    chooseTeam(this.room, builder, 'red'); chooseRole(this.room, builder, 'builder');
    const shooter = addPlayer(this.room, 'practice-shooter', 'Arrow Bandit', true);
    chooseTeam(this.room, shooter, 'red');
    start(this.room);
  }
  advance(seconds: number, paused = false) {
    if (paused) {
      this.accumulator = 0;
      this.player.ix = this.player.iy = 0;
      return;
    }
    // Bound catch-up after frame stalls. Never fast-forward a background match.
    this.accumulator += Math.max(0, Math.min(seconds, .1));
    while (this.accumulator + 1e-9 >= 1 / 60) {
      step(this.room, 1 / 60, this.random);
      this.accumulator -= 1 / 60;
    }
  }
  send(message: Record<string, unknown>) {
    const p = this.player, r = this.room;
    switch (message.type) {
      case 'input': input(r, p, message.x, message.y, message.seq); break;
      case 'shoot': shoot(r, p, message.dx, message.dy); break;
      case 'place': place(r, p, message.slot); break;
      case 'aim': p.aimUntil = r.now + .3; break;
      case 'rematch': if (rematch(r)) start(r); break;
    }
  }
  state() {
    const s = snapshot(this.room);
    return { ...s, players: s.players.map(p => ({ ...p, stats: { ...p.stats } })),
      walls: { blue: [...s.walls.blue], red: [...s.walls.red] }, arrows: s.arrows.map(a => ({ ...a })),
      events: [...s.events], score: { ...s.score }, ammoCircle: { ...s.ammoCircle } };
  }
}
