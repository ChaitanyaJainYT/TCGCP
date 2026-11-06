/* ============================================================
   game.js — authoritative game state machine for
   Taco Cat Goat Cheese Pizza (single-device multiplayer)
   ============================================================ */

const GAME_CFG = {
  // there are NO slap/gesture countdowns: a match or special card waits until
  // every player has responded, then the last responder takes the pile
  RESOLVED_MS: 1800,  // auto-continue after the result banner
};

const PLAYER_KEYS = ['A', 'S', 'D', 'F', 'J', 'K', 'L', ';'];

function createGame(hooks) {
  hooks = hooks || {};

  const state = {
    phase: 'SETUP',        // SETUP | TURN | SLAP | GESTURE | PAUSED | RESOLVED | GAME_OVER
    players: [],           // {id,name,color,avatar,key,pile:[],emptySeq}
    center: [],            // cards in the middle pile (face up)
    wordIndex: 0,          // 0..4 -> taco..pizza
    currentPlayer: 0,
    lastSpoken: null,      // word last said out loud
    lastFlipperId: null,   // who revealed the top centre card
    responses: [],         // [{id, t}] inside the current window
    windowEndsAt: 0,       // unused deadline (kept for compatibility)
    windowMs: 0,           // 0 = no countdown: wait for every player
    result: null,          // {loserId, reason, count, winnerId, order}
    winnerId: null,
    round: 1,
    manual: false,         // true = slaps settled offline + "give pile" button
    pendingReason: null,   // manual pause: 'match' | 'special'
  };

  let winTimer = null;     // (no window timer any more — kept for clearing)
  let nextTimer = null;
  let emptyCounter = 0;    // sequence of players reaching 0 cards

  function clearTimers() {
    if (winTimer) { clearTimeout(winTimer); winTimer = null; }
    if (nextTimer) { clearTimeout(nextTimer); nextTimer = null; }
  }

  function changed(reason) {
    if (hooks.onChange) hooks.onChange(reason);
  }

  function spokenWord() { return WORDS[state.wordIndex]; }

  function advanceTurn() {
    state.wordIndex = (state.wordIndex + 1) % WORDS.length;
    state.currentPlayer = (state.currentPlayer + 1) % state.players.length;
  }

  function openWindow(kind) {
    state.phase = kind;                       // 'SLAP' | 'GESTURE'
    state.windowMs = 0;                       // no deadline
    state.windowEndsAt = 0;
    state.responses = [];
    if (winTimer) { clearTimeout(winTimer); winTimer = null; }
    // the window closes by itself as soon as every player has responded
  }

  function resolve(forced) {
    forced = forced || {};
    if (winTimer) { clearTimeout(winTimer); winTimer = null; }

    let loserId, reason;
    if (forced.reason === 'flinch') {
      loserId = forced.loserId;
      reason = 'flinch';
    } else if (state.responses.length === 0) {
      // safety net only — without a timer this needs an external push
      loserId = state.lastFlipperId;
      reason = 'tooslow';
    } else {
      let last = state.responses[0];
      for (const r of state.responses) if (r.t >= last.t) last = r;
      loserId = last.id;
      reason = state.phase === 'GESTURE' ? 'gesture' : 'slap';
    }

    const count = state.center.length;
    const order = state.responses.slice().sort((a, b) => a.t - b.t).map(r => r.id);

    // loser takes the whole centre pile, to the bottom of their pile
    // (index 0 = bottom, last index = top, which is what pop() draws from)
    if (count > 0) {
      const loser = state.players[loserId];
      loser.pile = state.center.concat(loser.pile);
      state.center = [];
    }

    // winner: zero cards + correctly reacted + didn't take the pile
    let winnerId = null;
    if (reason !== 'flinch' && state.responses.length > 0) {
      const cands = state.responses.filter(
        r => r.id !== loserId && state.players[r.id].pile.length === 0
      );
      if (cands.length > 0) {
        cands.sort((a, b) => a.t - b.t);
        winnerId = cands[0].id;
      }
    }

    state.result = { loserId, reason, count, winnerId, order };
    state.responses = [];

    if (winnerId !== null) {
      state.phase = 'GAME_OVER';
      state.winnerId = winnerId;
    } else {
      state.phase = 'RESOLVED';
      if (nextTimer) clearTimeout(nextTimer);
      nextTimer = setTimeout(() => {
        nextTimer = null;
        if (state.phase === 'RESOLVED') api.next();
      }, GAME_CFG.RESOLVED_MS);
    }

    changed('resolve');
    return { ok: true, outcome: 'resolved', result: state.result };
  }

  const api = {
    get state() { return state; },
    spokenWord,
    cfg: GAME_CFG,

    start(config) {
      clearTimers();
      const count = config.players.length;
      const dealt = dealHands(count);
      state.players = config.players.map((p, i) => ({
        id: i,
        name: p.name,
        color: p.color,
        avatar: p.avatar,
        key: PLAYER_KEYS[i],
        pile: dealt.hands[i].slice(),
        emptySeq: null,
      }));
      state.center = [];
      state.wordIndex = 0;
      state.currentPlayer = Math.min(config.startPlayer || 0, count - 1);
      state.lastSpoken = null;
      state.lastFlipperId = null;
      state.responses = [];
      state.windowEndsAt = 0;
      state.windowMs = 0;
      state.result = null;
      state.winnerId = null;
      state.round = 1;
      state.pendingReason = null;
      emptyCounter = 0;
      state.phase = 'TURN';
      changed('start');
      return dealt;
    },

    /* One button per player: flip, pass, slap or confirm the gesture */
    playerAction(id) {
      if (state.phase === 'TURN') {
        const p = state.players[id];
        if (!p || id !== state.currentPlayer) return { ok: false, reason: 'not-your-turn' };
        if (p.pile.length === 0) return api.pass(id);
        return api.flip(id);
      }
      if (state.phase === 'SLAP' || state.phase === 'GESTURE') return api.respond(id);
      return { ok: false, reason: 'busy' };
    },

    flip(id) {
      if (state.phase !== 'TURN' || id !== state.currentPlayer) return { ok: false, reason: 'not-your-turn' };
      const player = state.players[id];
      if (!player || player.pile.length === 0) return { ok: false, reason: 'empty' };

      const card = player.pile.pop();
      state.center.push(card);
      state.lastFlipperId = id;
      state.lastSpoken = spokenWord();
      if (player.pile.length === 0 && player.emptySeq == null) {
        player.emptySeq = ++emptyCounter;     // remember who emptied first
      }

      let outcome = 'advance';
      if (card.type === state.lastSpoken) {
        if (state.manual) {
          state.phase = 'PAUSED';             // settle the slap offline
          state.pendingReason = 'match';
          outcome = 'pause';
        } else {
          openWindow('SLAP');
          outcome = 'slap';
        }
      } else if (isSpecial(card.type)) {
        if (state.manual) {
          state.phase = 'PAUSED';
          state.pendingReason = 'special';
          outcome = 'pause';
        } else {
          openWindow('GESTURE');
          outcome = 'gesture';
        }
      } else {
        advanceTurn();
      }

      changed('flip');
      return { ok: true, outcome, card, spoken: state.lastSpoken, playerId: id };
    },

    pass(id) {
      if (state.phase !== 'TURN' || id !== state.currentPlayer) return { ok: false, reason: 'not-your-turn' };
      state.lastSpoken = spokenWord();
      const spoken = state.lastSpoken;
      advanceTurn();
      changed('pass');
      return { ok: true, outcome: 'pass', spoken, playerId: id };
    },

    respond(id) {
      if (state.phase === 'SLAP' || state.phase === 'GESTURE') {
        if (state.responses.some(r => r.id === id)) return { ok: false, reason: 'already' };
        state.responses.push({ id, t: performance.now() });
        const allIn = state.responses.length >= state.players.length;
        if (allIn) resolve();
        else changed('respond');
        return {
          ok: true,
          outcome: 'respond',
          remaining: state.players.length - state.responses.length,
        };
      }
      if (state.phase === 'TURN') {
        // flinching: slapping when there's nothing to slap for
        if (state.center.length === 0) return { ok: false, reason: 'nothing-to-slap' };
        return resolve({ reason: 'flinch', loserId: id });
      }
      return { ok: false, reason: 'busy' };
    },

    next() {
      if (state.phase !== 'RESOLVED') return { ok: false, reason: 'not-resolved' };
      if (nextTimer) { clearTimeout(nextTimer); nextTimer = null; }
      const loserId = state.result ? state.result.loserId : 0;
      state.wordIndex = 0;                    // loser restarts with "Taco"
      state.currentPlayer = loserId;
      state.lastSpoken = null;
      state.lastFlipperId = null;
      state.result = null;
      state.round += 1;
      state.phase = 'TURN';
      changed('next');
      return { ok: true };
    },

    /* settings: toggle between timed windows and manual pile awards */
    setManual(v) {
      state.manual = !!v;
      // leaving manual mode while a pause is open: resume normal play
      if (!state.manual && state.phase === 'PAUSED') {
        state.phase = 'TURN';
        state.pendingReason = null;
        changed('resume');
      }
      return state.manual;
    },

    /* Hand the whole centre pile to a chosen player.
       The pile goes to the bottom of their pile and they restart with "Taco".
         mode 'award'     — manual pile resolution (slap/gesture settled offline)
         mode 'wrongword' — penalty for saying the wrong word (any mode)
       If some OTHER player is already at zero cards, that player wins. */
    award(id, mode) {
      const wrongword = mode === 'wrongword';
      if (!wrongword && !state.manual) return { ok: false, reason: 'not-manual' };
      if (state.phase !== 'TURN' && state.phase !== 'PAUSED') {
        return { ok: false, reason: 'unavailable' };
      }
      if (state.center.length === 0) return { ok: false, reason: 'empty-centre' };
      const p = state.players[id];
      if (!p) return { ok: false, reason: 'no-player' };

      const count = state.center.length;
      p.pile = state.center.concat(p.pile);   // bottom of their pile
      p.emptySeq = null;                      // back in the game
      state.center = [];
      state.pendingReason = null;
      state.lastFlipperId = null;

      // anyone else who is already at zero cards wins the game
      const cands = state.players
        .filter(x => x.id !== id && x.pile.length === 0)
        .sort((a, b) => (a.emptySeq == null ? 1e9 : a.emptySeq) -
                        (b.emptySeq == null ? 1e9 : b.emptySeq));

      if (cands.length > 0) {
        state.winnerId = cands[0].id;
        state.phase = 'GAME_OVER';
      } else {
        state.wordIndex = 0;                  // chosen player restarts with "Taco"
        state.currentPlayer = id;
        state.lastSpoken = null;
        state.round += 1;
        state.phase = 'TURN';
      }
      state.result = {
        loserId: id, reason: wrongword ? 'wrongword' : 'award', count,
        winnerId: state.winnerId, order: [],
      };
      changed('award');
      return {
        ok: true, outcome: wrongword ? 'wrongword' : 'award', count,
        winnerId: state.phase === 'GAME_OVER' ? state.winnerId : null,
      };
    },

    reset() {
      clearTimers();
      state.phase = 'SETUP';
      state.players = [];
      state.center = [];
      state.result = null;
      state.winnerId = null;
      state.pendingReason = null;
      changed('reset');
    },
  };

  return api;
}
