import test from 'node:test';
import assert from 'node:assert/strict';
import { AdPolicy } from '../game/ad-policy.ts';

test('ads need three distinct completed matches and respect the time cap', () => {
  const policy = new AdPolicy();
  policy.complete('one'); policy.complete('one'); policy.complete('two');
  assert.equal(policy.eligible(180_000), false);
  policy.complete('three'); assert.equal(policy.eligible(180_000), true);
  policy.shown(180_000);
  ['four', 'five', 'six'].forEach(m => policy.complete(m));
  assert.equal(policy.eligible(359_999), false);
  assert.equal(policy.eligible(360_000), true);
});
