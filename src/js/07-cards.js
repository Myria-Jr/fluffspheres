// ───────────────────────── Card system (Exploding-Fluff deck) ─────────────────────────
const CARD_DEFS = {
  defuse: { name: 'Kraulen', emoji: '🤲', tone: 'mint', shape: 'cookie9', playable: false,
    desc: 'Entschärft eine Exploding-Fluff-Karte durch sanftes Kraulen. Wird automatisch eingesetzt – danach darfst du die Bombe zurück in den Stapel schmuggeln.' },
  bomb: { name: 'Exploding Fluff', emoji: '💥', tone: 'error', shape: 'burst', playable: false,
    desc: 'Ziehst du diese Karte ohne Kraulen, explodiert dein aktiver Fluffsphere mit 60 Schaden und einem riesigen Krater!' },
  skip: { name: 'Zug überspringen', emoji: '⏭️', tone: 'secondary', shape: 'cookie4', playable: true, nopeable: true,
    desc: 'Beendet deinen Zug sofort – und du musst keine Karte ziehen. Perfekt, wenn du eine Bombe oben vermutest.' },
  double: { name: 'Angriff verdoppeln', emoji: '⚔️', tone: 'tertiary', shape: 'sunny', playable: true, nopeable: true,
    desc: 'Alle Waffen verursachen in diesem Zug doppelten Schaden und haben 25 % größere Explosionen.' },
  future: { name: 'Zukunft sehen', emoji: '🔮', tone: 'primary', shape: 'flower', playable: true, nopeable: true,
    desc: 'Sieh dir heimlich die obersten 3 Karten des Nachziehstapels an.' },
  steal: { name: 'Karte klauen', emoji: '🦝', tone: 'secondary', shape: 'puffy', playable: true, nopeable: true, target: true,
    desc: 'Klaue eine zufällige Karte von einem Gegner deiner Wahl.' },
  nope: { name: 'Nope!', emoji: '🙅', tone: 'error', shape: 'cookie6', playable: false, reactive: true,
    desc: 'Blockiert die Aktionskarte eines anderen Spielers. Auch ein Nope kann genopet werden – Kettenreaktion!' },
  shuffle: { name: 'Mischen', emoji: '🌀', tone: 'primary', shape: 'cookie12', playable: true, nopeable: true,
    desc: 'Mischt den Nachziehstapel gründlich durch. Wo die Bomben jetzt wohl liegen?' },
  lure: { name: 'Schmetterlings-Lockstoff', emoji: '🦋', tone: 'tertiary', shape: 'clover', playable: true, nopeable: true,
    desc: 'Lockt einen magischen Schmetterling direkt zu deinem Fluffsphere – Chaos garantiert.' },
  aim: { name: 'Zielhilfe', emoji: '🎯', tone: 'primary', shape: 'circle', playable: true, nopeable: false,
    desc: 'Zeigt in diesem Zug die komplette glitzernde Flugbahn deiner Schüsse an.' },
  shield: { name: 'Kuschelschild', emoji: '🛡️', tone: 'mint', shape: 'cookie9', playable: true, nopeable: true,
    desc: 'Dein aktiver Fluffsphere erleidet bis zu deinem nächsten Zug nur halben Schaden.' },
};
const ACTION_POOL = { skip: 4, double: 4, future: 4, steal: 4, nope: 5, shuffle: 3, lure: 3, aim: 3, shield: 3 };

let _cardUid = 1;
const makeCard = (id) => ({ id, uid: _cardUid++ });

class Deck {
  constructor() { this.cards = []; this.discard = []; }

  setup(players) {
    const pool = [];
    for (const id in ACTION_POOL) for (let i = 0; i < ACTION_POOL[id]; i++) pool.push(makeCard(id));
    shuffle(pool);
    for (const p of players) {
      p.hand = [makeCard('defuse')];
      for (let i = 0; i < 4; i++) p.hand.push(pool.pop());
    }
    this.cards = pool;
    for (let i = 0; i < players.length - 1; i++) this.cards.push(makeCard('bomb'));
    for (let i = 0; i < 2; i++) this.cards.push(makeCard('defuse'));
    shuffle(this.cards);
  }

  get count() { return this.cards.length; }
  bombsLeft() { return this.cards.filter((c) => c.id === 'bomb').length; }

  draw(alivePlayers = 2) {
    if (!this.cards.length) this.refill(alivePlayers);
    return this.cards.pop();
  }

  refill(alivePlayers) {
    this.cards = shuffle(this.discard.filter((c) => c.id !== 'bomb'));
    this.discard = [];
    for (let i = 0; i < Math.max(1, alivePlayers - 1); i++) this.cards.push(makeCard('bomb'));
    while (this.cards.length < 8) this.cards.push(makeCard(pick(Object.keys(ACTION_POOL))));
    shuffle(this.cards);
  }

  peek(n = 3) { return this.cards.slice(-n).reverse(); }
  shuffle() { shuffle(this.cards); }

  // pos: 0 = top, 1 = bottom, 'random'
  insert(card, pos) {
    if (pos === 'top') this.cards.push(card);
    else if (pos === 'bottom') this.cards.unshift(card);
    else this.cards.splice(Math.floor(Math.random() * (this.cards.length + 1)), 0, card);
  }
}
