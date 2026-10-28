export const VERSION = 1;
export const INITIAL_BALANCE = 4_000_000;
export const BETS = [100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000];
export const PAYTABLE = [
  { key: 'royal', name: 'Royal Flush', multiplier: 250 },
  { key: 'five', name: '5 of a kind', multiplier: 100 },
  { key: 'straight-flush', name: 'Straight Flush', multiplier: 40 },
  { key: 'four', name: '4 of a kind', multiplier: 8 },
  { key: 'full-house', name: 'Full House', multiplier: 5 },
  { key: 'flush', name: 'Flush', multiplier: 4 },
  { key: 'straight', name: 'Straight', multiplier: 3 },
  { key: 'three', name: '3 of a kind', multiplier: 2 },
  { key: 'two-pair', name: '2 Pair', multiplier: 1 },
];
const SUITS = ['Club', 'Diamond', 'Heart', 'Spade'];
export function cardInfo(id) {
  if (!Number.isInteger(id) || id < 0 || id > 53) throw new Error('Invalid card');
  if (id >= 52) return { id, rank: 0, suit: 'Joker', joker: true, name: id === 52 ? 'Red Joker' : 'Black Joker', image: `Joker_${id === 52 ? 'R' : 'B'}` };
  const rank = id % 13 + 1, suit = SUITS[Math.floor(id / 13)];
  const face = { 1: 'Ace', 11: 'Jack', 12: 'Queen', 13: 'King' }[rank] || String(rank);
  const prefix = rank > 10 ? face : String(rank).padStart(2, '0');
  return { id, rank, suit, joker: false, name: `${face} of ${suit}s`, image: `${prefix}_${suit === 'Club' || suit === 'Spade' ? 'a' : 'b'}_${suit}` };
}
export function validateCards(cards, size = Array.isArray(cards) ? cards.length : 0) {
  return Array.isArray(cards) && cards.length === size && new Set(cards).size === size && cards.every(id => Number.isInteger(id) && id >= 0 && id <= 53);
}
export function shuffledDeck(includeJokers = true, randomInt = secureRandomInt) {
  const deck = Array.from({ length: includeJokers ? 54 : 52 }, (_, i) => i);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    if (!Number.isInteger(j) || j < 0 || j > i) throw new Error('Invalid random index');
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
function secureRandomInt(max) {
  // Rejection sampling avoids modulo bias in the local shuffled deck.
  const boundary = Math.floor(0x100000000 / max) * max;
  const values = new Uint32Array(1);
  do { globalThis.crypto.getRandomValues(values); } while (values[0] >= boundary);
  return values[0] % max;
}
function straightPossible(ranks) {
  if (new Set(ranks).size !== ranks.length) return false;
  for (let high = 5; high <= 14; high++) {
    const run = high === 5 ? [14, 2, 3, 4, 5] : Array.from({ length: 5 }, (_, i) => high - i);
    if (ranks.every(rank => run.includes(rank))) return true;
  }
  return false;
}
export function evaluateHand(hand) {
  if (!validateCards(hand, 5)) throw new Error('A hand must contain five different physical cards');
  const cards = hand.map(cardInfo), natural = cards.filter(c => !c.joker), wild = 5 - natural.length;
  const ranks = natural.map(c => c.rank === 1 ? 14 : c.rank);
  const counts = new Map(); for (const rank of ranks) counts.set(rank, (counts.get(rank) || 0) + 1);
  const groups = [...counts.values()].sort((a, b) => b - a);
  const flush = natural.every(c => c.suit === natural[0].suit);
  const straight = straightPossible(ranks);
  let key = 'none';
  if (flush && new Set(ranks).size === ranks.length && ranks.every(r => r >= 10)) key = 'royal';
  else if (groups[0] + wild >= 5) key = 'five';
  else if (flush && straight) key = 'straight-flush';
  else if (groups[0] + wild >= 4) key = 'four';
  else {
    // Enumerate only rank assignments (at most 13²), preserving physical cards.
    let fullHouse = false, three = false, twoPair = false;
    function visit(left) {
      if (!left) {
        const values = [...counts.values()].sort((a, b) => b - a);
        fullHouse ||= values[0] === 3 && values[1] === 2;
        three ||= values[0] >= 3;
        twoPair ||= values.filter(n => n >= 2).length >= 2;
        return;
      }
      for (let rank = 2; rank <= 14; rank++) {
        const before = counts.get(rank) || 0;
        counts.set(rank, before + 1); visit(left - 1);
        if (before) counts.set(rank, before); else counts.delete(rank);
      }
    }
    visit(wild);
    if (fullHouse) key = 'full-house';
    else if (flush) key = 'flush';
    else if (straight) key = 'straight';
    else if (three) key = 'three';
    else if (twoPair) key = 'two-pair';
  }
  const entry = PAYTABLE.find(p => p.key === key) || { key, name: 'No win', multiplier: 0 };
  let winning = [];
  if (entry.multiplier) {
    if (['royal', 'straight-flush', 'full-house', 'flush', 'straight'].includes(key)) winning = hand.map((_, i) => i);
    else {
      const targetRank = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
      winning = cards.flatMap((c, i) => c.joker || (key === 'two-pair' ? (counts.get(c.rank === 1 ? 14 : c.rank) || 0) >= 2 : (c.rank === 1 ? 14 : c.rank) === targetRank) ? [i] : []);
    }
  }
  return { ...entry, winning };
}
export function suggestedHolds(hand) {
  const result = evaluateHand(hand), cards = hand.map(cardInfo);
  if (result.multiplier) return hand.map((_, i) => result.winning.includes(i));
  const counts = new Map(); cards.filter(c => !c.joker).forEach(c => counts.set(c.rank, (counts.get(c.rank) || 0) + 1));
  if ([...counts.values()].some(n => n >= 2)) return cards.map(c => c.joker || counts.get(c.rank) >= 2);
  for (const suit of SUITS) {
    const suited = cards.filter(c => c.suit === suit);
    if (suited.length >= 4) return cards.map(c => c.joker || c.suit === suit);
  }
  return cards.map(c => c.joker);
}
export function newGame() {
  return {
    version: VERSION, phase: 'ready', balance: INITIAL_BALANCE, bet: 10000, pending: 0,
    hand: [], held: [false, false, false, false, false], deck: [], result: null,
    round: 0, history: [], double: null, secured: 0, collected: 0,
    stats: { played: 0, wagered: 0, returned: 0, bestWin: 0 },
  };
}
function recordCredit(state, amount) {
  return { ...state, balance: state.balance + amount, secured: state.secured + amount,
    stats: { ...state.stats, returned: state.stats.returned + amount, bestWin: Math.max(state.stats.bestWin, state.secured + amount) },
    history: state.history.map((row, i) => i === 0 ? { ...row, returned: row.returned + amount } : row) };
}
export function transition(state, action) {
  switch (action.type) {
    case 'BET': return ['ready', 'lose', 'collected'].includes(state.phase) && BETS.includes(action.amount) ? { ...state, bet: action.amount } : state;
    case 'DEAL': {
      if (!['ready', 'lose', 'collected'].includes(state.phase) || state.balance < state.bet) return state;
      const deck = action.deck || shuffledDeck();
      if (!validateCards(deck, 54)) throw new Error('Deal requires a complete 54-card deck');
      const hand = deck.slice(0, 5);
      return { ...state, phase: 'hold', balance: state.balance - state.bet, pending: 0, hand,
        held: suggestedHolds(hand), deck: deck.slice(5), result: null, round: state.round + 1,
        double: null, secured: 0, collected: 0,
        stats: { ...state.stats, wagered: state.stats.wagered + state.bet } };
    }
    case 'HOLD': return state.phase === 'hold' && Number.isInteger(action.index) && action.index >= 0 && action.index < 5
      ? { ...state, held: state.held.map((v, i) => i === action.index ? !v : v) } : state;
    case 'HOLD-NONE': return state.phase === 'hold' ? { ...state, held: state.held.map(() => false) } : state;
    case 'DRAW': {
      if (state.phase !== 'hold') return state;
      let cursor = 0;
      const hand = state.hand.map((card, i) => state.held[i] ? card : state.deck[cursor++]);
      const result = evaluateHand(hand), pending = state.bet * result.multiplier;
      const row = { id: state.round, hand, bet: state.bet, key: result.key, payout: pending, returned: 0, at: action.at || new Date().toISOString() };
      return { ...state, phase: pending ? 'win' : 'lose', hand, deck: state.deck.slice(cursor), result, pending,
        stats: { ...state.stats, played: state.stats.played + 1 }, history: [row, ...state.history].slice(0, 100) };
    }
    case 'COLLECT': {
      if (!['win', 'double', 'double-result'].includes(state.phase) || !state.pending) return state;
      return { ...recordCredit(state, state.pending), phase: 'collected', pending: 0, collected: state.secured + state.pending, double: null };
    }
    case 'DOUBLE': {
      if (state.phase !== 'win' || !state.pending || action.half && state.pending < 2) return state;
      const deck = action.deck || shuffledDeck(false);
      if (!validateCards(deck, 52) || deck.some(id => id > 51)) throw new Error('Double Up requires a complete 52-card deck');
      const safe = action.half ? Math.floor(state.pending / 2) : 0;
      const next = safe ? recordCredit(state, safe) : state;
      return { ...next, phase: 'double', pending: state.pending - safe,
        double: { deck, history: [], wins: 0, base: state.pending - safe, last: null, outcome: null, complete: false } };
    }
    case 'GUESS': {
      if (state.phase !== 'double' || !['big', 'small'].includes(action.choice) || !state.double.deck.length) return state;
      const [card, ...deck] = state.double.deck, rank = cardInfo(card).rank;
      const tie = rank === 7, correct = action.choice === 'big' ? rank >= 8 : rank <= 6;
      const wins = state.double.wins + (correct ? 1 : 0), complete = wins === 5;
      const pending = tie ? state.pending : correct ? state.pending * 2 : 0;
      return { ...state, phase: 'double-result', pending,
        double: { ...state.double, deck, history: [...state.double.history, card], wins, last: card,
          outcome: tie ? 'push' : correct ? 'win' : 'lose', complete } };
    }
    case 'CONTINUE': {
      if (state.phase !== 'double-result') return state;
      if (!state.pending) return { ...state, phase: 'lose', double: null };
      if (state.double.complete) return transition(state, { type: 'COLLECT' });
      return { ...state, phase: 'double', double: { ...state.double, last: null, outcome: null } };
    }
    case 'RESET': return newGame();
    default: return state;
  }
}

export function validateSave(value) {
  try {
    if (!value || value.version !== VERSION || !['ready', 'hold', 'win', 'lose', 'double', 'double-result', 'collected'].includes(value.phase)) return false;
    const money = n => Number.isSafeInteger(n) && n >= 0 && n <= 1_000_000_000_000;
    if (![value.balance, value.bet, value.pending, value.secured, value.collected].every(money) || !BETS.includes(value.bet)) return false;
    if (!Number.isSafeInteger(value.round) || value.round < 0 || !Array.isArray(value.held) || value.held.length !== 5 || value.held.some(x => typeof x !== 'boolean')) return false;
    if (!validateCards(value.hand) || ![0, 5].includes(value.hand.length) || !validateCards(value.deck) || !validateCards([...value.hand, ...value.deck])) return false;
    if (value.phase !== 'ready' && value.hand.length !== 5) return false;
    if (['ready', 'hold'].includes(value.phase)) {
      if (value.result !== null) return false;
    } else {
      const actual = evaluateHand(value.hand), result = value.result;
      if (!result || result.key !== actual.key || result.name !== actual.name || result.multiplier !== actual.multiplier || JSON.stringify(result.winning) !== JSON.stringify(actual.winning)) return false;
    }
    if (value.phase === 'hold' && (value.deck.length !== 49 || value.pending !== 0)) return false;
    if (value.phase === 'win' && (!value.pending || value.pending !== value.bet * evaluateHand(value.hand).multiplier)) return false;
    if (['ready', 'hold', 'lose', 'collected'].includes(value.phase) && value.pending !== 0) return false;
    if (!value.stats || !['played', 'wagered', 'returned', 'bestWin'].every(k => money(value.stats[k]))) return false;
    if (!Array.isArray(value.history) || value.history.length > 100 || !value.history.every(r => validateCards(r.hand, 5) && BETS.includes(r.bet) && money(r.payout) && money(r.returned) && Number.isInteger(r.id) && typeof r.at === 'string' && (r.key === 'none' || PAYTABLE.some(p => p.key === r.key)))) return false;
    if (['double', 'double-result'].includes(value.phase)) {
      const d = value.double;
      if (!d || !validateCards(d.deck) || !validateCards(d.history) || !validateCards([...d.deck, ...d.history], 52) || [...d.deck, ...d.history].some(id => id > 51)) return false;
      if (!Number.isInteger(d.wins) || d.wins < 0 || d.wins > 5 || !money(d.base) || !d.base || typeof d.complete !== 'boolean') return false;
      if (d.wins > d.history.length || d.complete !== (d.wins === 5) || value.pending !== (d.outcome === 'lose' ? 0 : d.base * 2 ** d.wins)) return false;
      if (value.phase === 'double' && (!value.pending || d.complete || d.last !== null || d.outcome !== null)) return false;
      if (value.phase === 'double-result' && (!['win', 'lose', 'push'].includes(d.outcome) || d.history.at(-1) !== d.last)) return false;
    } else if (value.double !== null) return false;
    return true;
  } catch { return false; }
}
