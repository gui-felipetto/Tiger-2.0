import { STORAGE_KEY, BETS, SYMBOLS, PAYOUTS, BONUS, createState, restoreState, localDay,
  spinSlots, spinDouble, startMines, revealMine, collectMines, minesMultiplier, claimBonus, refill } from './engine.js';

const $ = selector => document.querySelector(selector);
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const fmt = amount => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(amount / 100);
const titles = { slots: 'Tiger Slots', double: 'Double', mines: 'Minas' };
const emojis = { slots: '🐯', double: '🎯', mines: '💎' };
const colors = { red: 'Coral', gold: 'Dourado', black: 'Roxo' };
const routes = ['inicio', 'jogos', 'carteira', 'perfil', 'historico', 'slots', 'double', 'mines'];
const main = $('#main');
const sheet = $('#sheet');
let storageAvailable = true;
function readState() {
  try { return restoreState(localStorage.getItem(STORAGE_KEY)); }
  catch { storageAvailable = false; return createState(); }
}
let state = readState();
const ui = { route: 'inicio', filter: 'all', busy: false, slotLine: [0, 4, 5], slotResult: null,
  doubleResult: null, doubleColor: 'red', doubleRecent: [], minesCount: state.round?.count || 3,
  mineEnd: null, toastTimer: null };

function toast(message) {
  clearTimeout(ui.toastTimer);
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  ui.toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 4300);
}

// A single persisted update per action; a reload cannot replay a paid round.
async function commit(transform) {
  const update = () => {
    let current = state;
    if (storageAvailable) {
      try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) current = restoreState(raw); }
      catch { storageAvailable = false; }
    }
    const next = transform(current);
    if (storageAvailable) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
      catch { storageAvailable = false; toast('O navegador não permite salvar. Seu progresso dura só nesta aba.'); }
    }
    state = next;
  };
  if (navigator.locks?.request) await navigator.locks.request('tiger-club-wallet', update);
  else update();
}

function note() { return `<div class="fun-note">${icon('info')}<span>Aqui só vale a diversão. Bryams são créditos fictícios, sem valor em dinheiro. Sem depósitos ou saques.</span></div>`; }
function resume() { return state.round ? `<a class="resume-banner" href="#mines"><span>💎 Sua rodada de Minas está em andamento</span>${icon('arrow')}</a>` : ''; }
function gameCard(id) {
  const art = id === 'slots' ? `<div class="art-word">TIGER<span>SLOTS</span><small>O CLÁSSICO DO CLUB</small></div><div class="card-reels" aria-hidden="true"><span>🍒</span><span>💎</span><span>🐯</span></div><img class="card-tiger" src="/assets/tiger.svg" alt="" width="149" height="163">`
    : id === 'double' ? `<div class="roulette-mini" aria-hidden="true"><b>7</b><b>✦</b><b>12</b></div>`
    : `<span class="gem-art" aria-hidden="true">💎</span><span class="gem-small" aria-hidden="true">✦</span>`;
  const subtitle = { slots: '3 símbolos. Uma boa surpresa.', double: 'Escolha a cor. Dê seu play.', mines: 'Encontre seu próximo diamante.' }[id];
  return `<article class="game-card ${id === 'slots' ? 'featured' : ''}">
    <a class="game-link" href="#${id}" aria-label="Jogar ${titles[id]}"><div class="game-art ${id}-art">${art}</div><div class="game-caption"><div><strong>${titles[id]}</strong><small>${subtitle}</small></div><span class="play-circle">${icon('arrow')}</span></div></a>
    <button class="favorite" data-action="favorite" data-game="${id}" aria-label="Favoritar ${titles[id]}" aria-pressed="${state.favorites.includes(id)}">${icon('star')}</button></article>`;
}

function homeView() {
  return `<div class="welcome-line"><span>Seu momento de <strong>diversão.</strong></span><span class="mode-pill">Modo diversão</span></div>
    <section class="hero" aria-label="Bem-vindo ao Tiger Club"><span class="eyebrow">SEU PLAYGROUND DE SORTE</span><h1>Só vale a<br><em>diversão.</em></h1><p>Entre no club. Escolha seu jogo.<br>O resto é por conta da sorte.</p><span class="mini-pill">100% GRÁTIS · 100% DE BRINCADEIRA</span><img class="hero-tiger" src="/assets/tiger.svg" alt="Tigrinho sorridente segurando uma moeda de Bryam" width="320" height="350"><span class="spark" aria-hidden="true">✦</span><span class="spark two" aria-hidden="true">✧</span></section>
    <button class="bonus-banner" data-action="bonus"><span class="gift-box">${icon('gift')}</span><span class="bonus-copy"><strong>${state.lastBonus === localDay() ? 'Seu presente de hoje já está na conta' : 'Um presentinho do club pra você'}</strong><small>${state.lastBonus === localDay() ? 'Amanhã tem mais 500 Bryams te esperando.' : '+500 Bryams grátis. Resgate seu bônus diário.'}</small></span>${icon('arrow')}</button>
    ${resume()}<div class="section-heading"><h2>Qual é o seu jogo?</h2><a href="#jogos">Ver todos ${icon('arrow')}</a></div><div class="game-grid">${Object.keys(titles).map(gameCard).join('')}</div>${note()}`;
}

function gamesView() {
  const list = Object.keys(titles).filter(id => ui.filter !== 'favorites' || state.favorites.includes(id));
  return `<div class="page-intro"><p class="eyebrow">ESCOLHA SEU PLAY</p><h1>Pequenas pausas.<br>Grandes diversões.</h1><p>Três jeitos de brincar com a sorte.</p></div>
    <div class="filter-tabs" role="group" aria-label="Filtrar jogos"><button class="chip ${ui.filter === 'all' ? 'selected' : ''}" data-action="filter" data-filter="all" aria-pressed="${ui.filter === 'all'}">Todos os jogos</button><button class="chip ${ui.filter === 'favorites' ? 'selected' : ''}" data-action="filter" data-filter="favorites" aria-pressed="${ui.filter === 'favorites'}">☆ Favoritos</button></div>
    ${resume()}${list.length ? `<div class="game-grid">${list.map(gameCard).join('')}</div>` : `<div class="panel empty">${icon('star')}<h3>Seu cantinho de favoritos</h3><p>Toque na estrela de um jogo para salvar aqui.</p></div>`}${note()}`;
}

function historyList(limit = 50) {
  if (!state.history.length) return `<div class="empty">${icon('clock')}<h3>A história começa no play</h3><p>Suas rodadas aparecem aqui assim que você jogar.</p><a class="text-button" href="#jogos">Encontrar um jogo ${icon('arrow')}</a></div>`;
  return `<div class="history-list">${state.history.slice(0, limit).map(h => `<div class="history-row"><span class="history-emoji" aria-hidden="true">${emojis[h.game]}</span><div class="history-copy"><strong>${titles[h.game]}</strong><small>${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(h.time)}</small></div><div class="history-value ${h.payout > h.stake ? 'green' : ''}">${h.payout ? `+${fmt(h.payout)}` : 'Sem prêmio'}<small>Aposta: ${fmt(h.stake)} B</small></div></div>`).join('')}</div>`;
}

function walletView() {
  const claimed = state.lastBonus === localDay();
  return `<div class="page-intro"><p class="eyebrow">SEU BOLSO DE DIVERSÃO</p><h1>Minha carteira</h1><p>O saldo é de mentira. A diversão é toda sua.</p></div>
    <section class="panel balance-card"><span class="eyebrow">SEU SALDO DISPONÍVEL</span><div class="balance-number"><span class="coin">B</span><span class="balance-amount">${fmt(state.balance)}</span></div><p>Bryams · sem valor em dinheiro</p>${state.round ? `<p>+ ${fmt(state.round.stake)} B em uma rodada de Minas.</p>` : ''}</section>
    <section class="panel"><div class="panel-title">${icon('gift')}<h3>Um bônus por dia</h3></div><p>O club te dá 500 Bryams por dia. É só chegar e resgatar.</p><button class="button" data-action="claim" ${claimed ? 'disabled' : ''}>${icon(claimed ? 'check' : 'gift')}${claimed ? 'Resgatado · volte amanhã' : 'Resgatar 500 Bryams'}</button></section>
    ${state.balance < BETS[0] && !state.round ? `<section class="panel"><h3>Zerou? Comece de novo.</h3><p>Pegue 1.000 Bryams para continuar brincando. O resgate é gratuito e fica disponível com menos de 10 Bryams.</p><button class="button secondary" data-action="refill">Recarregar 1.000 Bryams</button></section>` : ''}
    ${resume()}<div class="section-heading"><h2>Últimas rodadas</h2><a href="#historico">Ver histórico ${icon('arrow')}</a></div>${historyList(5)}${note()}`;
}

function profileView() {
  return `<div class="profile-heading"><div class="avatar" aria-hidden="true">🐯</div><h1 id="profile-name"></h1><p>Seu cantinho no Tiger Club</p></div>
    <div class="stats"><div class="stat"><strong>${state.totalRounds}</strong><small>rodadas jogadas</small></div><div class="stat"><strong>${fmt(state.bestWin)}</strong><small>maior prêmio em Bryams</small></div></div>
    <section class="panel"><h3>Do seu jeito</h3><form id="name-form"><label class="field" for="nickname">Como o club pode te chamar?</label><input id="nickname" name="nickname" autocomplete="nickname" maxlength="24" required placeholder="Seu apelido"><button class="button secondary" type="submit">Salvar apelido</button></form>
    <div class="setting"><div><strong>Efeitos sonoros</strong><small>Um toque a mais em cada resultado</small></div><button class="switch" role="switch" aria-checked="${state.sound}" aria-label="Efeitos sonoros" data-action="sound"><span></span></button></div>
    <div class="setting"><div><strong>Menos movimento</strong><small>Resultados diretos, sem animações</small></div><button class="switch" role="switch" aria-checked="${state.reducedMotion}" aria-label="Menos movimento" data-action="motion"><span></span></button></div>
    <button class="text-button" data-action="about">${icon('info')}Como funciona o Tiger Club</button><a class="text-button" href="#historico">${icon('clock')}Meu histórico de rodadas</a><button class="text-button" data-action="reset-dialog">${icon('spin')}Recomeçar meu progresso</button></section>${note()}<p class="game-footer">Feito para jogar de leve. Tiger Club v2.0</p>`;
}

function gameHeader(id) {
  return `<div class="game-header"><a class="icon-button" href="#jogos" aria-label="Voltar aos jogos">${icon('back')}</a><div><h1>${titles[id]}</h1><p>Créditos fictícios. Diversão de verdade.</p></div><button class="icon-button" data-action="rules" data-game="${id}" aria-label="Regras de ${titles[id]}">${icon('info')}</button></div>`;
}

function betPanel(id, button, disabled = false) {
  const locked = ui.busy || !!state.round;
  const insufficient = !state.round && state.balance < state.bet;
  return `<div class="bet-panel"><div class="bet-label"><span>Aposta em Bryams</span><strong>Saldo: ${fmt(state.balance)} B</strong></div><div class="bet-chips" role="group" aria-label="Valor da aposta">${BETS.map(b => `<button class="chip ${state.bet === b ? 'selected' : ''}" data-action="bet" data-bet="${b}" aria-pressed="${state.bet === b}" ${locked ? 'disabled' : ''}>${fmt(b)}</button>`).join('')}</div>
    ${insufficient ? `<p class="low-balance">Seu saldo não cobre essa aposta. Escolha um valor menor ou <a href="#carteira">abra a carteira</a>.</p>` : ''}
    <button class="button" data-action="play" data-game="${id}" ${ui.busy || insufficient || disabled ? 'disabled' : ''}>${icon(id === 'mines' && state.round ? 'check' : 'spin')}${ui.busy ? 'Sorteando…' : button}</button></div>
    <div class="game-footer">Só por diversão. <button data-action="rules" data-game="${id}">Veja como jogar</button></div>`;
}

function resultBox(result, idle, subtitle) {
  if (ui.busy) return `<div class="result-box" role="status"><strong>A sorte está girando…</strong><p>O resultado vem aí.</p></div>`;
  return `<div class="result-box ${result?.payout ? 'win' : ''}" role="status"><strong>${result ? (result.payout ? `+${fmt(result.payout)} Bryams!` : 'Não foi dessa vez') : idle}</strong><p>${result ? (result.payout ? `Prêmio total · ${result.multiplier.toLocaleString('pt-BR')}× sua aposta` : 'Cada rodada é uma nova história.') : subtitle}</p></div>`;
}

function slotsView() {
  return `${gameHeader('slots')}<section class="game-stage"><img class="slot-mascot" src="/assets/tiger.svg" alt="" width="104" height="104"><div class="slot-marquee">✦ TIGER SLOTS ✦</div><div class="slot-machine ${ui.busy ? 'spinning' : ''}" aria-label="Linha de resultado: ${ui.slotLine.map(n => SYMBOLS[n]).join(' ')}">${ui.slotLine.map((n, i) => `<div class="reel" aria-hidden="true"><span>${SYMBOLS[(n + 2 + i) % 6]}</span><span>${SYMBOLS[n]}</span><span>${SYMBOLS[(n + 4 + i) % 6]}</span></div>`).join('')}</div><p class="payline-label">Só a linha central vale prêmio</p></section>
    ${resultBox(ui.slotResult, 'Seu próximo play pode surpreender', 'Dois ou três símbolos iguais na linha central premiam.')}${state.round ? resume() : betPanel('slots', `Girar por ${fmt(state.bet)} B`)}`;
}

const wheelOrder = [0, 1, 8, 2, 9, 3, 10, 4, 11, 5, 12, 6, 13, 7, 14];
function doubleView() {
  const number = ui.doubleResult?.number ?? 0;
  const index = wheelOrder.indexOf(number) + 15;
  return `${gameHeader('double')}<section class="game-stage"><div class="slot-marquee">ESCOLHA SUA COR</div><div class="roulette-window" aria-label="${ui.doubleResult ? `Resultado: ${number}, ${colors[ui.doubleResult.color]}` : 'Roleta Double'}"><div class="roulette-pointer" aria-hidden="true"></div><div class="roulette-track" id="roulette-track" data-index="${index}">${Array.from({ length: 3 }, () => wheelOrder).flat().map(n => `<span class="roulette-tile ${n === 0 ? 'gold' : n <= 7 ? 'red' : 'black'}" aria-hidden="true">${n === 0 ? '✦' : n}</span>`).join('')}</div></div><div class="recent-doubles">${ui.doubleRecent.length ? ui.doubleRecent.slice(0, 10).map(r => `<span class="recent-ball ${r.color}" title="${colors[r.color]}">${r.number}</span>`).join('') : '<small>Os resultados desta sessão aparecem aqui</small>'}</div></section>
    ${resultBox(ui.doubleResult, 'Uma cor. Um palpite.', 'Coral e roxo pagam 2×. Dourado paga 14×.')}
    <div class="double-picks" role="group" aria-label="Escolher cor">${['red', 'gold', 'black'].map(c => `<button class="color-pick ${c} ${ui.doubleColor === c ? 'selected' : ''}" data-action="color" data-color="${c}" aria-pressed="${ui.doubleColor === c}" ${ui.busy ? 'disabled' : ''}><b>${colors[c]}</b><small>${c === 'gold' ? '14× · número 0' : `2× · ${c === 'red' ? '1 a 7' : '8 a 14'}`}</small></button>`).join('')}</div>
    ${state.round ? resume() : betPanel('double', `Jogar ${fmt(state.bet)} B no ${colors[ui.doubleColor].toLowerCase()}`)}`;
}

function minesView() {
  const round = state.round;
  const revealed = round?.revealed || ui.mineEnd?.revealed || [];
  const mines = round ? [] : ui.mineEnd?.mines || [];
  const count = round?.count || ui.minesCount;
  const multiplier = minesMultiplier(count, revealed.length);
  const potential = Math.floor((round?.stake || state.bet) * multiplier);
  return `${gameHeader('mines')}<section class="game-stage"><div class="mines-stats"><span>${count} minas escondidas<b>${revealed.length} ${revealed.length === 1 ? 'diamante' : 'diamantes'}</b></span><span>Multiplicador atual<b>${multiplier.toLocaleString('pt-BR')}×</b></span></div>
    <div class="mines-grid" role="group" aria-label="Campo de 25 casas">${Array.from({ length: 25 }, (_, i) => {
      const safe = revealed.includes(i), hit = mines.includes(i);
      return `<button class="mine-cell ${safe ? 'revealed' : ''} ${hit ? 'hit' : ''} ${!round && ui.mineEnd && !safe ? 'end' : ''}" data-action="reveal" data-cell="${i}" aria-label="Casa ${i + 1}${safe ? ', diamante' : hit ? ', mina' : ', fechada'}" ${!round || safe || ui.busy ? 'disabled' : ''}>${safe ? '💎' : hit ? '💣' : '✦'}</button>`;
    }).join('')}</div><div class="mines-count"><span>Quantidade de minas</span><div role="group" aria-label="Quantidade de minas">${[3, 5, 10].map(n => `<button class="chip ${count === n ? 'selected' : ''}" data-action="mine-count" data-count="${n}" aria-pressed="${count === n}" ${round ? 'disabled' : ''}>${n}</button>`).join('')}</div></div></section>
    ${round ? `<div class="result-box" role="status"><strong>${revealed.length ? `Você já pode coletar ${fmt(potential)} B` : 'Onde está o primeiro diamante?'}</strong><p>${revealed.length ? 'Colete agora ou abra mais uma casa. Você decide.' : 'Toque em uma casa para começar a explorar.'}</p></div>` : resultBox(ui.mineEnd, 'Encontre diamantes. Evite as minas.', 'Você escolhe quando parar e coletar os Bryams.')}
    ${betPanel('mines', round ? `Coletar ${fmt(potential)} B` : `Começar por ${fmt(state.bet)} B`, !!round && revealed.length === 0)}`;
}

function render() {
  const focus = document.activeElement;
  const focusData = Object.entries(focus?.dataset || {});
  const cell = focus?.dataset?.cell;
  $('#header-balance').textContent = fmt(state.balance);
  $('#header-balance').title = `${fmt(state.balance)} Bryams`;
  document.documentElement.classList.toggle('reduce-motion', state.reducedMotion);
  document.title = `${titles[ui.route] || { inicio: 'Só vale a diversão', jogos: 'Jogos', carteira: 'Minha carteira', perfil: 'Meu club', historico: 'Histórico' }[ui.route]} • Tiger Club`;
  const activeNav = titles[ui.route] ? 'jogos' : ui.route === 'historico' ? 'carteira' : ui.route;
  document.querySelectorAll('[data-nav]').forEach(a => { a.classList.toggle('active', a.dataset.nav === activeNav); if (a.dataset.nav === activeNav) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  const views = { inicio: homeView, jogos: gamesView, carteira: walletView, perfil: profileView, slots: slotsView, double: doubleView, mines: minesView,
    historico: () => `${gameHeaderHistory()}${historyList()}${note()}` };
  main.innerHTML = views[ui.route]();
  if (ui.route === 'perfil') { $('#profile-name').textContent = state.name; $('#nickname').value = state.name; }
  const track = $('#roulette-track');
  if (track) track.style.transform = `translateX(-${Number(track.dataset.index) * 66 + 29.5}px)`;
  if (focusData.length) {
    const selector = focusData.map(([key, value]) => `[data-${key.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase())}="${CSS.escape(value)}"]`).join('');
    const target = main.querySelector(selector);
    if (target && !target.disabled) target.focus({ preventScroll: true });
    else if (cell !== undefined) main.querySelector('.mine-cell:not(:disabled)')?.focus({ preventScroll: true });
  }
}

function gameHeaderHistory() { return `<div class="game-header"><a class="icon-button" href="#carteira" aria-label="Voltar à carteira">${icon('back')}</a><div><h1>Suas rodadas</h1><p>As últimas 50 histórias com a sorte.</p></div></div>`; }
function route() {
  const next = location.hash.slice(1);
  ui.route = routes.includes(next) ? next : 'inicio';
  render();
  window.scrollTo({ top: 0, behavior: 'instant' });
  main.focus({ preventScroll: true });
}

function openSheet(title, body) {
  $('#sheet-content').innerHTML = `<div class="sheet-heading"><h2 id="sheet-title">${title}</h2><button class="icon-button" data-action="close" aria-label="Fechar">${icon('close')}</button></div>${body}`;
  sheet.showModal();
}

function showRules(id) {
  const content = {
    slots: `<p>Escolha o valor da aposta e toque em <strong>Girar</strong>. Só os três símbolos da linha central contam. As linhas de cima e de baixo são decorativas.</p><h3>Três iguais na linha central</h3><div class="paytable">${SYMBOLS.map((s, i) => `<div><span>${s} ${s} ${s}</span><b>${PAYOUTS[i]}×</b></div>`).join('')}</div><p><strong>Dois iguais:</strong> prêmio de 1,5×, em qualquer posição da linha central. Três diferentes não premiam.</p><p>Cada símbolo tem chance de 1 em 6 em cada coluna. Os sorteios são independentes. O retorno teórico é de aproximadamente 93,06% em muitas rodadas; uma rodada individual pode não premiar.</p>`,
    double: `<p>Escolha uma cor e o valor da aposta. A roleta sorteia um número de 0 a 14; todos têm a mesma chance.</p><ul><li><strong>Coral (1 a 7):</strong> chance 7/15. Prêmio 2×.</li><li><strong>Roxo (8 a 14):</strong> chance 7/15. Prêmio 2×.</li><li><strong>Dourado (0):</strong> chance 1/15. Prêmio 14×.</li></ul><p>Acertou a cor? O prêmio total entra no saldo. Cada resultado é independente dos anteriores.</p>`,
    mines: `<p>Escolha a aposta e 3, 5 ou 10 minas. Toque em <strong>Começar</strong> para abrir um campo com 25 casas.</p><ul><li>Toque nas casas para procurar diamantes. Cada acerto aumenta o multiplicador.</li><li>Depois do primeiro diamante, você pode <strong>coletar</strong> o prêmio a qualquer momento.</li><li>Se abrir uma mina, a rodada termina sem prêmio e você perde só a aposta daquela rodada.</li><li>Encontrar todos os diamantes coleta o prêmio automaticamente.</li></ul><p>As minas são sorteadas no início e não mudam de lugar. O multiplicador usa a chance de encontrar os diamantes abertos, com fator de 96% e arredondamento para baixo em duas casas. Recarregar a página mantém sua rodada.</p>`
  };
  openSheet(`Como jogar ${titles[id]}`, `${content[id]}<h3>Sobre os Bryams</h3><p>O prêmio exibido é o valor total devolvido, incluindo a aposta. Exemplo: 10 B com prêmio de 2× devolvem 20 B. Tudo é fictício e gratuito. Não há dinheiro real.</p><button class="button secondary" data-action="close">Entendi, vamos jogar</button>`);
}

function reducedMotion() { return state.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches; }
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let audio;
function sound(win) {
  if (!state.sound) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume().catch(() => {});
    (win ? [523, 659, 784] : [294, 247]).forEach((frequency, i) => {
      const oscillator = audio.createOscillator(), gain = audio.createGain(), time = audio.currentTime + i * .1;
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(.0001, time); gain.gain.exponentialRampToValueAtTime(.07, time + .01); gain.gain.exponentialRampToValueAtTime(.0001, time + .2);
      oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(time); oscillator.stop(time + .21);
    });
  } catch { /* Audio is optional on devices without Web Audio. */ }
}

async function play(id) {
  if (ui.busy) return;
  ui.busy = true;
  try {
    let outcome;
    if (id === 'mines') {
      if (state.round) {
        await commit(s => { const action = collectMines(s); outcome = action.result; return action.state; });
        ui.mineEnd = outcome; sound(true);
      } else {
        await commit(s => startMines(s, s.bet, ui.minesCount));
        ui.mineEnd = null;
      }
    } else {
      await commit(s => { const action = id === 'slots' ? spinSlots(s, s.bet) : spinDouble(s, s.bet, ui.doubleColor); outcome = action.result; return action.state; });
      render();
      if (id === 'double' && ui.route === 'double' && !reducedMotion()) {
        const track = $('#roulette-track');
        track.style.transition = 'none';
        track.style.transform = 'translateX(-29.5px)';
        track.getBoundingClientRect();
        track.style.transition = '';
        track.style.transform = `translateX(-${(wheelOrder.indexOf(outcome.number) + 30) * 66 + 29.5}px)`;
      }
      await delay(reducedMotion() ? 0 : id === 'double' ? 1700 : 1050);
      if (id === 'slots') { ui.slotLine = outcome.line; ui.slotResult = outcome; }
      else { ui.doubleResult = outcome; ui.doubleRecent.unshift(outcome); }
      sound(outcome.payout > 0);
    }
  } finally {
    ui.busy = false; render();
    if (ui.route === id) main.querySelector('[data-action="play"]')?.focus({ preventScroll: true });
  }
}

document.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const action = button.dataset.action;
  try {
    if (action === 'close') { sheet.close(); return; }
    if (action === 'wallet') { location.hash = 'carteira'; return; }
    if (action === 'rules') { showRules(button.dataset.game); return; }
    if (action === 'about') {
      openSheet('Bem-vindo ao club', `<p>O Tiger Club é um cassino de brincadeira feito para celular. Você começa com 1.000 Bryams e pode resgatar mais 500 por dia.</p><p>Os créditos não podem ser comprados, transferidos ou trocados por dinheiro. Não existem depósitos, saques ou prêmios reais.</p><h3>Seu progresso fica no seu aparelho</h3><p>Saldo, apelido, preferências e as últimas 50 rodadas ficam salvos neste navegador. Não há cadastro nem envio desses dados para um servidor. Limpar os dados do navegador apaga o progresso. Evite jogar em várias abas se o seu navegador não oferece sincronização de ações.</p><h3>Para jogar de leve</h3><p>Os resultados são aleatórios. Vitórias anteriores não mudam a próxima rodada. Faça uma pausa quando quiser: o club continua aqui.</p><button class="button secondary" data-action="close">Combinado</button>`); return;
    }
    if (action === 'bonus') {
      const claimed = state.lastBonus === localDay();
      openSheet('Um presente do Tiger Club', `<div class="bonus-visual"><span aria-hidden="true">🎁</span><strong>+${fmt(BONUS)}</strong><p>Bryams para seus próximos plays</p></div><p>${claimed ? 'Você já resgatou seu presente de hoje. Amanhã tem mais!' : 'Todo dia tem 500 créditos fictícios por aqui. É grátis e só por diversão.'}</p><button class="button" data-action="${claimed ? 'close' : 'claim'}">${claimed ? 'Até amanhã!' : 'Quero meus 500 Bryams'}</button>`); return;
    }
    if (action === 'reset-dialog') { openSheet('Começar uma nova história?', `<p>Seu saldo, histórico, apelido e preferências deste navegador serão apagados. Você começa de novo com 1.000 Bryams.${state.round ? ' A rodada de Minas em andamento também será encerrada.' : ''}</p><button class="button danger" data-action="reset">Sim, recomeçar do zero</button><button class="text-button" data-action="close">Continuar minha história</button>`); return; }
    if (ui.busy) { toast('Espere o resultado da rodada.'); return; }
    if (action === 'play') { await play(button.dataset.game); return; }
    if (action === 'filter') { ui.filter = button.dataset.filter; }
    if (action === 'color') ui.doubleColor = button.dataset.color;
    if (action === 'mine-count') { ui.minesCount = Number(button.dataset.count); ui.mineEnd = null; }
    if (action === 'bet') await commit(s => { if (s.round) throw new Error('Termine sua rodada de Minas primeiro.'); return { ...s, bet: Number(button.dataset.bet) }; });
    if (action === 'favorite') await commit(s => ({ ...s, favorites: s.favorites.includes(button.dataset.game) ? s.favorites.filter(id => id !== button.dataset.game) : [...s.favorites, button.dataset.game] }));
    if (action === 'sound') { await commit(s => ({ ...s, sound: !s.sound })); if (state.sound) sound(true); }
    if (action === 'motion') await commit(s => ({ ...s, reducedMotion: !s.reducedMotion }));
    if (action === 'claim') { await commit(s => claimBonus(s)); if (sheet.open) sheet.close(); toast('500 Bryams chegaram. Divirta-se!'); sound(true); }
    if (action === 'refill') { await commit(s => refill(s)); toast('Pronto! Mais 1.000 Bryams para brincar.'); }
    if (action === 'reveal') {
      let outcome;
      await commit(s => { const next = revealMine(s, Number(button.dataset.cell)); outcome = next.result; return next.state; });
      if (outcome.hit || outcome.complete) ui.mineEnd = outcome;
      sound(!outcome.hit);
    }
    if (action === 'reset') { await commit(() => createState()); ui.mineEnd = ui.slotResult = ui.doubleResult = null; ui.doubleRecent = []; ui.slotLine = [0, 4, 5]; if (sheet.open) sheet.close(); location.hash = 'inicio'; toast('Nova história, 1.000 Bryams. Bem-vindo de volta!'); }
    render();
  } catch (error) { toast(error.message || 'Algo não saiu como esperado. Tente de novo.'); }
});

document.addEventListener('submit', async event => {
  if (event.target.id !== 'name-form') return;
  event.preventDefault();
  const name = new FormData(event.target).get('nickname').trim().slice(0, 24);
  if (!name) { toast('Escreva um apelido para o club.'); return; }
  await commit(s => ({ ...s, name })); render(); toast('Apelido salvo. Agora o club é mais seu.');
});
sheet.addEventListener('click', event => { if (event.target === sheet && event.offsetY < 0) sheet.close(); });
window.addEventListener('hashchange', route);
window.addEventListener('storage', event => { if (event.key === STORAGE_KEY) { state = readState(); if (!ui.busy) render(); } });
route();
if (!storageAvailable) toast('O navegador não permite salvar. Seu progresso dura só nesta aba.');
