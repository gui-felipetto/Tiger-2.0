import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, restoreState, slotPayout, spinSlots, spinDouble, startMines, revealMine,
  collectMines, minesMultiplier, claimBonus, refill, localDay, randomInt, INITIAL_BALANCE } from '../assets/engine.js';

const sequence = values => { let i = 0; return max => { const n = values[i++ % values.length]; assert.ok(n >= 0 && n < max); return n; }; };
test('slots: win, pair, loss and exact wallet accounting', () => {
  const initial = createState();
  const triple = spinSlots(initial, 1000, sequence([5, 5, 5]));
  assert.equal(triple.result.payout, 25000);
  assert.equal(triple.state.balance, INITIAL_BALANCE - 1000 + 25000);
  assert.equal(initial.balance, INITIAL_BALANCE);
  assert.equal(spinSlots(initial, 2500, sequence([1, 2, 1])).result.payout, 3750);
  const loss = spinSlots(initial, 1000, sequence([0, 1, 2]));
  assert.equal(loss.state.balance, INITIAL_BALANCE - 1000);
  assert.equal(loss.state.history[0].payout, 0);
});
test('slots: exhaustive return matches the published rules', () => {
  let total = 0;
  for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) for (let c = 0; c < 6; c++) total += slotPayout([a, b, c], 10000).payout;
  assert.ok(Math.abs(total / (216 * 10000) - 0.9305555556) < 1e-8);
});
test('double: every number pays only its matching color', () => {
  for (let number = 0; number < 15; number++) {
    for (const color of ['red', 'gold', 'black']) {
      const { state, result } = spinDouble(createState(), 1000, color, () => number);
      const expected = number === 0 ? 'gold' : number <= 7 ? 'red' : 'black';
      assert.equal(result.payout, color === expected ? color === 'gold' ? 14000 : 2000 : 0);
      assert.equal(state.balance, INITIAL_BALANCE - 1000 + result.payout);
    }
  }
});
test('stakes reject invalid amounts, insufficient balance and a second active game', () => {
  for (const stake of [-1, 0, 10, 1.5, NaN, Infinity]) assert.throws(() => spinSlots(createState(), stake));
  assert.throws(() => spinSlots({ ...createState(), balance: 999 }, 1000));
  const active = startMines(createState(), 1000, 3, () => 0);
  assert.throws(() => spinSlots(active, 1000));
  assert.throws(() => spinDouble(active, 1000, 'red'));
  assert.throws(() => startMines(active, 1000, 3));
});
test('mines: unique fixed layout, persisted round and one debit', () => {
  let state = startMines(createState(), 2500, 3, () => 0);
  assert.deepEqual(state.round.mines, [0, 1, 2]);
  assert.equal(state.balance, INITIAL_BALANCE - 2500);
  state = revealMine(state, 24).state;
  state = restoreState(JSON.stringify(state));
  assert.deepEqual(state.round.revealed, [24]);
  assert.deepEqual(state.round.mines, [0, 1, 2]);
  assert.throws(() => revealMine(state, 24));
  const collected = collectMines(state);
  assert.equal(collected.result.multiplier, 1.09);
  assert.equal(collected.state.balance, INITIAL_BALANCE - 2500 + 2725);
  assert.equal(collected.state.totalRounds, 1);
  assert.equal(collected.state.round, null);
  assert.throws(() => collectMines(collected.state));
});
test('mines: hit loses only the stake; collecting without a diamond is rejected', () => {
  const state = startMines(createState(), 10000, 5, () => 0);
  assert.throws(() => collectMines(state));
  const lost = revealMine(state, 0);
  assert.equal(lost.result.hit, true);
  assert.equal(lost.state.balance, INITIAL_BALANCE - 10000);
  assert.equal(lost.state.history[0].payout, 0);
  assert.equal(lost.state.round, null);
  assert.throws(() => revealMine(lost.state, 1));
});
test('mines: revealing all safe cells collects automatically', () => {
  let state = startMines(createState(), 1000, 10, () => 0);
  let result;
  for (let i = 10; i < 25; i++) ({ state, result } = revealMine(state, i));
  assert.equal(state.round, null);
  assert.equal(result.complete, true);
  assert.equal(state.totalRounds, 1);
  assert.ok(result.payout > 1000);
  assert.equal(state.balance, INITIAL_BALANCE - 1000 + result.payout);
});
test('mines multipliers rise for each safe reveal at every supported difficulty', () => {
  for (const count of [3, 5, 10]) {
    let previous = 1;
    for (let n = 1; n <= 25 - count; n++) {
      const multiplier = minesMultiplier(count, n);
      assert.ok(multiplier > previous); previous = multiplier;
    }
  }
  assert.throws(() => minesMultiplier(25, 1));
});
test('daily bonus is awarded once per local calendar day', () => {
  const state = claimBonus(createState(), '2026-10-21');
  assert.equal(state.balance, INITIAL_BALANCE + 50000);
  assert.throws(() => claimBonus(state, '2026-10-21'));
  assert.equal(claimBonus(state, '2026-10-22').balance, INITIAL_BALANCE + 100000);
  assert.equal(localDay(new Date(2026, 9, 21, 23, 59)), '2026-10-21');
});
test('refill requires low balance and no unfinished round', () => {
  assert.throws(() => refill(createState()));
  assert.equal(refill({ ...createState(), balance: 999 }).balance, 100999);
  const active = startMines({ ...createState(), balance: 1000 }, 1000, 3, () => 0);
  assert.throws(() => refill(active));
});
test('storage recovers from corruption and validates active rounds', () => {
  for (const raw of ['{', 'null', '{"version":2,"balance":-1}', '{"version":2,"balance":1.5}']) assert.deepEqual(restoreState(raw), createState());
  const data = { ...createState(), name: '<b>nome</b>', favorites: ['slots', 'slots', 'unknown'], round: { game: 'mines', stake: 1000, count: 3, mines: [1, 1, 1], revealed: [] } };
  const result = restoreState(data);
  assert.equal(result.round, null);
  assert.deepEqual(result.favorites, ['slots']);
  assert.equal(result.name, '<b>nome</b>'); // Rendering uses textContent, never HTML.
  assert.equal(restoreState({ ...createState(), history: [{ game: 'slots', stake: 1000, payout: 0, time: Number.MAX_VALUE }] }).history.length, 0);
});
test('history remains bounded and settlement survives a reload', () => {
  let state = createState();
  for (let n = 0; n < 70; n++) state = spinSlots(state, 1000, () => 5).state;
  const saved = restoreState(JSON.stringify(state));
  assert.equal(saved.history.length, 50);
  assert.equal(saved.totalRounds, 70);
  assert.equal(saved.bestWin, 25000);
  assert.equal(saved.balance, state.balance);
});
test('secure random sampler stays within its bounds', () => {
  for (const max of [1, 3, 6, 15, 25]) for (let i = 0; i < 100; i++) assert.ok(randomInt(max) >= 0 && randomInt(max) < max);
  assert.throws(() => randomInt(0));
});
