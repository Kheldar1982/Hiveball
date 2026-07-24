// Datengetriebene KI-Gegnervereine (Slice A). Ersetzt den einen festen
// "Red AI"-Platzhalter (siehe hiveball.html setupTeams, leagueConfig.js
// opponentReputation) durch eine aufsteigende Stärke-Leiter aus fünf Teams.
//
// LEGALITÄTSREGELN (Spezifikation 3.2/3.4), an die sich jedes Team hält, damit
// es einem echten Verein mit passender Infrastruktur entsprechen könnte:
//   - Attribut-Obergrenze pro Spieler = Positions-Grundwert + Trainingscenter-
//     Level (TC1 -> Grundwert+1, TC2 -> +2, TC3 -> +3). mr (Bewegung) ist
//     positionsfest und nicht trainierbar.
//   - Zusätzliche Skills (über den Startskill der Position hinaus) sind auf das
//     Akademie-Level begrenzt (AC1->1, AC2->2, AC3->3), +1 in der Alterphase
//     Peak/Routinier/Veteran.
//   - Formation: max. 2 pro Spezialposition (Blocker/Werfer/Fänger/Läufer),
//     Lineman unbegrenzt; 5 Feldspieler.
// Da Gegner keine EP-Ökonomie durchlaufen, stehen hier die Endwerte direkt –
// die "implies"-Angabe je Team dokumentiert die dafür nötige Infrastruktur.
//
// startingReputation (Nutzervorgabe): feste Reputation je Gegner, aufsteigend
// mit der Stärke-Leiter (50/60/70/80/90 für Rang 1-5) – ersetzt die bisher
// fixe leagueConfig.js economy.reputation.opponentReputation als Grundlage
// für economy.js updateReputation (siehe league.js opponentReputation()).

import { POSITIONS_MANAGER_EXT } from './positions.js';

// attrs = { bl, st, co, ag, pa } als Absolutwerte. mr kommt aus der Position.
export const OPPONENT_TEAMS = [
  {
    id: 'grasshoppers',
    name: 'Wiesen-Grashüpfer',
    rank: 1,
    startingReputation: 50,
    style: 'Rookies – alles auf Grundwert, nur Startskills.',
    implies: 'TC1 / AC1',
    starters: [
      { name: 'Klaus Halm',   position: 'Blocker', attrs: { bl: 5, st: 5, co: 5, ag: 2, pa: 3 }, skills: ['Block'] },
      { name: 'Bert Grün',    position: 'Blocker', attrs: { bl: 5, st: 5, co: 5, ag: 2, pa: 3 }, skills: ['Block'] },
      { name: 'Toni Wurf',    position: 'Werfer',  attrs: { bl: 3, st: 3, co: 4, ag: 4, pa: 6 }, skills: ['Zielwurf'] },
      { name: 'Emil Flink',   position: 'Fänger',  attrs: { bl: 2, st: 2, co: 3, ag: 7, pa: 6 }, skills: ['Dodge'] },
      { name: 'Rudi Sprint',  position: 'Läufer',  attrs: { bl: 3, st: 3, co: 3, ag: 6, pa: 5 }, skills: ['Blitz'] },
    ],
    bench: [
      { name: 'Otto Klotz',   position: 'Lineman', attrs: { bl: 3, st: 3, co: 3, ag: 3, pa: 3 }, skills: [] },
      { name: 'Kurt Stumpf',  position: 'Lineman', attrs: { bl: 3, st: 3, co: 3, ag: 3, pa: 3 }, skills: [] },
    ],
  },
  {
    id: 'cicadas',
    name: 'Grüne Zikaden',
    rank: 2,
    startingReputation: 60,
    style: 'Solide, ausgeglichen – ein paar +1/+2, genau ein Zusatzskill.',
    implies: 'TC2 / AC1',
    starters: [
      { name: 'Manni Wall',     position: 'Blocker', attrs: { bl: 7, st: 6, co: 5, ag: 2, pa: 3 }, skills: ['Block', 'Robust'] },
      { name: 'Franz Bollwerk', position: 'Blocker', attrs: { bl: 6, st: 6, co: 5, ag: 2, pa: 3 }, skills: ['Block'] },
      { name: 'Georg Pfeil',    position: 'Werfer',  attrs: { bl: 3, st: 3, co: 5, ag: 4, pa: 7 }, skills: ['Zielwurf'] },
      { name: 'Nils Husch',     position: 'Fänger',  attrs: { bl: 2, st: 2, co: 3, ag: 9, pa: 6 }, skills: ['Dodge'] },
      { name: 'Leo Wind',       position: 'Läufer',  attrs: { bl: 3, st: 4, co: 3, ag: 8, pa: 5 }, skills: ['Blitz'] },
    ],
    bench: [
      { name: 'Adam Grob',  position: 'Lineman', attrs: { bl: 4, st: 3, co: 3, ag: 3, pa: 3 }, skills: [] },
      { name: 'Bruno Fest', position: 'Lineman', attrs: { bl: 3, st: 4, co: 3, ag: 3, pa: 3 }, skills: [] },
    ],
  },
  {
    id: 'steelants',
    name: 'Stahl-Ameisen',
    rank: 3,
    startingReputation: 70,
    style: 'Defensiv-Grinder – kein zerbrechlicher Fänger, dafür ein zäher Lineman.',
    implies: 'TC2 / AC2',
    starters: [
      { name: 'Egon Panzer', position: 'Blocker', attrs: { bl: 7, st: 7, co: 6, ag: 2, pa: 3 }, skills: ['Block', 'Robust', 'Rückendeckung'] },
      { name: 'Rolf Amboss',  position: 'Blocker', attrs: { bl: 7, st: 7, co: 5, ag: 3, pa: 3 }, skills: ['Block', 'Gewandt'] },
      { name: 'Karl Beton',   position: 'Lineman', attrs: { bl: 5, st: 5, co: 4, ag: 3, pa: 3 }, skills: ['Robust'] },
      { name: 'Sven Kühl',    position: 'Werfer',  attrs: { bl: 3, st: 3, co: 6, ag: 5, pa: 7 }, skills: ['Zielwurf', 'Ruhiger Kopf'] },
      { name: 'Timo Zäh',     position: 'Läufer',  attrs: { bl: 3, st: 5, co: 3, ag: 8, pa: 5 }, skills: ['Blitz', 'Ballsicher'] },
    ],
    bench: [
      { name: 'Paul Stahl',    position: 'Lineman', attrs: { bl: 5, st: 5, co: 3, ag: 3, pa: 3 }, skills: ['Robust'] },
      { name: 'Dirk Wuchtig',  position: 'Blocker', attrs: { bl: 6, st: 6, co: 5, ag: 2, pa: 3 }, skills: ['Block'] },
    ],
  },
  {
    id: 'stormwasps',
    name: 'Sturm-Wespen',
    rank: 4,
    startingReputation: 80,
    style: 'Schnell & aggressiv – zwei Läufer, viel AG, punktet blitzschnell, dünn in ST/BL.',
    implies: 'TC3 / AC2',
    starters: [
      { name: 'Max Brecher', position: 'Blocker', attrs: { bl: 8, st: 8, co: 6, ag: 2, pa: 3 }, skills: ['Block', 'Robust', 'Gewandt'] },
      { name: 'Jan Bombe',   position: 'Werfer',  attrs: { bl: 3, st: 3, co: 7, ag: 5, pa: 9 }, skills: ['Zielwurf', 'Ruhiger Kopf'] },
      { name: 'Finn Pfeil',  position: 'Fänger',  attrs: { bl: 2, st: 2, co: 3, ag: 10, pa: 7 }, skills: ['Dodge', 'Trittsicher'] },
      { name: 'Nico Blitz',  position: 'Läufer',  attrs: { bl: 3, st: 5, co: 3, ag: 9, pa: 6 }, skills: ['Blitz', 'Ballsicher'] },
      { name: 'Luis Rasant', position: 'Läufer',  attrs: { bl: 4, st: 4, co: 3, ag: 9, pa: 5 }, skills: ['Blitz', 'Gewandt'] },
    ],
    bench: [
      { name: 'Ben Flitz', position: 'Fänger', attrs: { bl: 2, st: 2, co: 3, ag: 9, pa: 6 }, skills: ['Dodge'] },
      { name: 'Tom Hetz',  position: 'Läufer', attrs: { bl: 3, st: 3, co: 3, ag: 8, pa: 5 }, skills: ['Blitz'] },
    ],
  },
  {
    id: 'queensguard',
    name: 'Königinnengarde',
    rank: 5,
    startingReputation: 90,
    style: 'Elite – Attribute auf Maximum (+3), 3 Skills; der Veteran-Kapitän dank Altersbonus sogar 4.',
    implies: 'TC3 / AC3 (Kapitän: + Altersbonus Veteran)',
    starters: [
      { name: 'Kapitän Godwin',   position: 'Blocker', attrs: { bl: 8, st: 8, co: 8, ag: 5, pa: 6 }, skills: ['Block', 'Robust', 'Rückendeckung', 'Gewandt', 'Hinterhältig'] },
      { name: 'Balthasar Wall',   position: 'Blocker', attrs: { bl: 8, st: 8, co: 7, ag: 4, pa: 3 }, skills: ['Block', 'Robust', 'Rückendeckung', 'Gewandt'] },
      { name: 'Cornelius Ziel',   position: 'Werfer',  attrs: { bl: 3, st: 3, co: 7, ag: 7, pa: 9 }, skills: ['Zielwurf', 'Ruhiger Kopf', 'Ballsicher'] },
      { name: 'Aurel Schwing',    position: 'Fänger',  attrs: { bl: 2, st: 2, co: 6, ag: 10, pa: 9 }, skills: ['Dodge', 'Trittsicher', 'Ballsicher'] },
      { name: 'Viktor Sturm',     position: 'Läufer',  attrs: { bl: 6, st: 6, co: 3, ag: 9, pa: 8 }, skills: ['Blitz', 'Ballsicher', 'Gewandt'] },
    ],
    bench: [
      { name: 'Magnus Hart',      position: 'Blocker', attrs: { bl: 7, st: 7, co: 6, ag: 2, pa: 3 }, skills: ['Block', 'Robust'] },
      { name: 'Ferdinand Erz',    position: 'Lineman', attrs: { bl: 6, st: 6, co: 6, ag: 3, pa: 3 }, skills: ['Robust'] },
      { name: 'Elias Wisch',      position: 'Fänger',  attrs: { bl: 2, st: 2, co: 3, ag: 10, pa: 6 }, skills: ['Dodge', 'Trittsicher'] },
    ],
  },
];

// Expandiert einen kompakten Gegner-Spielereintrag in genau die Objektform,
// die hiveball.html createPlayer als managerPlayer erwartet (mr direkt,
// attributes.<x>.current, skills). playerId bleibt null: der Gegner ist ein
// NPC ohne persistente Kaderanbindung – exakt wie der frühere Red-Fallback
// (managerPlayer === null), nur mit echten Werten/Namen statt Positions-Default.
function expandPlayer(def) {
  const base = POSITIONS_MANAGER_EXT[def.position];
  if (!base) throw new Error(`Unbekannte Gegner-Position: ${def.position}`);
  const a = def.attrs;
  return {
    name: def.name,
    position: def.position,
    mr: base.mr,
    attributes: {
      bl: { current: a.bl },
      st: { current: a.st },
      co: { current: a.co },
      ag: { current: a.ag },
      pa: { current: a.pa },
    },
    skills: [...def.skills],
    playerId: null,
    isOpponent: true,
  };
}

export function getOpponentById(id) {
  return OPPONENT_TEAMS.find((t) => t.id === id) || null;
}

// Liefert { name, starters:[...], bench:[...] } mit voll expandierten Spielern
// oder null bei unbekannter id.
export function getOpponentRoster(id) {
  const team = getOpponentById(id);
  if (!team) return null;
  return {
    name: team.name,
    starters: team.starters.map(expandPlayer),
    bench: team.bench.map(expandPlayer),
  };
}
