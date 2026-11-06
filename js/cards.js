/* ============================================================
   cards.js — the 64-card deck, shuffle and deal
   Official composition:
     11x Taco, Cat, Goat, Cheese, Pizza   (55 word cards)
      3x Gorilla, Groundhog, Narwhal      (9 special cards)
   Deal: 12 each (2-5 players), 10 each (6), 8 each (7-8)
   ============================================================ */

const WORDS = ['taco', 'cat', 'goat', 'cheese', 'pizza'];

const WORD_META = {
  taco:    { label: 'Taco',    emoji: '🌮', hue: '#ff9f1c' },
  cat:     { label: 'Cat',     emoji: '🐱', hue: '#a78bfa' },
  goat:    { label: 'Goat',    emoji: '🐐', hue: '#22c55e' },
  cheese:  { label: 'Cheese',  emoji: '🧀', hue: '#facc15' },
  pizza:   { label: 'Pizza',   emoji: '🍕', hue: '#ef4444' },
};

const SPECIAL_META = {
  gorilla:   { label: 'Gorilla',   emoji: '🦍', hue: '#fb923c',
               gesture: 'Beat your chest with both hands!' },
  groundhog: { label: 'Groundhog', emoji: '🦫', hue: '#b45309',
               gesture: 'Knock both hands on the table!' },
  narwhal:   { label: 'Narwhal',   emoji: '🦄', hue: '#38bdf8',
               gesture: 'Put your hands above your head like a horn!' },
};

const SPECIAL_KEYS = Object.keys(SPECIAL_META);

/* every card type in one lookup */
const ALL_CARD_META = Object.assign({}, WORD_META, SPECIAL_META);

function isSpecial(type) { return Object.prototype.hasOwnProperty.call(SPECIAL_META, type); }

/* Build a fresh 64-card deck */
function buildDeck() {
  const deck = [];
  let id = 0;
  WORDS.forEach(w => {
    for (let i = 0; i < 11; i++) deck.push({ id: 'c' + (id++), type: w });
  });
  SPECIAL_KEYS.forEach(s => {
    for (let i = 0; i < 3; i++) deck.push({ id: 'c' + (id++), type: s });
  });
  return deck;
}

/* Fisher-Yates shuffle (returns a new array) */
function shuffleDeck(deck) {
  const a = deck.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function cardsPerPlayer(playerCount) {
  if (playerCount <= 5) return 12;
  if (playerCount === 6) return 10;
  return 8; // 7 or 8 players
}

/* Round-robin deal; leftover cards go "back in the box" */
function dealHands(playerCount) {
  const per = cardsPerPlayer(playerCount);
  const deck = shuffleDeck(buildDeck());
  const hands = [];
  for (let p = 0; p < playerCount; p++) hands.push([]);
  for (let n = 0; n < per; n++) {
    for (let p = 0; p < playerCount; p++) hands[p].push(deck.pop());
  }
  return { hands, perPlayer: per, leftover: deck.length };
}
