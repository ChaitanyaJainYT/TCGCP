/* ============================================================
   ui.js — rendering for setup, table, overlays
   ============================================================ */

const UI = (function () {
  const $ = sel => document.querySelector(sel);

  const COLORS = ['#ff5d8f', '#ff9f1c', '#4cc9f0', '#22c55e',
                  '#a78bfa', '#e879f9', '#facc15', '#38bdf8'];
  const AVATARS = ['🦊', '🐼', '🐸', '🐵', '🦁', '🐯', '🐙', '🦄'];

  const RING_C = 2 * Math.PI * 88;   // ring circumference (r=88)

  let game = null;
  let handlers = {};

  const setup = {
    count: 3,
    start: 0,
    players: Array.from({ length: 8 }, (_, i) => ({
      name: 'Player ' + (i + 1),
      avatar: i % AVATARS.length,
      color: i % COLORS.length,
    })),
  };

  let lastTopCardId = null;
  let confettiSpawnedFor = null;

  /* ------------------------------------------------------- settings */

  const SETTINGS_KEY = 'tcgcp.settings.v1';
  const DEFAULT_SETTINGS = { showHint: true, manual: true };
  let settings = loadSettings();

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) return Object.assign({}, DEFAULT_SETTINGS, JSON.parse(raw));
    } catch (e) { /* file:// or storage blocked — use defaults */ }
    return Object.assign({}, DEFAULT_SETTINGS);
  }

  function persistSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
    catch (e) { /* ignore */ }
  }

  function syncSwitches() {
    const hint = $('#toggle-hint');
    const manual = $('#toggle-manual');
    if (!hint || !manual) return;
    hint.classList.toggle('is-on', settings.showHint);
    hint.setAttribute('aria-checked', String(settings.showHint));
    manual.classList.toggle('is-on', settings.manual);
    manual.setAttribute('aria-checked', String(settings.manual));
    const note = $('#settings-note');
    if (note) {
      note.textContent = settings.manual
        ? 'Slaps are settled offline — use “Give centre cards…” to hand over the pile.'
        : 'Play waits until everyone has slapped / gestured — the last one to respond takes the pile.';
    }
  }

  function openSettings() { syncSwitches(); $('#settings-overlay').hidden = false; SFX.click(); }
  function closeSettings() { $('#settings-overlay').hidden = true; SFX.click(); }

  /* --------------------------------------------------- award popup */

  let awardKind = 'pile';   // 'pile' (manual slap) | 'wrongword' (penalty)

  function canAward() {
    const s = game.state;
    return settings.manual && s.center.length > 0 &&
      (s.phase === 'TURN' || s.phase === 'PAUSED');
  }

  // wrong-word penalty: available in BOTH modes while it's calm enough to act
  function canWrongWord() {
    const s = game.state;
    return s.center.length > 0 && (s.phase === 'TURN' || s.phase === 'PAUSED');
  }

  function openAward(kind) {
    awardKind = kind === 'wrongword' ? 'wrongword' : 'pile';
    const s = game.state;
    if (awardKind === 'wrongword' ? !canWrongWord() : !canAward()) return;
    const n = s.center.length;
    const tail = settings.showHint
      ? 'They restart with “Taco”.' : 'They start the next round.';
    if (awardKind === 'wrongword') {
      $('#award-title').textContent = '😬 Wrong word! Who said it?';
      $('#award-sub').textContent =
        (n === 1 ? 'The centre card goes' : 'All ' + n + ' centre cards go') +
        ' to the player who misspoke (bottom of their pile). ' + tail;
    } else {
      $('#award-title').textContent = '🏆 Give the centre pile';
      $('#award-sub').textContent =
        (n === 1 ? 'The centre card goes' : 'All ' + n + ' centre cards go') +
        ' to the chosen player (bottom of their pile). ' + tail;
    }
    $('#award-buttons').innerHTML = s.players.map(p =>
      '<button class="g-btn" data-award="' + p.id + '"' +
      (p.pile.length === 0 ? ' title="0 cards — wins if the pile goes to someone else"' : '') + '>' +
      p.avatar + ' ' + escapeHTML(p.name) +
      '<span class="award-count">' + p.pile.length + '</span></button>'
    ).join('');
    $('#award-overlay').hidden = false;
    SFX.click();
  }

  function closeAward() { $('#award-overlay').hidden = true; }

  function renderAwardButton() {
    const s = game.state;
    const showAward = canAward();
    const showWrong = canWrongWord();
    const award = $('#award-btn');
    const wrong = $('#wrongword-btn');
    $('#action-row').hidden = !(showAward || showWrong);

    award.hidden = !showAward;
    if (showAward) {
      award.textContent = '🏆 Give ' + s.center.length + ' centre card' +
        (s.center.length === 1 ? '' : 's') + ' to…';
    }
    wrong.hidden = !showWrong;
    if (showWrong) {
      wrong.textContent = '😬 Said the wrong word? Give the pile…';
    }
  }

  /* ---------------------------------------------------------- setup */

  function buildCountPicker() {
    const box = $('#count-picker');
    box.innerHTML = '';
    for (let n = 2; n <= 8; n++) {
      const b = document.createElement('button');
      b.className = 'chip' + (n === setup.count ? ' is-on' : '');
      b.textContent = n;
      b.addEventListener('click', () => {
        setup.count = n;
        if (setup.start >= n) setup.start = 0;
        buildCountPicker();
        buildPlayerList();
        buildStartSelect();
        updateDealInfo();
        SFX.click();
      });
      box.appendChild(b);
    }
  }

  function buildPlayerList() {
    const list = $('#player-list');
    list.innerHTML = '';
    for (let i = 0; i < setup.count; i++) {
      const p = setup.players[i];
      const row = document.createElement('div');
      row.className = 'player-row' + (i === setup.start ? ' is-start' : '');
      row.innerHTML =
        '<button class="p-swatch" title="Change colour" style="background:' + COLORS[p.color] + '"></button>' +
        '<button class="p-avatar" title="Change avatar">' + AVATARS[p.avatar] + '</button>' +
        '<input class="p-name" maxlength="14" value="" placeholder="Player ' + (i + 1) + '">' +
        '<span class="p-key">' + PLAYER_KEYS[i] + '</span>';
      const input = row.querySelector('.p-name');
      input.value = p.name;
      input.addEventListener('input', () => {
        setup.players[i].name = input.value;
        buildStartSelect();
      });
      row.querySelector('.p-swatch').addEventListener('click', () => {
        p.color = (p.color + 1) % COLORS.length;
        row.querySelector('.p-swatch').style.background = COLORS[p.color];
        SFX.click();
      });
      row.querySelector('.p-avatar').addEventListener('click', () => {
        p.avatar = (p.avatar + 1) % AVATARS.length;
        row.querySelector('.p-avatar').textContent = AVATARS[p.avatar];
        SFX.click();
      });
      list.appendChild(row);
    }
  }

  function buildStartSelect() {
    const sel = $('#start-select');
    const prev = setup.start;
    sel.innerHTML = '';
    for (let i = 0; i < setup.count; i++) {
      const o = document.createElement('option');
      o.value = String(i);
      const nm = (setup.players[i].name || '').trim() || ('Player ' + (i + 1));
      o.textContent = (i + 1) + ' — ' + nm + ' ' + AVATARS[setup.players[i].avatar];
      sel.appendChild(o);
    }
    setup.start = Math.min(prev, setup.count - 1);
    sel.value = String(setup.start);
    const rows = document.querySelectorAll('.player-row');
    rows.forEach((r, i) => r.classList.toggle('is-start', i === setup.start));
  }

  function updateDealInfo() {
    const per = cardsPerPlayer(setup.count);
    const left = 64 - per * setup.count;
    $('#deal-info').textContent =
      per + ' cards each · ' + (left > 0 ? left + ' cards go back in the box' : 'all 64 cards in play');
  }

  /* ---------------------------------------------------------- seats */

  function seatHTML(p, opts) {
    const n = p.pile.length;
    const isTurn = opts.isTurn;
    const isLoser = opts.isLoser;
    let pileHTML;
    if (n === 0) {
      pileHTML = '<div class="seat-empty-mark">0 cards<br>still in!</div>';
    } else {
      const backs = Math.min(3, n);
      let stack = '';
      for (let i = 0; i < backs; i++) stack += backHTML();
      pileHTML = stack + '<div class="pile-count">' + n + '</div>';
    }
    let hint;
    const wordLabel = WORD_META[opts.word] ? WORD_META[opts.word].label : opts.word;
    const say = opts.showHint ? 'say “' + wordLabel + '”' : 'say the word';
    if (opts.window && opts.responded) hint = '✓ done!';
    else if (opts.window) hint = opts.window === 'GESTURE' ? 'Do the gesture!' : 'Slap! 👋';
    else if (opts.paused) hint = opts.paused === 'special' ? 'Do the gesture!' : 'Slap! 👋';
    else if (isTurn && n === 0) hint = say;
    else if (isTurn) hint = 'flip & ' + say;
    else if (n === 0) hint = 'no cards';
    else if (opts.phase === 'RESOLVED') hint = 'round over';
    else if (opts.phase === 'GAME_OVER') hint = 'game over';
    else hint = 'waiting…';

    return '<div class="seat' +
      (isTurn ? ' is-turn' : '') +
      (isLoser ? ' is-loser' : '') +
      (n === 0 ? ' is-empty' : '') +
      '" data-player="' + p.id + '" style="--c:' + p.color + '">' +
      '<div class="seat-head">' +
        '<span class="seat-avatar">' + p.avatar + '</span>' +
        '<span class="seat-name">' + escapeHTML(p.name) + '</span>' +
        '<span class="seat-turn-tag">TURN</span>' +
      '</div>' +
      '<div class="seat-pile">' + pileHTML + '</div>' +
      '<div class="seat-foot">' +
        '<span class="seat-key">' + p.key + '</span>' +
        '<span class="seat-hint">' + hint + '</span>' +
      '</div>' +
    '</div>';
  }

  function backHTML() {
    return '<div class="card-back"><span class="back-logo">🌮</span></div>';
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function renderSeats() {
    const s = game.state;
    const n = s.players.length;
    const leftCount = Math.ceil(n / 2);
    const left = s.players.slice(0, leftCount);
    const right = s.players.slice(leftCount).reverse();
    const window_ = (s.phase === 'SLAP' || s.phase === 'GESTURE') ? s.phase : null;
    const responded = new Set(s.responses.map(r => r.id));

    const opts = {
      phase: s.phase,
      word: WORDS[s.wordIndex],
      window: window_,
      paused: s.phase === 'PAUSED' ? (s.pendingReason || 'match') : null,
      showHint: settings.showHint,
    };

    const html = list => list.map(p =>
      seatHTML(p, Object.assign({}, opts, {
        isTurn: s.phase === 'TURN' && p.id === s.currentPlayer,
        isLoser: s.phase === 'RESOLVED' && s.result && s.result.loserId === p.id,
        responded: window_ ? responded.has(p.id) : false,
      }))
    ).join('');

    $('#seats-left').innerHTML = html(left);
    $('#seats-right').innerHTML = html(right);
  }

  /* ---------------------------------------------------------- stage */

  function renderMantra() {
    const s = game.state;
    const nextIdx = (s.wordIndex + 1) % WORDS.length;
    $('#mantra').innerHTML = WORDS.map((w, i) =>
      '<span class="pill' +
      (i === s.wordIndex ? ' is-active' : (i === nextIdx ? ' is-next' : '')) +
      '" style="--hue:' + WORD_META[w].hue + '">' +
      '<span class="pill-dot"></span>' + WORD_META[w].label +
      '</span>'
    ).join('');
  }

  function renderSpoken() {
    const s = game.state;
    const el = $('#spoken');
    const word = WORDS[s.wordIndex];
    const who = s.lastFlipperId !== null && s.players[s.lastFlipperId]
      ? s.players[s.lastFlipperId].name : null;

    // action prompts always show; the sequence hint respects the settings toggle
    const action = s.phase === 'SLAP' || s.phase === 'GESTURE' || s.phase === 'PAUSED';
    el.hidden = !(settings.showHint || action);
    if (el.hidden) {
      el.innerHTML = '';
      el.classList.remove('is-hot');
      return;
    }

    let inner;
    if (s.phase === 'SLAP') {
      inner = '<span class="say">✋ MATCH! “' + WORD_META[word].label.toUpperCase() + '” — SLAP!</span>';
      el.classList.add('is-hot');
    } else if (s.phase === 'GESTURE') {
      inner = '<span class="say">⚡ SPECIAL CARD — everyone gesture!</span>';
      el.classList.add('is-hot');
    } else if (s.phase === 'PAUSED') {
      if (s.pendingReason === 'special') {
        const top = s.center[s.center.length - 1];
        const m = top ? SPECIAL_META[top.type] : null;
        inner = '<span class="say">⚡ SPECIAL — ' +
          (m ? m.emoji + ' ' + m.label.toUpperCase() : 'SPECIAL CARD') + '!</span>';
      } else {
        const w = WORD_META[s.lastSpoken || word].label.toUpperCase();
        inner = '<span class="say">✋ MATCH! “' + w + '” — SLAP!</span>';
      }
      el.classList.add('is-hot');
    } else if (s.lastSpoken) {
      inner = '<span class="say">' + (who ? escapeHTML(who) + ' said “' : '“') +
              WORD_META[s.lastSpoken].label + '!”</span>';
      el.classList.remove('is-hot');
    } else {
      inner = '<span class="say">Say the mantra: Taco → Cat → Goat → Cheese → Pizza…</span>';
      el.classList.remove('is-hot');
    }
    el.innerHTML = inner;
  }

  function cardFaceHTML(card) {
    const meta = ALL_CARD_META[card.type];
    const special = isSpecial(card.type);
    return '<div class="card' + (special ? ' is-special' : '') + '" style="--hue:' + meta.hue + '">' +
      '<div class="band"></div>' +
      (special ? '<div class="card-kind">SPECIAL</div>' : '') +
      '<div class="card-emoji">' + meta.emoji + '</div>' +
      '<div class="card-label">' + meta.label + '</div>' +
      '<div class="band bottom"></div>' +
    '</div>';
  }

  function hashRot(id) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 1000;
    return ((h % 140) - 70) / 10;   // -7deg .. 7deg
  }

  function renderPile() {
    const s = game.state;
    const pile = $('#center-pile');
    const zone = $('.pile-zone');

    zone.classList.toggle('is-window', s.phase === 'SLAP' || s.phase === 'GESTURE');
    zone.classList.toggle('is-gesture', s.phase === 'GESTURE');
    $('#ring-label').hidden = !(s.phase === 'SLAP' || s.phase === 'GESTURE');

    if (s.center.length === 0) {
      pile.innerHTML = '<div class="slop-zone">slap<br>zone</div>';
      lastTopCardId = null;
      return;
    }

    const shown = s.center.slice(-4);
    pile.innerHTML = shown.map((c, i) => {
      const isTop = i === shown.length - 1;
      return '<div class="pile-card' + (isTop ? ' is-top' : '') + '" style="--rot:' +
        hashRot(c.id).toFixed(2) + 'deg">' + cardFaceHTML(c) + '</div>';
    }).join('');

    const topId = shown[shown.length - 1].id;
    if (topId !== lastTopCardId) {
      const top = pile.querySelector('.pile-card.is-top');
      if (top) {
        top.classList.add('flip-in');
        if (s.phase === 'SLAP' || s.phase === 'GESTURE') {
          pile.classList.add('zone-shake');
          setTimeout(() => pile.classList.remove('zone-shake'), 400);
        }
      }
      lastTopCardId = topId;
    }
  }

  function statusAndBanner() {
    const s = game.state;
    const status = $('#status');
    const banner = $('#banner');
    const word = WORDS[s.wordIndex];

    banner.hidden = true;
    banner.className = 'banner';

    if (s.phase === 'TURN') {
      const p = s.players[s.currentPlayer];
      if (p.pile.length === 0) {
        status.innerHTML =
          '<span><b>' + escapeHTML(p.name) + '</b> has no cards — say ' +
          (settings.showHint
            ? '<b>“' + WORD_META[word].label + '!”</b>'
            : 'the next word') +
          ' to stay in</span>' +
          '<button class="pass-btn" data-act="pass">📢 ' +
          (settings.showHint ? 'Say “' + WORD_META[word].label + '!”' : 'Say the word') +
          '</button>';
      } else {
        status.innerHTML =
          '<span><b>' + escapeHTML(p.name) + '</b>, flip a card &amp; say ' +
          (settings.showHint
            ? '<b>“' + WORD_META[word].label + '!”</b>'
            : 'the next word') + '</span>';
      }
      return;
    }

    const waiting = s.players
      .filter(p => !s.responses.some(r => r.id === p.id))
      .map(p => p.name);
    const waitTxt = waiting.length
      ? ' <span class="wait-list">waiting for ' + escapeHTML(waiting.join(', ')) + '</span>'
      : '';

    if (s.phase === 'SLAP') {
      status.innerHTML = '<span class="status-hot">✋ MATCH! SLAP THE PILE! 👋</span>' + waitTxt;
      return;
    }

    if (s.phase === 'GESTURE') {
      status.innerHTML = '<span class="status-hot">⚡ Special card — do the gesture!</span>' + waitTxt;
      return;
    }

    if (s.phase === 'PAUSED') {
      const top = s.center[s.center.length - 1];
      if (s.pendingReason === 'special' && top && SPECIAL_META[top.type]) {
        const m = SPECIAL_META[top.type];
        status.innerHTML =
          '<span class="status-hot">⚡ <b>' + m.emoji + ' ' + m.label + '!</b> ' +
          m.gesture + ' — then give the pile to the last one</span>';
      } else {
        status.innerHTML =
          '<span class="status-hot">✋ MATCH! Slap it out — then give the pile to the last slapper 👋</span>';
      }
      return;
    }

    if (s.phase === 'RESOLVED' && s.result) {
      const r = s.result;
      const loser = s.players[r.loserId].name;
      const cards = r.count === 1 ? '1 card' : r.count + ' cards';
      let msg;
      if (r.reason === 'slap') {
        msg = '✋ <b>' + escapeHTML(loser) + '</b> was <b>LAST</b> to slap — takes ' + cards + '!';
      } else if (r.reason === 'gesture') {
        msg = '🦥 <b>' + escapeHTML(loser) + '</b> was last to react — takes ' + cards + '!';
      } else if (r.reason === 'flinch') {
        msg = '😬 <b>' + escapeHTML(loser) + '</b> flinched! Takes ' + cards + '!';
      } else {
        msg = '🐌 Too slow, nobody slapped — <b>' + escapeHTML(loser) + '</b> takes ' + cards + '!';
      }
      status.innerHTML =
        '<span>▶ <b>' + escapeHTML(loser) + '</b> picks up the pile' +
        (settings.showHint ? ' — starts again with “Taco”' : '') + '</span>';
      banner.hidden = false;
      banner.innerHTML = msg +
        '<span class="banner-sub">click to continue</span>';
      return;
    }

    if (s.phase === 'GAME_OVER') {
      const w = s.players[s.winnerId];
      status.innerHTML = '<span>🏆 <b>' + escapeHTML(w.name) + '</b> wins the game!</span>';
      return;
    }

    status.innerHTML = '<span>…</span>';
  }

  /* ---------------------------------------------------------- overlays */

  function renderGestureOverlay() {
    const s = game.state;
    const overlay = $('#gesture-overlay');
    const show = s.phase === 'GESTURE';
    overlay.hidden = !show;
    if (!show) return;

    const card = s.center[s.center.length - 1];
    const meta = card ? SPECIAL_META[card.type] : null;
    if (!meta) return;

    $('#gesture-emoji').textContent = meta.emoji;
    $('#gesture-name').textContent = meta.label;
    $('#gesture-text').textContent = meta.gesture;

    const responded = new Map();
    s.responses.forEach((r, i) => responded.set(r.id, i + 1));

    $('#gesture-buttons').innerHTML = s.players.map(p => {
      const ord = responded.get(p.id);
      return '<button class="g-btn' + (ord ? ' is-done' : '') + '" data-p="' + p.id + '"' +
        (ord ? ' disabled' : '') + '>' +
        p.avatar + ' ' + escapeHTML(p.name) +
        '<span class="g-order">' + (ord || '✓') + '</span></button>';
    }).join('');
  }

  function spawnConfetti() {
    const box = $('#confetti');
    const colors = ['#ff5d8f', '#ffd93d', '#4cc9f0', '#22c55e', '#a78bfa', '#ff9f1c', '#e879f9'];
    const emojis = ['🌮', '🐱', '🐐', '🧀', '🍕', '⭐', '🎉'];
    let html = '';
    for (let i = 0; i < 90; i++) {
      const c = colors[i % colors.length];
      const useEmoji = i % 6 === 0;
      const left = Math.random() * 100;
      const dur = 2.2 + Math.random() * 2.2;
      const delay = Math.random() * 1.4;
      const size = useEmoji ? 20 : 10 + Math.random() * 8;
      html += useEmoji
        ? '<i style="left:' + left + '%;background:transparent;font-size:' + size +
          'px;animation-duration:' + dur + 's;animation-delay:' + delay + 's">' +
          emojis[i % emojis.length] + '</i>'
        : '<i style="left:' + left + '%;background:' + c +
          ';animation-duration:' + dur + 's;animation-delay:' + delay + 's"></i>';
    }
    box.innerHTML = html;
  }

  function renderWinnerOverlay() {
    const s = game.state;
    const overlay = $('#winner-overlay');
    const show = s.phase === 'GAME_OVER';
    overlay.hidden = !show;
    if (!show) { confettiSpawnedFor = null; return; }

    const w = s.players[s.winnerId];
    $('#winner-avatar').textContent = w.avatar;
    $('#winner-name').textContent = w.name + ' wins!';
    $('#winner-name').style.color = w.color;

    if (confettiSpawnedFor !== s.winnerId + ':' + s.round) {
      confettiSpawnedFor = s.winnerId + ':' + s.round;
      spawnConfetti();
    }
  }

  /* ---------------------------------------------------------- ring */

  function tick() {
    if (game) {
      const s = game.state;
      if (s.phase === 'SLAP' || s.phase === 'GESTURE') {
        // no countdown — the ring/bar fills as players respond
        const total = s.players.length || 1;
        const frac = Math.min(1, s.responses.length / total);
        const fg = document.querySelector('.ring-fg');
        if (fg) fg.style.strokeDashoffset = String(RING_C * (1 - frac));
        const label = $('#ring-label');
        if (label) label.textContent = (total - s.responses.length) + ' left';
        const bar = $('#gesture-bar');
        if (bar) bar.style.width = (frac * 100) + '%';
      }
    }
    requestAnimationFrame(tick);
  }

  /* ---------------------------------------------------------- render */

  function render() {
    const s = game.state;
    const onSetup = s.phase === 'SETUP';

    $('#setup-screen').hidden = !onSetup;
    $('#table-screen').hidden = onSetup;

    if (onSetup) {
      $('#gesture-overlay').hidden = true;
      $('#winner-overlay').hidden = true;
      return;
    }

    // word-hint toggle: hide the mantra strip when switched off
    $('#mantra').hidden = !settings.showHint;
    if (settings.showHint) renderMantra();

    renderSpoken();
    renderSeats();
    renderPile();
    statusAndBanner();
    renderAwardButton();
    renderGestureOverlay();
    renderWinnerOverlay();
  }

  /* ---------------------------------------------------------- events */

  function bind() {
    $('#deal-btn').addEventListener('click', () => {
      const players = setup.players.slice(0, setup.count).map(p => ({
        name: (p.name || '').trim() || 'Player',
        color: COLORS[p.color],
        avatar: AVATARS[p.avatar],
      }));
      handlers.onDeal({ players, startPlayer: setup.start });
    });

    $('#start-select').addEventListener('change', e => {
      setup.start = parseInt(e.target.value, 10) || 0;
      buildPlayerList();
      buildStartSelect();
    });

    // rules modal
    $('#rules-btn').addEventListener('click', openRules);
    $('#rules-btn-2').addEventListener('click', openRules);
    $('#rules-close').addEventListener('click', closeRules);

    // settings modal
    $('#settings-btn').addEventListener('click', openSettings);
    $('#settings-btn-2').addEventListener('click', openSettings);
    $('#settings-close').addEventListener('click', closeSettings);
    $('#settings-overlay').addEventListener('click', e => {
      if (e.target === $('#settings-overlay')) closeSettings();
    });

    $('#toggle-hint').addEventListener('click', () => {
      settings.showHint = !settings.showHint;
      persistSettings();
      syncSwitches();
      SFX.click();
      render();
    });

    $('#toggle-manual').addEventListener('click', () => {
      settings.manual = !settings.manual;
      persistSettings();
      syncSwitches();
      SFX.click();
      if (handlers.onManualChange) handlers.onManualChange(settings.manual);
      render();
    });

    // award the centre pile: manual slap/gesture (manual mode) or wrong-word penalty
    $('#award-btn').addEventListener('click', () => openAward('pile'));
    $('#wrongword-btn').addEventListener('click', () => openAward('wrongword'));
    $('#award-cancel').addEventListener('click', closeAward);
    $('#award-overlay').addEventListener('click', e => {
      if (e.target === $('#award-overlay')) closeAward();
    });
    $('#award-buttons').addEventListener('click', e => {
      const btn = e.target.closest('[data-award]');
      if (!btn) return;
      const r = handlers.onAward(parseInt(btn.dataset.award, 10),
        awardKind === 'wrongword' ? 'wrongword' : 'award');
      if (r && r.ok) closeAward();
      else SFX.deny();
    });

    // mute
    $('#mute-btn').addEventListener('click', () => {
      const muted = SFX.isMuted() ? false : true;
      SFX.setMuted(muted);
      $('#mute-btn').textContent = muted ? '🔇' : '🔊';
      if (!muted) SFX.click();
    });

    // quit
    $('#quit-btn').addEventListener('click', () => {
      if (window.confirm('Start a new game? Current game will be lost.')) {
        handlers.onReset();
      }
    });

    // slap by clicking the centre pile — credited to the nearest seat
    const pile = $('#center-pile');
    pile.addEventListener('pointerdown', e => {
      e.preventDefault();
      handlers.onSlapAt(e.clientX, e.clientY);
    });

    // banner click skips the wait
    $('#banner').addEventListener('click', () => handlers.onNext());

    // status pass button
    $('#status').addEventListener('click', e => {
      const btn = e.target.closest('[data-act="pass"]');
      if (btn) handlers.onAction(game.state.currentPlayer);
    });

    // gesture confirm buttons
    $('#gesture-buttons').addEventListener('click', e => {
      const btn = e.target.closest('[data-p]');
      if (btn && !btn.disabled) handlers.onAction(parseInt(btn.dataset.p, 10));
    });

    // seats are tappable: flip / slap / confirm
    document.addEventListener('click', e => {
      const seat = e.target.closest('.seat');
      if (seat) handlers.onAction(parseInt(seat.dataset.player, 10));
    });

    // winner overlay buttons
    $('#rematch-btn').addEventListener('click', () => handlers.onRematch());
    $('#newgame-btn').addEventListener('click', () => handlers.onReset());

    // keyboard
    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (!$('#settings-overlay').hidden) {
        if (e.key === 'Escape') closeSettings();
        return;
      }
      if (!$('#award-overlay').hidden) {
        if (e.key === 'Escape') closeAward();
        return;
      }
      if (!$('#rules-overlay').hidden) {
        if (e.key === 'Escape') closeRules();
        return;
      }
      if (typing) return;

      const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      const idx = PLAYER_KEYS.indexOf(key);
      const phase = game.state.phase;
      if (idx >= 0 && idx < game.state.players.length &&
          phase !== 'SETUP' && phase !== 'GAME_OVER') {
        e.preventDefault();
        handlers.onAction(idx);
        return;
      }
      if ((e.key === ' ' || e.key === 'Enter') && phase === 'RESOLVED') {
        e.preventDefault();
        handlers.onNext();
      }
    });
  }

  function nearestPlayer(x, y) {
    const seats = document.querySelectorAll('.seat[data-player]');
    let best = null, bestD = Infinity;
    seats.forEach(el => {
      const r = el.getBoundingClientRect();
      const dx = x - (r.left + r.width / 2);
      const dy = y - (r.top + r.height / 2);
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = parseInt(el.dataset.player, 10); }
    });
    return best;
  }

  function openRules() { $('#rules-overlay').hidden = false; }
  function closeRules() { $('#rules-overlay').hidden = true; }

  function announce(text) {
    $('#live-region').textContent = text;
  }

  function init(g, h) {
    game = g;
    handlers = h || {};
    buildCountPicker();
    buildPlayerList();
    buildStartSelect();
    updateDealInfo();
    bind();
    render();
    requestAnimationFrame(tick);
  }

  return {
    init, render, announce, openRules, closeRules, nearestPlayer,
    getSettings() { return settings; },
  };
})();
