import test from 'node:test';
import assert from 'node:assert/strict';
import { OfflinePractice } from '../game/offline-practice.ts';
import { playerExpression } from '../game/expressions.ts';

test('balloons react to danger, low ammo, aiming, rewards and recovery without changing gameplay', () => {
  const practice = new OfflinePractice('Pilot', 'medium'), p = practice.player;
  practice.room.phase = 'playing'; const s = practice.state(), before = JSON.stringify(p);
  assert.equal(playerExpression(p, s, 10), 'idle');
  p.ammo = 0; assert.equal(playerExpression(p, s, 10), 'worried');
  p.aimUntil = 11; assert.equal(playerExpression(p, s, 10), 'focused');
  p.happyUntil = 11; assert.equal(playerExpression(p, s, 10), 'cheer');
  s.arrows.push({id: 1, owner: 'bot', team: 'red', x: p.x + 40, y: p.y, vx: -600, vy: 0, born: 10});
  assert.equal(playerExpression(p, s, 10), 'shocked');
  assert.equal(playerExpression(p, s, 10, {expression: 'dizzy', until: 11}), 'dizzy');
  assert.equal(playerExpression(p, s, 12, {expression: 'wink', until: 11}), 'shocked');
  const recovery = {expression: 'angry' as const, until: 10.35, after: {expression: 'dizzy' as const, until: 11.2}};
  assert.equal(playerExpression(p, s, 10.1, recovery), 'angry');
  assert.equal(playerExpression(p, s, 10.5, recovery), 'dizzy');
  assert.equal(playerExpression(p, s, 11.3, recovery), 'shocked');
  p.ammo = 30; p.aimUntil = p.happyUntil = 0; assert.equal(JSON.stringify(p), before);
});

test('end-of-match joy or sadness overrides transient expressions and countdown is calm', () => {
  const practice = new OfflinePractice('Pilot', 'medium'), p = practice.player, s = practice.state();
  p.ammo = 0; assert.equal(playerExpression(p, s, 0), 'idle');
  s.phase = 'ended'; s.winner = 'blue'; assert.equal(playerExpression(p, s, 0, {expression: 'angry', until: 1}), 'cheer');
  s.winner = 'red'; assert.equal(playerExpression(p, s, 0), 'sad');
});
