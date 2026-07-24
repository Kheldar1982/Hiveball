// Offline-Selbstspiel-Tuning für die KI-persönlichkeiten in opponents.js
// (Slice C, siehe hiveball.html computeAiPlan/redPersonality).
//
// EHRLICHER HINWEIS ZUM ANSATZ: aiTurn()/computeAiPlan() leben tief in der
// DOM-gekoppelten hiveball.html (Canvas, document.getElementById, Buttons
// überall). Sie headless lauffähig zu machen würde eine große Entkopplung
// des Kernspiel-Regelkerns erfordern - genau der Schritt, den die
// Architektur-Leitlinie dieses Projekts bewusst zurückstellt, bis echter
// Multiplayer ihn nötig macht (siehe CLAUDE.md/Projektnotizen). Statt das
// Kernspiel dafür anzufassen, simuliert dieses Skript ein separates,
// deutlich vereinfachtes Ballbesitz-Modell: es repliziert NICHT die exakte
// Feldgeometrie/Pfadsuche, sondern dieselben Entwurfsziele der fünf
// personality-Parameter (Ballsicherheit, Markierung, Risiko, Käfig-Schutz -
// siehe opponents.js personality-Kommentar). Ergebnis: ein Werkzeug, um die
// von Hand gesetzten Team-Persönlichkeiten gegeneinander zu kalibrieren,
// kein bit-genauer Nachbau des echten Matches.
//
// Team-STÄRKE (rateRoster/rateOpponent) kommt echt aus league.js/opponents.js
// - nur das Ballbesitz-Modell selbst ist die Vereinfachung.
//
// Nutzung: node scripts/tune-ai-personalities.mjs
// Schreibt NICHTS automatisch in opponents.js - gibt eine Vorschau-Tabelle
// (alt/neu je Team) aus, damit die Werte vor einer Übernahme geprüft werden
// können.

// Minimaler localStorage-Shim: league.js -> state.js -> leagueConfig.js liest
// beim Import (applyStoredOverrides, Modul-Top-Level) aus localStorage - ohne
// Shim bricht der Import unter plain Node ab. Wird hier nie tatsächlich
// befüllt/gelesen (dieses Skript ruft keine Club-Persistenz-Funktionen auf).
// Statische Top-Level-Imports werden vor jedem anderen Code gehoisted, daher
// hier bewusst dynamisches import() (läuft erst NACH dem Shim), analog zu den
// bestehenden Headless-Tests (league.test.mjs/reputation.test.mjs).
globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  key: () => null,
  length: 0,
};

const { OPPONENT_TEAMS, getOpponentRoster } = await import('../src/manager/opponents.js');
const { rateRoster } = await import('../src/manager/league.js');

/* ============================================================
   Seeded RNG (mulberry32) - reproduzierbare Vergleiche zwischen Kandidaten
   ============================================================ */
function mulberry32(seed) {
  return function rng() {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));

/* ============================================================
   Vereinfachtes Ballbesitz-Modell (siehe Hinweis oben)
   ============================================================ */
// Spiegelt hiveball.html: WIN_SCORE=3 (Sieg ab 3 TDs), MAX_TURNS_PER_TEAM=10.
// MAX_POSSESSIONS ist keine exakte Entsprechung (das Modell kennt keine
// einzelnen Spielzüge), sondern eine grobe Näherung an "so viele ernsthafte
// Ballbesitz-Phasen passen in ein Match, bevor das Zuglimit greift".
const WIN_SCORE = 3;
const MAX_POSSESSIONS = 8;

// Eine Ballbesitz-Phase: das angreifende Team (att) versucht, die Kontrolle
// zu behalten und zu punkten; das verteidigende Team (def) versucht, den
// Ball zurückzuerobern. ballHandlerPreference/passWillingness (att) und
// cagePriority (att, schützt den Träger) senken das Turnover-Risiko;
// markingFocus/riskTolerance (def, erzwingt Fehler) erhöhen es - dieselbe
// Wirkrichtung wie in hiveball.html computeAiPlan, nur statistisch statt
// räumlich. riskTolerance erhöht bei BEIDEN Seiten die
// Verletzungshäufigkeit (mehr gewagte Blocks/Fouls).
function simulatePossession(att, def, rng) {
  const ratingEdge = (att.rating - def.rating) / 40;

  const retention = clamp01(0.62
    + ratingEdge * 0.08
    + att.personality.ballHandlerPreference * 0.10
    + att.personality.passWillingness * 0.05
    + att.personality.cagePriority * 0.05
    - def.personality.markingFocus * 0.10
    - def.personality.riskTolerance * 0.06);

  const injChanceAtt = clamp01(0.10 + att.personality.riskTolerance * 0.12);
  const injChanceDef = clamp01(0.10 + def.personality.riskTolerance * 0.12);
  const injCausedByAtt = rng() < injChanceAtt ? 1 : 0; // att verletzt def beim Wegblocken
  const injCausedByDef = rng() < injChanceDef ? 1 : 0; // def verletzt att beim Tackling

  if (rng() >= retention) {
    return { scored: false, turnover: true, injCausedByAtt, injCausedByDef };
  }

  const scoreChance = clamp01(0.30
    + ratingEdge * 0.10
    + att.personality.ballHandlerPreference * 0.08
    + att.personality.passWillingness * 0.06
    + att.personality.cagePriority * 0.06
    - def.personality.markingFocus * 0.08);

  return { scored: rng() < scoreChance, turnover: false, injCausedByAtt, injCausedByDef };
}

function simulateMatch(teamA, teamB, rng) {
  let tdA = 0, tdB = 0, injByA = 0, injByB = 0;
  let possession = rng() < 0.5 ? 'A' : 'B';

  for (let i = 0; i < MAX_POSSESSIONS && tdA < WIN_SCORE && tdB < WIN_SCORE; i++) {
    const att = possession === 'A' ? teamA : teamB;
    const def = possession === 'A' ? teamB : teamA;
    const res = simulatePossession(att, def, rng);

    if (possession === 'A') { injByA += res.injCausedByAtt; injByB += res.injCausedByDef; }
    else { injByB += res.injCausedByAtt; injByA += res.injCausedByDef; }

    if (res.scored) {
      if (possession === 'A') tdA++; else tdB++;
      possession = possession === 'A' ? 'B' : 'A'; // Kickoff nach TD - Ballbesitz wechselt
    } else if (res.turnover) {
      possession = possession === 'A' ? 'B' : 'A';
    }
    // Weder Score noch Turnover: derselbe Angreifer bleibt am Ball (nächster Versuch).
  }

  return { tdA, tdB, injByA, injByB };
}

function runMatches(teamA, teamB, n, rng) {
  let winsA = 0, winsB = 0, draws = 0;
  let tdSumA = 0, tdSumB = 0, injSumA = 0, injSumB = 0;
  for (let i = 0; i < n; i++) {
    const { tdA, tdB, injByA, injByB } = simulateMatch(teamA, teamB, rng);
    tdSumA += tdA; tdSumB += tdB; injSumA += injByA; injSumB += injByB;
    if (tdA > tdB) winsA++; else if (tdB > tdA) winsB++; else draws++;
  }
  return {
    winRateA: winsA / n, winRateB: winsB / n, drawRate: draws / n,
    avgTdA: tdSumA / n, avgTdB: tdSumB / n,
    avgInjByA: injSumA / n, avgInjByB: injSumB / n,
  };
}

/* ============================================================
   Fitness je Team-Archetyp
   ============================================================ */
// Zielabweichung von der reinen Rating-Erwartung (Elo-artig): die
// Persönlichkeit soll die Statur-basierte Erwartung verfeinern, nicht
// ersetzen. Grashüpfer ("planlos") leicht darunter, Zikaden (Referenz)
// exakt darauf, Sturm-Wespen/Königinnengarde (bessere Entscheidungen on
// top of stats) leicht/deutlich darüber. Werte sind bewusst klein - die
// Persönlichkeit ist ein Feinschliff, kein Ersatz für die Statur-Leiter.
const TARGET_WIN_RATE_DELTA = {
  grasshoppers: -0.03,
  cicadas: 0,
  steelants: 0,
  stormwasps: 0.03,
  queensguard: 0.05,
};

// Stil-Bonus, direkt aus der schon bestehenden Team-Flavor (opponents.js
// style-Text) abgeleitet, nicht neu erfunden. Nur Stahl-Ameisen (Klump) und
// Sturm-Wespen (Ballhandling/Tempo) bekommen einen expliziten Stil-Zusatz,
// da nur bei diesen beiden ein Verhaltens-Extrem gewünscht ist.
const STYLE_BONUS = {
  steelants: (s) => (s.avgInjByA - s.avgInjByB) * 0.5 - (s.avgTdA + s.avgTdB) * 0.05,
  stormwasps: (s) => (s.avgTdA + s.avgTdB) * 0.15,
};

function expectedWinRate(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, -(ratingA - ratingB) / 40));
}

const MATCHES_PER_EVAL = 50;

function fitness(teamId, candidatePersonality, rating, panel, rng) {
  const targetDelta = TARGET_WIN_RATE_DELTA[teamId] ?? 0;
  const styleFn = STYLE_BONUS[teamId] || null;
  let total = 0;
  for (const opp of panel) {
    const stats = runMatches(
      { rating, personality: candidatePersonality },
      { rating: opp.rating, personality: opp.personality },
      MATCHES_PER_EVAL, rng
    );
    const expected = expectedWinRate(rating, opp.rating);
    const actualDelta = stats.winRateA - expected;
    total += -Math.abs(actualDelta - targetDelta) * 2;
    if (styleFn) total += styleFn(stats);
  }
  return total / panel.length;
}

/* ============================================================
   Koordinaten-Aufstieg (Hill-Climbing) über die 5 Parameter
   ============================================================ */
const PARAM_KEYS = ['ballHandlerPreference', 'passWillingness', 'markingFocus', 'riskTolerance', 'cagePriority'];

function localSearch(teamId, startPersonality, rating, panel, rng) {
  let current = { ...startPersonality };
  let currentFitness = fitness(teamId, current, rating, panel, rng);
  let step = 0.15;

  while (step >= 0.02) {
    let improved = false;
    for (const key of PARAM_KEYS) {
      for (const delta of [step, -step]) {
        const candidate = { ...current, [key]: clamp01(current[key] + delta) };
        const candidateFitness = fitness(teamId, candidate, rating, panel, rng);
        if (candidateFitness > currentFitness) {
          current = candidate;
          currentFitness = candidateFitness;
          improved = true;
        }
      }
    }
    if (!improved) step *= 0.6;
  }
  return { personality: current, fitness: currentFitness };
}

/* ============================================================
   Hauptlauf: 2 Durchgänge über alle 5 Teams (Ko-Adaption), gegen den
   jeweils aktuellen Stand der anderen 4 Teams.
   ============================================================ */
const rng = mulberry32(20260724);

const ratings = Object.fromEntries(OPPONENT_TEAMS.map((t) => [t.id, rateRoster(getOpponentRoster(t.id).starters)]));
const original = Object.fromEntries(OPPONENT_TEAMS.map((t) => [t.id, { ...t.personality }]));
const tuned = Object.fromEntries(OPPONENT_TEAMS.map((t) => [t.id, { ...t.personality }]));

const OUTER_PASSES = 2;
for (let pass = 1; pass <= OUTER_PASSES; pass++) {
  for (const team of OPPONENT_TEAMS) {
    const panel = OPPONENT_TEAMS
      .filter((o) => o.id !== team.id)
      .map((o) => ({ rating: ratings[o.id], personality: tuned[o.id] }));
    const result = localSearch(team.id, tuned[team.id], ratings[team.id], panel, rng);
    tuned[team.id] = result.personality;
  }
}

/* ============================================================
   Ausgabe: Vorher/Nachher-Vergleich je Team
   ============================================================ */
function fmt(p) {
  return PARAM_KEYS.map((k) => `${k.slice(0, 4)}=${p[k].toFixed(2)}`).join(' ');
}

console.log('=== KI-Persönlichkeiten: Vorschläge aus dem Selbstspiel-Tuning ===');
console.log(`(${OUTER_PASSES} Durchgänge, ${MATCHES_PER_EVAL} simulierte Matches je Bewertung, seed=20260724)\n`);

for (const team of OPPONENT_TEAMS) {
  const panelFinal = OPPONENT_TEAMS
    .filter((o) => o.id !== team.id)
    .map((o) => ({ rating: ratings[o.id], personality: tuned[o.id] }));

  const statsOld = panelFinal.map((opp) => runMatches({ rating: ratings[team.id], personality: original[team.id] }, opp, 200, rng));
  const statsNew = panelFinal.map((opp) => runMatches({ rating: ratings[team.id], personality: tuned[team.id] }, opp, 200, rng));
  const avg = (arr, key) => arr.reduce((s, x) => s + x[key], 0) / arr.length;

  console.log(`--- ${team.name} (${team.id}, Rang ${team.rank}, Rating ${ratings[team.id]}) ---`);
  console.log(`  alt:  ${fmt(original[team.id])}`);
  console.log(`  neu:  ${fmt(tuned[team.id])}`);
  console.log(`  Panel-Winrate  alt=${(avg(statsOld, 'winRateA') * 100).toFixed(1)}%  neu=${(avg(statsNew, 'winRateA') * 100).toFixed(1)}%`);
  console.log(`  Ø TD (für:gegen) alt=${avg(statsOld, 'avgTdA').toFixed(2)}:${avg(statsOld, 'avgTdB').toFixed(2)}  neu=${avg(statsNew, 'avgTdA').toFixed(2)}:${avg(statsNew, 'avgTdB').toFixed(2)}`);
  console.log(`  Ø Verl. (zugefügt:erlitten) alt=${avg(statsOld, 'avgInjByA').toFixed(2)}:${avg(statsOld, 'avgInjByB').toFixed(2)}  neu=${avg(statsNew, 'avgInjByA').toFixed(2)}:${avg(statsNew, 'avgInjByB').toFixed(2)}`);
  console.log('');
}

console.log('Hinweis: Werte sind Vorschläge aus dem vereinfachten Modell (siehe Kommentar');
console.log('am Dateianfang) - vor einer Übernahme in opponents.js gegenprüfen.');

// Maschinenlesbare Vollpräzisions-Werte (die Tabelle oben rundet auf 2
// Nachkommastellen) - zum direkten Übernehmen einzelner Teams in opponents.js,
// ohne die Rundung der Konsolenausgabe mitzuschleppen.
console.log('\n=== Vollpräzision (zum Kopieren) ===');
for (const team of OPPONENT_TEAMS) {
  console.log(`${team.id}: ${JSON.stringify(tuned[team.id])}`);
}
