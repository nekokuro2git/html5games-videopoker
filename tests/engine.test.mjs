import test from 'node:test';
import assert from 'node:assert/strict';
import { BETS, INITIAL_BALANCE, PAYTABLE, cardInfo, evaluateHand, newGame, shuffledDeck, suggestedHolds, transition, validateCards, validateSave } from '../src/engine.mjs';
import { DEFAULT_SETTINGS, SAVE_KEY, SETTINGS_KEY, loadGame, loadSettings, saveGame, saveSettings } from '../src/storage.mjs';

const card = (rank, suit = 0) => suit * 13 + rank - 1;
const fullDeck = prefix => [...prefix, ...Array.from({ length: 54 }, (_, i) => i).filter(i => !prefix.includes(i))];
const royal = [10, 11, 12, 13, 1].map(r => card(r));
function winningState(hand = royal) {
  let state = transition(newGame(), { type: 'DEAL', deck: fullDeck(hand) });
  for (let i = 0; i < 5; i++) if (!state.held[i]) state = transition(state, { type: 'HOLD', index: i });
  return transition(state, { type: 'DRAW', at: '2026-10-28T12:00:00.000Z' });
}
function doubleDeck(prefix) { return [...prefix, ...Array.from({ length: 52 }, (_, i) => i).filter(i => !prefix.includes(i))]; }
test('54 physical cards have unique source skins, two jokers, and valid names', () => {
  const cards = Array.from({ length: 54 }, (_, i) => cardInfo(i));
  assert.equal(new Set(cards.map(c => c.image)).size, 54);
  assert.equal(cards.filter(c => c.joker).length, 2);
  assert.equal(cardInfo(0).name, 'Ace of Clubs');
  assert.throws(() => cardInfo(54));
});
test('Fisher-Yates returns a full deck; the random-index contract is enforced', () => {
  for (let i = 0; i < 20; i++) assert.equal(validateCards(shuffledDeck(), 54), true);
  assert.equal(validateCards(shuffledDeck(false), 52), true);
  assert.deepEqual(shuffledDeck(true, max => max - 1), Array.from({ length: 54 }, (_, i) => i));
  assert.throws(() => shuffledDeck(true, max => max));
});
for (const [name, hand, key] of [
  ['royal flush', royal, 'royal'],
  ['wild royal flush', [card(10), card(11), card(12), 52, 53], 'royal'],
  ['five of a kind', [card(8), card(8, 1), card(8, 2), 52, 53], 'five'],
  ['straight flush', [2, 3, 4, 5, 6].map(r => card(r, 1)), 'straight-flush'],
  ['four of a kind', [card(10), card(10, 1), 52, 53, card(1, 2)], 'four'],
  ['full house', [card(2), card(2, 1), card(3), card(3, 1), 52], 'full-house'],
  ['flush', [card(2), card(4), card(6), card(9), card(12)], 'flush'],
  ['straight', [card(9), card(10, 1), card(11, 2), card(12), card(13, 3)], 'straight'],
  ['low Ace straight', [card(1), card(2, 1), card(3, 2), card(4), card(5, 3)], 'straight'],
  ['wild low Ace straight', [card(1), card(2, 1), card(3, 2), 52, card(5, 3)], 'straight'],
  ['three of a kind', [card(2), card(2, 1), card(2, 2), card(4), card(8, 3)], 'three'],
  ['two pairs', [card(2), card(2, 1), card(4, 2), card(4), card(8, 3)], 'two-pair'],
  ['single pair pays zero', [card(11), card(11, 1), card(4, 2), card(6), card(8, 3)], 'none'],
  ['Ace cannot wrap around a straight', [card(12), card(13, 1), card(1, 2), card(2), card(3, 3)], 'none'],
  ['duplicate ranks cannot form a wild straight', [card(1), card(2, 1), card(2, 2), card(4), 52], 'three'],
]) test(`paytable: ${name}`, () => assert.equal(evaluateHand(hand).key, key));
test('invalid or duplicate physical cards are rejected', () => {
  assert.throws(() => evaluateHand([1, 1, 2, 3, 4]));
  assert.throws(() => evaluateHand([1, 2, 3, 4]));
  assert.throws(() => evaluateHand([1, 2, 3, 4, 99]));
});
test('payout order agrees with the captured paytable', () => assert.deepEqual(PAYTABLE.map(p => p.multiplier), [250, 100, 40, 8, 5, 4, 3, 2, 1]));
test('hold suggestions keep jokers, a pair or a made hand', () => {
  assert.deepEqual(suggestedHolds(royal), [true, true, true, true, true]);
  assert.deepEqual(suggestedHolds([card(2), card(2, 1), card(4, 2), card(6), card(8, 3)]), [true, true, false, false, false]);
});
test('two jokers highlight only the natural card used for three of a kind', () => {
  const hand = [card(1), card(3, 1), card(8, 2), 52, 53];
  assert.deepEqual(evaluateHand(hand).winning, [0, 3, 4]);
});
test('deal charges once; change preserves held physical cards and never repeats discarded cards', () => {
  const opening = [card(2), card(2, 1), card(4, 2), card(6), card(8, 3)];
  const dealt = transition(newGame(), { type: 'DEAL', deck: fullDeck(opening) });
  assert.equal(dealt.balance, INITIAL_BALANCE - dealt.bet);
  assert.equal(transition(dealt, { type: 'DEAL' }), dealt);
  const changed = transition(dealt, { type: 'DRAW' });
  assert.deepEqual(changed.hand.slice(0, 2), opening.slice(0, 2));
  assert.ok(changed.hand.slice(2).every(id => !opening.includes(id)));
  assert.equal(changed.balance, dealt.balance);
  assert.equal(transition(changed, { type: 'DRAW' }), changed);
  assert.equal(changed.stats.played, 1);
});
test('cash out credits once and records the return', () => {
  const won = winningState();
  assert.equal(won.pending, won.bet * 250);
  const paid = transition(won, { type: 'COLLECT' });
  assert.equal(paid.balance, INITIAL_BALANCE - won.bet + won.pending);
  assert.equal(paid.pending, 0);
  assert.equal(paid.history[0].returned, won.pending);
  assert.equal(transition(paid, { type: 'COLLECT' }), paid);
});
test('stake cannot change mid-hand or exceed the available balance', () => {
  const state = transition(newGame(), { type: 'DEAL' });
  assert.equal(transition(state, { type: 'BET', amount: BETS[0] }), state);
  const empty = { ...newGame(), balance: 0 };
  assert.equal(transition(empty, { type: 'DEAL' }), empty);
  assert.equal(transition(newGame(), { type: 'BET', amount: -1 }).bet, 10000);
});
test('half double protects half the win, and a losing guess cannot lose that protected half', () => {
  const won = winningState();
  const risk = transition(won, { type: 'DOUBLE', half: true, deck: doubleDeck([card(2)]) });
  assert.equal(risk.balance, won.balance + won.pending / 2);
  assert.equal(risk.pending, won.pending / 2);
  const lost = transition(risk, { type: 'GUESS', choice: 'big' });
  assert.equal(lost.pending, 0);
  assert.equal(lost.balance, risk.balance);
  assert.equal(lost.history[0].returned, won.pending / 2);
  assert.equal(transition(lost, { type: 'GUESS', choice: 'small' }), lost);
  assert.equal(transition(lost, { type: 'CONTINUE' }).phase, 'lose');
});
test('double up handles Big, Small, 7 push, the five-win limit, and exactly-once collection', () => {
  let state = transition(winningState(), { type: 'DOUBLE', deck: doubleDeck([card(7), card(1), card(2), card(3), card(4), card(5)]) });
  const base = state.pending;
  state = transition(state, { type: 'GUESS', choice: 'small' });
  assert.equal(state.double.outcome, 'push'); assert.equal(state.pending, base);
  state = transition(state, { type: 'CONTINUE' });
  for (let i = 1; i <= 5; i++) {
    state = transition(state, { type: 'GUESS', choice: 'small' });
    assert.equal(state.pending, base * 2 ** i);
    assert.equal(state.double.wins, i);
    assert.equal(validateSave(state), true);
    state = transition(state, { type: 'CONTINUE' });
  }
  assert.equal(state.phase, 'collected');
  assert.equal(state.history[0].returned, base * 32);
  assert.equal(transition(state, { type: 'COLLECT' }), state);
});
test('a half double rounds to cents and conserves all pending value', () => {
  const won = winningState(); won.pending = 101;
  const state = transition(won, { type: 'DOUBLE', half: true });
  assert.equal(state.balance - won.balance, 50);
  assert.equal(state.pending, 51);
});
test('a saved round validates at every stage and resumes without a new debit', () => {
  let state = newGame(); assert.equal(validateSave(state), true);
  state = transition(state, { type: 'DEAL', deck: fullDeck(royal) }); assert.equal(validateSave(state), true);
  const memory = new Map(); const storage = { getItem: k => memory.get(k), setItem: (k, v) => memory.set(k, v) };
  assert.equal(saveGame(storage, state), true); assert.deepEqual(loadGame(storage), state);
  state = winningState(); assert.equal(validateSave(state), true);
  state = transition(state, { type: 'DOUBLE' }); assert.equal(validateSave(state), true);
  state = transition(state, { type: 'COLLECT' }); assert.equal(validateSave(state), true);
});
test('corrupt save, negative money, impossible deck and storage failure recover safely', () => {
  for (const value of [{}, { ...newGame(), balance: -1 }, { ...newGame(), deck: [1, 1] }, { ...newGame(), hand: [1, 2] }, { ...newGame(), version: 999 }]) assert.equal(validateSave(value), false);
  assert.deepEqual(loadGame({ getItem: () => '{bad json' }), newGame());
  assert.deepEqual(loadGame(null), newGame());
  assert.equal(saveGame(null, newGame()), false);
  assert.equal(saveSettings(null, DEFAULT_SETTINGS), false);
});
test('saved payout and highlight data must agree with the physical hand', () => {
  const won = winningState();
  assert.equal(validateSave({ ...won, result: null }), false);
  assert.equal(validateSave({ ...won, result: { ...won.result, winning: null } }), false);
  assert.equal(validateSave({ ...won, result: { ...won.result, name: 'Wrong rank' } }), false);
  const risk = transition(won, { type: 'DOUBLE' });
  assert.equal(validateSave({ ...risk, pending: risk.pending * 2 }), false);
  assert.equal(validateSave({ ...risk, double: { ...risk.double, complete: true } }), false);
});
test('English is the default and saved settings only accept supported values', () => {
  assert.deepEqual(loadSettings(null), DEFAULT_SETTINGS);
  const value = loadSettings({ getItem: () => JSON.stringify({ language: 'zh', sound: false, music: 'yes', fast: true }) });
  assert.equal(value.language, 'en'); assert.equal(value.sound, false); assert.equal(value.music, false); assert.equal(value.fast, true);
  assert.notEqual(SAVE_KEY, SETTINGS_KEY);
});
test('many local rounds preserve nonnegative integer balances and valid resumable states', () => {
  let state = newGame();
  for (let i = 0; i < 400; i++) {
    state = transition(state, { type: 'DEAL' });
    assert.equal(validateSave(state), true);
    state = transition(state, { type: 'DRAW' });
    assert.equal(validateSave(state), true);
    if (state.pending) state = transition(state, { type: 'COLLECT' });
    assert.equal(validateSave(state), true);
    assert.equal(state.balance + state.stats.wagered - state.stats.returned, INITIAL_BALANCE);
  }
  assert.equal(state.history.length, 100);
});
