// Persistente Datenmodelle des Manager-Teils, siehe
// docs/hiveball_manager_spezifikation.md Abschnitt 2. Die hier erzeugten
// Objekte sind die persistente Quelle der Wahrheit, aus der zu Matchbeginn
// die Kernspiel-Spielerobjekte (src/hiveball.html, POSITIONS) erzeugt werden.
//
// Enthält zusätzlich die Persistenz-Abstraktionsschicht aus Spezifikation 9.2:
// Spiellogik/UI rufen ausschließlich save*/load*-Funktionen auf, nie direkt
// localStorage. Damit betrifft eine spätere Server-Migration nur diese Datei.
// Speichermechanismus laut Spezifikation 9.1: localStorage als automatisches
// Standard-Save, Datei-Export/Import (JSON) zusätzlich als manuelle Sicherung.

import { POSITIONS_MANAGER_EXT } from './positions.js';
import { defaultLeagueConfig } from './leagueConfig.js';
import { calculateMarketValue } from './formulas.js';

function createId() {
  return crypto.randomUUID();
}

// Erzeugt ein neues ManagerPlayer-Objekt (Spezifikation 2.1). Attribute und
// Startskill kommen aus POSITIONS_MANAGER_EXT; number muss vom Aufrufer
// eindeutig im Kader vergeben werden (hier nicht prüfbar).
export function createManagerPlayer({ position, name, clubId, number, age = defaultLeagueConfig.aging.startAge }) {
  const base = POSITIONS_MANAGER_EXT[position];
  if (!base) throw new Error(`Unbekannte Position: ${position}`);

  const player = {
    playerId: createId(),
    clubId,
    name,
    position,
    number,
    age,
    gamesPlayedTotal: 0,

    attributes: {
      bl: { current: base.bl },
      st: { current: base.st },
      co: { current: base.co },
      ag: { current: base.ag },
      pa: { current: base.pa }
    },
    mr: base.mr,

    reps: { bl: 0, st: 0, co: 0, ag: 0, pa: 0 },
    repsThisGame: { bl: 0, st: 0, co: 0, ag: 0, pa: 0 },

    skills: [...base.skills],
    bankedSkillPurchases: [],

    xp: 0,

    injury: {
      gamesRemaining: 0,
      severity: null
    },

    // Karriere-Statistik über alle Matches hinweg (nicht Teil der
    // Spezifikation, für die Hall of Fame ergänzt). Wird am Matchende aus den
    // Kernspiel-Zählern übernommen, siehe src/manager/injury.js.
    careerTouchdowns: 0,
    careerInjuriesCaused: 0,

    // null solange aktiv; beim Ausscheiden (Zwangsrente, siehe aging.js/
    // injury.js) gesetzt: Grund, Spielstand zu dem Zeitpunkt, Zeitstempel.
    // Grundlage für die Hall of Fame.
    retirement: null,

    marketValue: 0, // unten per calculateMarketValue gesetzt (braucht attributes/skills)
    retired: false,
    status: 'aktiv'
  };

  player.marketValue = calculateMarketValue(player, defaultLeagueConfig);
  return player;
}

// Erzeugt einen neuen Club (Spezifikation 2.2) mit Startkapital und
// Facility-Level aus defaultLeagueConfig.
export function createClub({ name }) {
  return {
    clubId: createId(),
    name,
    money: defaultLeagueConfig.economy.startingCapital,
    reputation: 50,

    roster: [],

    facilities: {
      physicalTraining: { level: 1 },
      theoryTraining: { level: 1 },
      medical: { level: 1 },
      publicRelations: { level: 0 },
      fanshop: { level: 0 },
      catering: { level: 0 },
      // Startet bei Level 1 (kostenlos, wie Trainingscenter/Akademie/
      // Medizinische Abteilung) statt 0 – ein Verein braucht immer eine
      // Spielstätte, "kein Stadion" ergibt anders als bei den übrigen
      // Gebäuden keinen sinnvollen Zustand.
      stadium: { level: 1 }
    },

    trainingQueue: {
      physical: [],
      theory: [],
      // Bereits in diesem Matchday-Zyklus verbrauchte Slots (Phasenplan-Fix:
      // "Training durchführen" darf nicht beliebig oft hintereinander
      // geklickt werden, um mehr als slots-viele Trainings pro Zyklus
      // durchzuführen). Wird bei jedem Matchende zurückgesetzt, siehe
      // postMatch.js.
      physicalUsedThisCycle: [],
      theoryUsedThisCycle: []
    },
    medicalQueue: [],

    lastMatchNomination: {
      starters: [],
      bench: []
    },

    // Wirtschaftliche Zusammenfassung des zuletzt gespielten Matches (siehe
    // postMatch.js processPostMatch) – Grundlage für finances.html. null,
    // solange noch kein Match gespielt wurde.
    lastMatchEconomy: null
  };
}

// Standardaufstellung "Option A" (siehe README Kernspiel, Abschnitt 3):
// 2 Blocker, 1 Werfer, 1 Fänger, 1 Läufer. Wird bei Vereinsgründung
// automatisch angelegt. Kostenlos statt über den Transfermarkt gekauft –
// zum Basispreis wären alle 5 zusammen (280.000) teurer als das gesamte
// Startkapital (200.000), ein neuer Verein bringt seinen Gründungskader
// also bereits mit, statt ihn sich erst leisten zu müssen.
const STARTING_ROSTER = [
  { position: 'Blocker', name: 'Blocker 1' },
  { position: 'Blocker', name: 'Blocker 2' },
  { position: 'Werfer', name: 'Werfer 1' },
  { position: 'Fänger', name: 'Fänger 1' },
  { position: 'Läufer', name: 'Läufer 1' }
];

export function createStartingRoster(club) {
  const players = STARTING_ROSTER.map(({ position, name }, i) =>
    createManagerPlayer({ position, name, clubId: club.clubId, number: i + 1 })
  );
  for (const player of players) {
    club.roster.push(player.playerId);
    savePlayer(player);
  }
  saveClub(club);
  return players;
}

/* ============================================================
   PERSISTENZ (Spezifikation 9.1/9.2)
   ============================================================ */

const STORAGE_PREFIX = 'hiveball:';
const clubKey = (clubId) => `${STORAGE_PREFIX}club:${clubId}`;
const playerKey = (playerId) => `${STORAGE_PREFIX}player:${playerId}`;

export function saveClub(club) {
  localStorage.setItem(clubKey(club.clubId), JSON.stringify(club));
}

export function loadClub(clubId) {
  const raw = localStorage.getItem(clubKey(clubId));
  if (!raw) return null;
  const club = JSON.parse(raw);
  migrateClub(club);
  return club;
}

// Repariert vor der Ökonomie-Überarbeitung gespeicherte Vereine: das Feld
// hieß ursprünglich "fanSector" (nie mit echter Funktion belegt) und wurde
// zu "publicRelations" ("Öffentlichkeitsarbeit", jetzt PR-Multiplikator für
// die Reputationsformel). Ohne diese Migration bliebe club.facilities.publicRelations
// bei bestehenden Spielständen undefined, was updateReputation()/overview.html
// mit einem Fehler abbrechen ließe, bevor der Post-Match-Bildschirm erscheint.
// Rein additiv, kein Datenverlust – wirkt nur in-memory für diesen Ladevorgang,
// wird aber spätestens beim nächsten saveClub() dauerhaft persistiert.
function migrateClub(club) {
  if (club.facilities && club.facilities.fanSector && !club.facilities.publicRelations) {
    club.facilities.publicRelations = club.facilities.fanSector;
    delete club.facilities.fanSector;
  }
  // Stadion startet seit dem Ökonomie-Redesign bei Level 1 statt 0 (siehe
  // createClub) – bestehende Vereine hatten faktisch schon immer eine
  // Spielstätte (sie haben ja Matches bestritten), werden also nachträglich
  // kostenlos auf Level 1 gehoben statt für immer bei 0 hängen zu bleiben.
  if (club.facilities && club.facilities.stadium && club.facilities.stadium.level < 1) {
    club.facilities.stadium.level = 1;
  }
}

// Ermittelt alle gespeicherten Club-IDs direkt aus den vorhandenen
// localStorage-Keys (kein separater Index, der veralten könnte).
export function listClubIds() {
  const ids = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(clubKey(''))) ids.push(key.slice(clubKey('').length));
  }
  return ids;
}

export function savePlayer(player) {
  localStorage.setItem(playerKey(player.playerId), JSON.stringify(player));
}

export function loadPlayer(playerId) {
  const raw = localStorage.getItem(playerKey(playerId));
  return raw ? JSON.parse(raw) : null;
}

export function loadPlayers(playerIds) {
  return playerIds.map(loadPlayer).filter(Boolean);
}

// Hall of Fame: Spieler bleiben nach Zwangsrente in localStorage erhalten
// (nur nicht mehr in club.roster) – diese Funktion findet sie direkt über
// die vorhandenen Spieler-Keys, statt eine separate Liste am Club zu führen,
// die veralten könnte (gleiches Prinzip wie listClubIds).
export function loadRetiredPlayersForClub(clubId) {
  const results = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(playerKey(''))) continue;
    const player = JSON.parse(localStorage.getItem(key));
    if (player.clubId === clubId && player.retired) results.push(player);
  }
  return results;
}

// Löscht einen Verein vollständig, "als hätte er nie existiert" (Nutzervorgabe,
// Übersicht "Team löschen"): den Club-Datensatz selbst sowie JEDEN Spieler mit
// diesem clubId - aktiver Kader UND Hall-of-Fame-Ausgeschiedene, die nur noch
// über clubId auffindbar sind (siehe loadRetiredPlayersForClub, gleiches
// Scan-Prinzip, kein separater Index). club.league (Liga-/Saisonstand) lebt
// eingebettet im Club-Objekt selbst und wird damit automatisch mitgelöscht -
// kein separater Aufräumschritt nötig. leagueConfigOverrides (globale
// Regel-Einstellungen in leagueConfig.js) bleiben bewusst unangetastet: das
// ist keine Team-spezifische Einstellung, sondern eine App-weite Präferenz,
// die auch für ein neu gegründetes Team weiterhin gelten soll.
// Erst ALLE zu löschenden Keys in einem reinen Lesedurchlauf sammeln, danach
// erst entfernen - localStorage garantiert keine stabile key(i)-Reihenfolge
// während gleichzeitig Einträge entfernt werden (auch rückwärts iteriert kann
// das Einträge überspringen, empirisch beobachtet), ein zweiphasiger Ansatz
// umgeht das vollständig.
export function deleteClub(clubId) {
  localStorage.removeItem(clubKey(clubId));

  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(playerKey(''))) continue;
    const player = JSON.parse(localStorage.getItem(key));
    if (player.clubId === clubId) keysToRemove.push(key);
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

// Manuelle Sicherung: bündelt Club + kompletten Kader in eine JSON-Datei und
// stößt den Browser-Download an.
export function exportSaveToFile(club) {
  const bundle = { club, players: loadPlayers(club.roster) };
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${club.name || 'hiveball-club'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Manuelles Wiederherstellen: liest eine zuvor exportierte JSON-Datei (z.B.
// aus einem <input type="file">) und schreibt Club + Kader zurück in
// localStorage, damit direkt normal weitergespielt werden kann.
export async function importSaveFromFile(file) {
  const bundle = JSON.parse(await file.text());
  if (!bundle.club || !bundle.club.clubId) {
    throw new Error('Ungültige Save-Datei: kein Club gefunden');
  }
  saveClub(bundle.club);
  for (const player of bundle.players || []) savePlayer(player);
  return bundle;
}
