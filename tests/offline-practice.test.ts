import test from 'node:test';
import assert from 'node:assert/strict';
import { OfflinePractice } from '../game/offline-practice.ts';
import { PRACTICE_PRESETS, practiceDifficulty } from '../game/practice-presets.ts';
import { practiceBotStep } from '../game/engine.ts';

function advance(practice: OfflinePractice, seconds: number) {
  for (let n = 0; n < Math.round(seconds * 60); n++) practice.advance(1 / 60);
}

test('each offline preset starts one human and a Builder ally against exactly two bots', () => {
  for (const difficulty of ['easy', 'medium', 'hard'] as const) {
    const practice = new OfflinePractice('Faruk', difficulty, () => .5), s = practice.state();
    assert.equal(s.practiceDifficulty, difficulty);
    assert.equal(s.phase, 'countdown');
    assert.equal(s.players.filter(p => !p.bot).length, 1);
    assert.equal(practice.player.role, 'shooter');
    assert.equal(s.players.filter(p => p.team === 'red' && p.bot).length, 2);
    assert.equal(s.players.filter(p => p.team === 'blue' && p.bot && p.role === 'builder').length, 1);
    assert.ok(s.players.every(p => p.ammo === 30));
    advance(practice, 3.1);
    assert.equal(practice.room.phase, 'playing');
  }
});

test('offline inputs act immediately, pause freezes the clock, and resumes without catch-up', () => {
  const p = new OfflinePractice('Pilot', 'easy', () => .5); advance(p, 3.1);
  const x = p.player.x;
  p.send({type: 'input', x: 1, y: 0, seq: 1}); p.advance(1 / 60);
  assert.ok(p.player.x > x);
  p.send({type: 'shoot', dx: 100, dy: -40}); assert.equal(p.player.ammo, 29);
  const now = p.room.now; p.advance(60, true); assert.equal(p.room.now, now); assert.equal(p.player.ix, 0);
  p.advance(60); assert.ok(p.room.now - now <= .100001);
});

test('offline state copies stay stable and rematch retains difficulty while resetting stats and ammo', () => {
  const practice = new OfflinePractice('Pilot', 'hard', () => .5);
  const before = practice.state(); advance(practice, 5);
  assert.equal(before.phase, 'countdown'); assert.equal(before.players[1].stats.built, 0);
  practice.room.phase = 'ended'; practice.room.winner = 'blue'; practice.player.ammo = 0; practice.player.stats.kills = 5;
  practice.send({type: 'rematch'});
  assert.equal(practice.room.phase, 'countdown'); assert.equal(practice.room.practiceDifficulty, 'hard');
  assert.equal(practice.player.ammo, 30); assert.equal(practice.player.stats.kills, 0);
});

test('difficulty changes actual fire and repair pace while retaining normal cooldown rules', () => {
  for (const difficulty of ['easy', 'medium', 'hard'] as const) {
    const practice = new OfflinePractice('Pilot', difficulty, () => .5), r = practice.room;
    r.phase = 'playing'; r.now = 1;
    const shooter = r.players.find(p => p.id === 'practice-shooter')!;
    const builder = r.players.find(p => p.id === 'practice-builder')!;
    shooter.shotAt = 0; builder.buildAt = 0;
    practiceBotStep(r, shooter, () => .5); practiceBotStep(r, builder, () => .5);
    assert.equal(shooter.stats.fired, difficulty === 'hard' ? 1 : 0);
    assert.equal(builder.stats.built, difficulty === 'easy' ? 0 : 1);
    if (difficulty === 'hard') { practiceBotStep(r, shooter, () => .5); assert.equal(shooter.stats.fired, 1); }
  }
  assert.ok(PRACTICE_PRESETS.easy.aimError > PRACTICE_PRESETS.medium.aimError);
  assert.ok(PRACTICE_PRESETS.medium.aimError > PRACTICE_PRESETS.hard.aimError);
  assert.equal(practiceDifficulty('invalid'), 'medium');
});

test('empty offline enemy shooter seeks the centre ammo pickup', () => {
  const p = new OfflinePractice('Pilot', 'hard', () => .5), r = p.room;
  r.phase = 'playing'; r.now = 10;
  const bot = r.players.find(q => q.id === 'practice-shooter')!;
  bot.ammo = 0; bot.x = 1100; bot.y = 200;
  practiceBotStep(r, bot, () => .5); assert.ok(bot.ix < 0); assert.ok(bot.iy > 0);
  bot.x = 640; bot.y = 360; practiceBotStep(r, bot, () => .5); assert.equal(bot.ix, 0); assert.equal(bot.iy, 0);
  advance(p, 2.1); assert.ok(bot.ammo > 0 || bot.stats.fired > 0);
});
