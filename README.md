# 🌮🐱🐐🧀🍕 Taco Cat Goat Cheese Pizza

A colourful, single-device party card game for **2–8 players** — pure HTML/CSS/JS, no build step, no server, no dependencies.

## ▶️ Run it

**Just double-click `index.html`.** That's it.

> The game uses no `fetch`, no ES modules and no external assets, so it works fine from `file://`. (A local server is only ever needed if you want to test it over HTTP yourself: `python -m http.server 8765`.)

## 🎮 Controls

| Input | Action |
|---|---|
| **A S D F J K L ;** | Player 1–8's key — flips on their turn, slaps during a match, confirms gestures |
| **Click / tap a seat** | Same as that player's key |
| **Click the centre pile** | Slap — credited to the nearest seat (mouse/touch players). Outside a slap window it's a **flinch** (you take the pile). Ignored in manual mode. |
| **Space / Enter** | Skip the round-result banner |
| **🏆 Give centre cards to…** | Manual mode: award the whole centre pile to a chosen player (opens a pop-up) |
| **😬 Said the wrong word? Give the pile…** | Penalty for mis-saying the mantra (both modes): pick who said it — they take the centre pile |
| **⚙️ 🔊 📜 ⟲** | Settings · mute · rules · new game (bottom-right of the table) |

## ⚙️ Settings

Two toggles on the setup screen (⚙️ **Settings**) and on the table (⚙️ icon). Both are remembered in `localStorage`.

| Setting | ON (default) | OFF |
|---|---|---|
| **Word hint** | The mantra strip (Taco → Cat → …), the spoken-word line and prompts like *“say **Taco!**”* are shown | Sequence is hidden — statuses just say *“say the next word”*; you track the mantra yourselves |
| **Manual pile resolution** | No timers: slaps & gestures are settled **offline** by the group, then you press **🏆 Give centre cards…** and pick who takes the pile from the pop-up | Play **waits until every player** has slapped / confirmed the gesture (a ring shows how many are left) — the last one to respond takes the pile |

## 📜 Rules implemented

- **Deck:** 64 cards — 11× Taco/Cat/Goat/Cheese/Pizza, 3× Gorilla/Groundhog/Narwhal.
- **Deal:** 12 each for 2–5 players, 10 each for 6, 8 each for 7–8 (leftovers go back in the box).
- **Mantra:** players flip their top card and say the next word in the Taco → Cat → Goat → Cheese → Pizza loop.
- **Match:** if the card matches the word just said, everyone slaps — the **last** slapper takes the whole pile (to the *bottom* of their pile) and restarts the round with "Taco".
- **Special cards:** Gorilla 🦍 (beat your chest), Groundhog 🦫 (knock the table), Narwhal 🦄 (hands up like a horn) — everyone does the gesture; last to confirm takes the pile.
- **Flinch:** slapping when there's nothing to slap means you take the pile.
- **Wrong word:** whoever mis-says the mantra takes the centre pile — press **😬 Said the wrong word?** and pick them (works in both modes; same zero-card win rule as a manual award).
- **Empty pile:** a player with 0 cards still takes their turn and says the word — they stay in until they win.
- **Win:** have **0 cards** *and* be among the players who correctly slap/react (earliest response wins ties).
- **Manual mode:** the group decides slaps/gestures offline; whoever is awarded the pile takes it (bottom of their pile) and restarts the round. A player already at **0 cards wins** if the pile is given to somebody else; if it's given *to* them, they're back in the game.

## ⏱️ Adaptations for digital play

**Manual mode** (default) removes all interaction during slaps: the group settles them offline and uses the **🏆 Give centre cards…** button. The table below applies when the **Manual pile resolution** toggle is OFF — there are **no countdowns**, only an "everyone respond" wait:

| Situation | Behaviour |
|---|---|
| Match / special-card window | Stays open **until every player has responded** — a ring counts down the players left ("2 left"), and seats show ✓ once they're in |
| Who takes the pile | The **last** player to respond (slap / gesture confirm) |
| Nobody has responded yet | The window waits as long as it takes — no "too slow" penalty |
| Result banner | Auto-continues after **1.8 s**, or click / Space to continue immediately |
| Slap credited to mouse input | Nearest seat to the click |

## 🗂️ Files

```
index.html        markup (setup, table, overlays)
css/style.css     all styling, animations, responsive layout (≤900px / ≤560px)
js/cards.js       deck build, shuffle, deal
js/audio.js       Web Audio sound effects (no asset files)
js/game.js        rules state machine
js/ui.js          rendering
js/main.js        input + sound wiring (exposes window.__game for debugging)
```

## ✅ Tested

- Headless rules simulation: deck composition, deal counts for 2–8 players, 40 full random games (wait-for-all mode) and 15 full games (manual mode) with winner validation and card conservation, match/special/flinch/empty-pile paths, "wait until everyone responds → last one takes it", wrong-word penalty (both modes, incl. game-deciding) and manual-pause → award → restart checks.
- Browser play-through: setup → settings toggles (persisted) → deal → keyboard flips → slap windows that stay open until all 4 respond → wrong-word pop-up → manual award pop-up → both buttons side by side → hint-off display → pile-click flinch → win overlay, on desktop and a 430×932 mobile viewport, with no console errors.
