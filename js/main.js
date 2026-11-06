/* ============================================================
   main.js — wires input, sound and the engine together
   ============================================================ */

(function () {
  const game = createGame({
    onChange(reason) {
      if (reason === 'resolve') onResolve();
      else if (reason === 'award') onAward();
      UI.render();
    },
  });

  // settings are stored by the UI layer; sync the engine before play starts
  game.setManual(UI.getSettings().manual);

  const cardWord = n => n + (n === 1 ? ' card' : ' cards');

  /* ---- sounds & announcements after an action -------------- */
  function onResolve() {
    const r = game.state.result;
    if (!r) return;
    const loser = game.state.players[r.loserId];
    if (r.winnerId !== null) {
      SFX.win();
      UI.announce(game.state.players[r.winnerId].name + ' wins the game!');
    } else {
      SFX.take();
      const msg = r.count > 0
        ? loser.name + ' takes ' + cardWord(r.count)
        : loser.name + ' takes the pile';
      UI.announce(msg + '. ' + loser.name + ' starts with Taco.');
    }
  }

  /* ---- pile handed over via the award popup (manual or wrong word) ---- */
  function onAward() {
    const s = game.state;
    const r = s.result;
    if (s.phase === 'GAME_OVER' && s.winnerId !== null) {
      SFX.win();
      UI.announce(s.players[s.winnerId].name + ' wins the game!');
      return;
    }
    SFX.take();
    if (r) {
      if (r.reason === 'wrongword') {
        UI.announce(s.players[r.loserId].name + ' said the wrong word and takes ' +
          cardWord(r.count) + '.');
      } else {
        UI.announce(s.players[r.loserId].name + ' takes ' + cardWord(r.count) +
          ' and starts the next round with Taco.');
      }
    }
  }

  /* ---- one player button: flip / pass / slap / gesture ----- */
  function playerAction(id) {
    const s = game.state;
    if (s.phase === 'SETUP' || s.phase === 'GAME_OVER') return;

    // the physical reaction comes first, then the engine decides
    if (s.phase === 'SLAP' || s.phase === 'GESTURE') SFX.slap();

    const r = game.playerAction(id);
    if (!r || !r.ok) {
      // silent ignores: already reacted / nothing to slap / round is over
      const silent = r && (r.reason === 'already' || r.reason === 'busy' ||
                           r.reason === 'nothing-to-slap');
      if (!silent) SFX.deny();
      return;
    }
    if (r.outcome === 'flip') SFX.flip();
    else if (r.outcome === 'slap') SFX.windowOpen();
    else if (r.outcome === 'gesture') SFX.gestureOpen();
    else if (r.outcome === 'pass') SFX.click();

    UI.render();
  }

  /* ---- boot ------------------------------------------------ */
  UI.init(game, {
    onDeal(cfg) {
      const dealt = game.start(cfg);
      SFX.deal();
      const starter = game.state.players[game.state.currentPlayer];
      UI.announce('Dealt ' + dealt.perPlayer + ' cards each. ' +
        starter.name + ' starts with Taco.');
      UI.render();
    },

    onAction(id) { playerAction(id); },

    onSlapAt(x, y) {
      const s = game.state;
      if (s.manual) return;                 // slaps are settled offline
      const id = UI.nearestPlayer(x, y);
      if (id === null || id === undefined) return;
      SFX.slap();
      const r = game.respond(id);           // slap inside a window, flinch otherwise
      if (!r || !r.ok) {
        // nothing to slap = a quiet ignore; anything else deserves a buzz
        if (!(r && r.reason === 'nothing-to-slap')) SFX.deny();
      }
    },

    onManualChange(v) { game.setManual(v); },

    onAward(id, mode) {
      const r = game.award(id, mode);
      if (!r || !r.ok) SFX.deny();
      return r;
    },

    onNext() {
      if (game.state.phase === 'RESOLVED') {
        SFX.click();
        game.next();
      }
    },

    onRematch() {
      const cfg = {
        players: game.state.players.map(p => ({
          name: p.name, color: p.color, avatar: p.avatar,
        })),
        startPlayer: (game.state.winnerId !== null ? game.state.winnerId : 0),
      };
      game.start(cfg);
      SFX.deal();
      UI.render();
    },

    onReset() {
      game.reset();
      SFX.click();
      UI.render();
    },
  });

  // debug/testing handle (handy in the console)
  window.__game = game;
  window.__UI = UI;

  // unlock audio on the very first interaction
  document.addEventListener('pointerdown', () => SFX.unlock(), { once: true });
  document.addEventListener('keydown', () => SFX.unlock(), { once: true });
})();
