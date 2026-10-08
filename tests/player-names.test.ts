import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanName } from '../game/engine.ts';
import { PLAYER_NAMES, initialPlayerName, randomPlayerName } from '../game/player-names.ts';

test('all 512 distinct presets survive the server name sanitizer unchanged', () => {
  assert.equal(PLAYER_NAMES.length, 512);
  assert.equal(new Set(PLAYER_NAMES).size, 512);
  for (const name of PLAYER_NAMES) {
    assert.ok(name.length <= 16);
    assert.equal(cleanName(name), name);
  }
});

test('shuffle can reach every preset and always changes the current preset', () => {
  for (const previous of ['', PLAYER_NAMES[0], PLAYER_NAMES[255], PLAYER_NAMES.at(-1)!]) {
    const count = previous ? 511 : 512;
    const selections = new Set(Array.from({length: count}, (_, index) => randomPlayerName(previous, () => (index + .5) / count)));
    assert.equal(selections.size, count);
    assert.ok(!previous || !selections.has(previous));
    assert.ok([...selections].every(name => PLAYER_NAMES.includes(name)));
  }
});

test('launch replaces saved presets while preserving custom names and legacy custom names', () => {
  assert.ok(PLAYER_NAMES.includes(initialPlayerName(null, null)));
  assert.notEqual(initialPlayerName('SkyAce', 'preset'), 'SkyAce');
  assert.ok(PLAYER_NAMES.includes(initialPlayerName('SkyShot', null)));
  assert.equal(initialPlayerName('Faruk', null), 'Faruk');
  assert.equal(initialPlayerName('SkyAce', 'custom'), 'SkyAce');
  assert.ok(PLAYER_NAMES.includes(initialPlayerName('   ', 'custom')));
});
