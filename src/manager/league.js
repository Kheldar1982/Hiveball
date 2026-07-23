// Liga-/Saisonlogik (Slice B). Baut auf den datengetriebenen Gegnern
// (opponents.js) auf: eine 6-Team-Liga (dein Verein + die 5 Gegner) als
// Einfachrunde über 5 Spieltage. Du spielst deine eigene Partie taktisch im
// Kernspiel aus; die je zwei übrigen Begegnungen eines Spieltags werden beim
// Verbuchen deines Ergebnisses abstrakt über ein Stärke-Rating simuliert.
//
// Die Liga lebt als club.league (wird per exportSaveToFile mitgesichert). Diese
// Datei mutiert club und persistiert über state.js saveClub – nie direkt
// localStorage (Persistenz-Abstraktion, Spezifikation 9.2).

import { saveClub } from './state.js';
import { OPPONENT_TEAMS, getOpponentById, getOpponentRoster } from './opponents.js';

export const PLAYER_TEAM_ID = 'player';

/* ============================================================
   STÄRKE-RATING (treibt Sim + ★-Anzeige, eine Formel für beides)
   ============================================================ */

// Bewertet einen einzelnen (Manager- oder Gegner-)Spieler: Summe der fünf
// trainierbaren Attribute + 3 je Skill (inkl. Startskill, rein relativ).
export function ratePlayer(p) {
  const a = p.attributes;
  const attrSum = a.bl.current + a.st.current + a.co.current + a.ag.current + a.pa.current;
  return attrSum + 3 * ((p.skills && p.skills.length) || 0);
}

// Team-Rating = Summe der fünf stärksten Spieler (Gegner haben genau fünf
// Starter; ein Manager-Kader kann mehr haben – dann zählen die besten fünf).
export function rateRoster(players) {
  return players
    .map(ratePlayer)
    .sort((x, y) => y - x)
    .slice(0, 5)
    .reduce((s, v) => s + v, 0);
}

export function rateOpponent(id) {
  const roster = getOpponentRoster(id);
  return roster ? rateRoster(roster.starters) : 0;
}

// ★ 1..5 für einen Gegner = sein fester Schwierigkeitsrang.
export function opponentStars(id) {
  const team = getOpponentById(id);
  return team ? team.rank : 1;
}

// ★ 1..5 für den eigenen Verein: auf derselben Leiter wie die Gegner – "so
// stark wie N der fünf Gegner". Startkader (~Grashüpfer) => 1★, steigt sichtbar
// mit Training.
export function playerStars(playerRating) {
  const weaker = OPPONENT_TEAMS.filter((t) => rateOpponent(t.id) < playerRating).length;
  return Math.max(1, Math.min(5, weaker));
}

export function starsForTeam(teamId, playerRating) {
  return teamId === PLAYER_TEAM_ID ? playerStars(playerRating) : opponentStars(teamId);
}

/* ============================================================
   SPIELPLAN (Einfachrunde, 6 Teams, 5 Spieltage)
   ============================================================ */

// Standard-Rundenturnier ("erstes Element fixieren, Rest rotieren"). Liefert
// n-1 Runden; jede Runde ist ein Array von [i, j]-Index-Paaren.
function roundRobinRounds(n) {
  const idx = Array.from({ length: n }, (_, k) => k);
  const rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const round = [];
    for (let i = 0; i < n / 2; i++) round.push([idx[i], idx[n - 1 - i]]);
    rounds.push(round);
    idx.splice(1, 0, idx.pop()); // idx[0] fix, Rest rotiert
  }
  return rounds;
}

// Erzeugt den Spielplan so, dass DEIN Verein die Gegner in aufsteigender
// Schwierigkeit trifft (Rang 1 an Spieltag 1 ... Rang 5 an Spieltag 5), während
// die übrigen vier parallel ihre eigenen Partien bestreiten (vollständige
// Tabelle). Dazu wird ein beliebiger gültiger Rundenplan erzeugt und die Slots
// so mit Gegnern belegt, dass die Reihenfolge stimmt – robust unabhängig vom
// konkreten Rundenturnier-Algorithmus.
function generateSchedule() {
  const rounds = roundRobinRounds(6); // Slot 0 = Spieler, Slots 1..5 = Gegner
  const meetOrder = rounds.map((round) => {
    const pair = round.find(([a, b]) => a === 0 || b === 0);
    return pair[0] === 0 ? pair[1] : pair[0];
  });
  const oppsByRank = [...OPPONENT_TEAMS].sort((a, b) => a.rank - b.rank);
  const slotToId = { 0: PLAYER_TEAM_ID };
  meetOrder.forEach((slot, i) => { slotToId[slot] = oppsByRank[i].id; });

  return rounds.map((round) =>
    round.map(([a, b]) => ({ home: slotToId[a], away: slotToId[b], result: null }))
  );
}

/* ============================================================
   LIGA-ZUSTAND
   ============================================================ */

// Legt club.league an, falls nicht vorhanden (lazy, auch für Bestandsvereine),
// und hält den Team-Namen des Spielers mit club.name synchron.
export function ensureLeague(club) {
  if (!club.league || !Array.isArray(club.league.schedule) || club.league.schedule.length === 0) {
    const oppsByRank = [...OPPONENT_TEAMS].sort((a, b) => a.rank - b.rank);
    club.league = {
      seasonNumber: 1,
      currentMatchday: 0,
      seasonComplete: false,
      teams: [
        { id: PLAYER_TEAM_ID, name: club.name, isPlayer: true },
        ...oppsByRank.map((o) => ({ id: o.id, name: o.name, isPlayer: false, rank: o.rank })),
      ],
      schedule: generateSchedule(),
    };
    saveClub(club);
  } else {
    const pt = club.league.teams.find((t) => t.isPlayer);
    if (pt && pt.name !== club.name) {
      pt.name = club.name;
      saveClub(club);
    }
  }
  return club.league;
}

export function teamName(club, id) {
  if (id === PLAYER_TEAM_ID) return club.name;
  const t = club.league && club.league.teams.find((x) => x.id === id);
  return t ? t.name : id;
}

// Das Fixture des aktuellen Spieltags, an dem der Spieler beteiligt ist.
export function currentPlayerFixture(club) {
  const lg = club.league;
  if (!lg) return null;
  const md = lg.schedule[lg.currentMatchday];
  if (!md) return null;
  return md.find((f) => f.home === PLAYER_TEAM_ID || f.away === PLAYER_TEAM_ID) || null;
}

export function currentOpponentId(club) {
  const f = currentPlayerFixture(club);
  if (!f) return null;
  return f.home === PLAYER_TEAM_ID ? f.away : f.home;
}

/* ============================================================
   ABSTRAKTE SIM (nur für die KI-gegen-KI-Begegnungen)
   ============================================================ */

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function weightedPick(pairs) {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [value, w] of pairs) {
    r -= w;
    if (r < 0) return value;
  }
  return pairs[pairs.length - 1][0];
}

// Ergebnis einer nicht ausgespielten Begegnung aus den beiden Team-Ratings.
// Elo-artige Siegwahrscheinlichkeit, Unentschieden vor allem bei ausgeglichenen
// Teams; der Vorsprung wächst mit dem Ratingunterschied. Verletzungen klein und
// unabhängig (nur letzter Tie-Breaker). Ergebnisse werden festgeschrieben und
// bei Reload nie neu gewürfelt (siehe recordPlayerLeagueResult).
export function simulateFixture(ratingHome, ratingAway) {
  const S = 40;
  const pHome = 1 / (1 + Math.pow(10, -(ratingHome - ratingAway) / S));
  const drawChance = 0.16 * (1 - 2 * Math.abs(pHome - 0.5)); // max bei Gleichstärke
  const injDist = [[0, 50], [1, 33], [2, 14], [3, 3]];

  let homeTd;
  let awayTd;
  if (Math.random() < drawChance) {
    const td = weightedPick([[0, 30], [1, 45], [2, 20], [3, 5]]);
    homeTd = td;
    awayTd = td;
  } else {
    const homeWins = Math.random() < pHome;
    const loserTd = weightedPick([[0, 40], [1, 40], [2, 18], [3, 2]]);
    const marginBoost = Math.min(3, Math.floor(Math.abs(ratingHome - ratingAway) / 25));
    const winnerTd = loserTd + 1 + randInt(0, 1 + marginBoost);
    homeTd = homeWins ? winnerTd : loserTd;
    awayTd = homeWins ? loserTd : winnerTd;
  }
  return {
    homeTd,
    awayTd,
    homeInj: weightedPick(injDist),
    awayInj: weightedPick(injDist),
  };
}

// Verbucht das echte, im Kernspiel ausgespielte Ergebnis des Spielers, simuliert
// die übrigen Begegnungen desselben Spieltags und schaltet den Spieltag weiter.
// Idempotent: ist das Spieler-Fixture schon verbucht oder die Saison beendet,
// passiert nichts (schützt vor Doppelverarbeitung).
// injuries: playerInj = von deinem Team zugefügte Verletzungen, oppInj = erlittene.
export function recordPlayerLeagueResult(club, { playerTd, oppTd, playerInj, oppInj }) {
  const lg = ensureLeague(club);
  if (lg.seasonComplete) return lg;

  const md = lg.schedule[lg.currentMatchday];
  if (!md) return lg;

  const pf = md.find((f) => f.home === PLAYER_TEAM_ID || f.away === PLAYER_TEAM_ID);
  if (!pf || pf.result) return lg;

  if (pf.home === PLAYER_TEAM_ID) {
    pf.result = { homeTd: playerTd, awayTd: oppTd, homeInj: playerInj, awayInj: oppInj };
  } else {
    pf.result = { homeTd: oppTd, awayTd: playerTd, homeInj: oppInj, awayInj: playerInj };
  }

  for (const f of md) {
    if (f.result) continue;
    f.result = simulateFixture(rateOpponent(f.home), rateOpponent(f.away));
  }

  lg.currentMatchday += 1;
  if (lg.currentMatchday >= lg.schedule.length) lg.seasonComplete = true;
  saveClub(club);
  return lg;
}

/* ============================================================
   TABELLE
   ============================================================ */

// Aktueller Tabellenstand. 3/1/0 Punkte; Sortierung: Punkte, TD-Differenz,
// TD erzielt, Verletzungsdifferenz (zugefügt − erlitten, höher = besser), Name.
export function computeStandings(club) {
  const lg = ensureLeague(club);
  const rows = new Map();
  for (const t of lg.teams) {
    rows.set(t.id, {
      id: t.id,
      name: teamName(club, t.id),
      isPlayer: !!t.isPlayer,
      sp: 0, w: 0, d: 0, l: 0,
      tdFor: 0, tdAgainst: 0,
      injFor: 0, injAgainst: 0,
      pts: 0,
    });
  }

  for (const md of lg.schedule) {
    for (const f of md) {
      if (!f.result) continue;
      const h = rows.get(f.home);
      const a = rows.get(f.away);
      const { homeTd, awayTd, homeInj, awayInj } = f.result;
      h.sp++; a.sp++;
      h.tdFor += homeTd; h.tdAgainst += awayTd;
      a.tdFor += awayTd; a.tdAgainst += homeTd;
      h.injFor += homeInj; h.injAgainst += awayInj;
      a.injFor += awayInj; a.injAgainst += homeInj;
      if (homeTd > awayTd) { h.w++; a.l++; h.pts += 3; }
      else if (awayTd > homeTd) { a.w++; h.l++; a.pts += 3; }
      else { h.d++; a.d++; h.pts++; a.pts++; }
    }
  }

  return [...rows.values()].sort((x, y) =>
    y.pts - x.pts
    || (y.tdFor - y.tdAgainst) - (x.tdFor - x.tdAgainst)
    || y.tdFor - x.tdFor
    || (y.injFor - y.injAgainst) - (x.injFor - x.injAgainst)
    || x.name.localeCompare(y.name)
  );
}

// Startet eine neue Saison mit denselben Gegnern: frischer Spielplan, Spieltag
// zurück auf 0, dein weiterentwickelter Kader bleibt erhalten.
export function startNewSeason(club) {
  const lg = ensureLeague(club);
  lg.seasonNumber += 1;
  lg.currentMatchday = 0;
  lg.seasonComplete = false;
  lg.schedule = generateSchedule();
  const pt = lg.teams.find((t) => t.isPlayer);
  if (pt) pt.name = club.name;
  saveClub(club);
  return lg;
}
