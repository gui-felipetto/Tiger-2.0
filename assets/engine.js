// All amounts are integer hundredths of a fictional credit.
export const STORAGE_KEY = 'tiger-club:v2';
export const BETS = [1000, 2500, 5000, 10000];
export const SYMBOLS = ['🍒', '🍋', '🔔', '🍀', '💎', '🐯'];
export const PAYOUTS = [4, 5, 7, 10, 15, 25];
export const INITIAL_BALANCE = 100000;
export const BONUS = 50000;

export function randomInt(max) {
  if (!Number.isInteger(max) || max < 1 || max > 0x100000000) throw new Error('Sorteio inválido.');
  const limit = Math.floor(0x100000000 / max) * max;
  const sample = new Uint32Array(1);
  do { globalThis.crypto.getRandomValues(sample); } while (sample[0] >= limit);
  return sample[0] % max;
}

export function localDay(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function createState() {
  return { version: 2, balance: INITIAL_BALANCE, bet: 2500, name: 'Visitante', sound: false,
    reducedMotion: false, favorites: [], lastBonus: null, history: [], round: null, totalRounds: 0, bestWin: 0 };
}

const money = n => Number.isSafeInteger(n) && n >= 0 && n <= 1e14;
const games = ['slots', 'double', 'mines'];
export function restoreState(raw) {
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!data || data.version !== 2 || !money(data.balance)) return createState();
    const state = { ...createState(), balance: data.balance,
      bet: BETS.includes(data.bet) ? data.bet : 2500,
      name: typeof data.name === 'string' ? data.name.slice(0, 24) : 'Visitante',
      sound: data.sound === true, reducedMotion: data.reducedMotion === true,
      favorites: Array.isArray(data.favorites) ? [...new Set(data.favorites.filter(id => games.includes(id)))] : [],
      lastBonus: /^\d{4}-\d{2}-\d{2}$/.test(data.lastBonus) ? data.lastBonus : null,
      totalRounds: money(data.totalRounds) ? data.totalRounds : 0,
      bestWin: money(data.bestWin) ? data.bestWin : 0,
      history: Array.isArray(data.history) ? data.history.filter(h => h && games.includes(h.game) && money(h.stake) && money(h.payout) && Number.isSafeInteger(h.time) && h.time >= 0 && h.time <= 8640000000000000).slice(0, 50).map(h => ({ game: h.game, stake: h.stake, payout: h.payout, time: h.time })) : [] };
    const r = data.round;
    if (r?.game === 'mines' && money(r.stake) && BETS.includes(r.stake) && [3, 5, 10].includes(r.count)
      && Array.isArray(r.mines) && r.mines.length === r.count && new Set(r.mines).size === r.count
      && r.mines.every(n => Number.isInteger(n) && n >= 0 && n < 25)
      && Array.isArray(r.revealed) && new Set(r.revealed).size === r.revealed.length
      && r.revealed.length < 25 - r.count
      && r.revealed.every(n => Number.isInteger(n) && n >= 0 && n < 25 && !r.mines.includes(n))) {
      state.round = { game: 'mines', stake: r.stake, count: r.count, mines: [...r.mines], revealed: [...r.revealed] };
    }
    return state;
  } catch { return createState(); }
}

function checkStake(state, stake) {
  if (state.round) throw new Error('Termine sua rodada de Minas primeiro.');
  if (!BETS.includes(stake)) throw new Error('Escolha uma aposta válida.');
  if (state.balance < stake) throw new Error('Créditos insuficientes. Pegue créditos grátis na carteira.');
}

function record(state, game, stake, payout, time = Date.now()) {
  return { ...state, balance: state.balance + payout, round: null,
    totalRounds: state.totalRounds + 1, bestWin: Math.max(state.bestWin, payout),
    history: [{ game, stake, payout, time }, ...state.history].slice(0, 50) };
}

export function slotPayout(line, stake) {
  if (line.length !== 3 || line.some(n => !Number.isInteger(n) || n < 0 || n >= SYMBOLS.length)) throw new Error('Linha inválida.');
  const unique = new Set(line).size;
  const multiplier = unique === 1 ? PAYOUTS[line[0]] : unique === 2 ? 1.5 : 0;
  return { multiplier, payout: Math.floor(stake * multiplier) };
}

export function spinSlots(state, stake, rng = randomInt) {
  checkStake(state, stake);
  const line = Array.from({ length: 3 }, () => rng(SYMBOLS.length));
  const result = { line, ...slotPayout(line, stake) };
  return { state: record({ ...state, balance: state.balance - stake }, 'slots', stake, result.payout), result };
}

export function doubleColor(n) { return n === 0 ? 'gold' : n <= 7 ? 'red' : 'black'; }

export function spinDouble(state, stake, color, rng = randomInt) {
  checkStake(state, stake);
  if (!['red', 'gold', 'black'].includes(color)) throw new Error('Escolha uma cor.');
  const number = rng(15);
  const winner = doubleColor(number);
  const multiplier = winner === color ? (color === 'gold' ? 14 : 2) : 0;
  const payout = stake * multiplier;
  return { state: record({ ...state, balance: state.balance - stake }, 'double', stake, payout),
    result: { number, color: winner, multiplier, payout } };
}

export function minesMultiplier(count, revealed) {
  if (![3, 5, 10].includes(count) || !Number.isInteger(revealed) || revealed < 0 || revealed > 25 - count) throw new Error('Rodada inválida.');
  if (revealed === 0) return 1;
  let probability = 1;
  for (let i = 0; i < revealed; i++) probability *= (25 - count - i) / (25 - i);
  return Math.floor(0.96 / probability * 100) / 100;
}

export function startMines(state, stake, count, rng = randomInt) {
  checkStake(state, stake);
  if (![3, 5, 10].includes(count)) throw new Error('Escolha 3, 5 ou 10 minas.');
  const cells = Array.from({ length: 25 }, (_, i) => i);
  for (let i = 0; i < count; i++) {
    const j = i + rng(25 - i);
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  return { ...state, balance: state.balance - stake,
    round: { game: 'mines', stake, count, mines: cells.slice(0, count), revealed: [] } };
}

export function revealMine(state, index) {
  const r = state.round;
  if (!r || !Number.isInteger(index) || index < 0 || index > 24 || r.revealed.includes(index)) throw new Error('Escolha uma casa fechada.');
  if (r.mines.includes(index)) return { state: record(state, 'mines', r.stake, 0), result: { hit: true, mines: r.mines, revealed: r.revealed, payout: 0 } };
  const round = { ...r, revealed: [...r.revealed, index] };
  const multiplier = minesMultiplier(round.count, round.revealed.length);
  const payout = Math.floor(round.stake * multiplier);
  if (round.revealed.length === 25 - round.count) return { state: record(state, 'mines', r.stake, payout), result: { complete: true, mines: r.mines, revealed: round.revealed, payout, multiplier } };
  return { state: { ...state, round }, result: { hit: false, payout, multiplier } };
}

export function collectMines(state) {
  if (!state.round || state.round.revealed.length === 0) throw new Error('Revele pelo menos um diamante.');
  const { stake, count, revealed, mines } = state.round;
  const multiplier = minesMultiplier(count, revealed.length);
  const payout = Math.floor(stake * multiplier);
  return { state: record(state, 'mines', stake, payout), result: { payout, multiplier, revealed, mines, complete: true } };
}

export function claimBonus(state, day = localDay()) {
  if (state.lastBonus === day) throw new Error('Seu bônus de hoje já foi resgatado. Volte amanhã!');
  return { ...state, balance: state.balance + BONUS, lastBonus: day };
}

export function refill(state) {
  if (state.round) throw new Error('Termine sua rodada de Minas primeiro.');
  if (state.balance >= BETS[0]) throw new Error('O resgate fica disponível quando o saldo cai abaixo de 10.');
  return { ...state, balance: state.balance + INITIAL_BALANCE };
}
