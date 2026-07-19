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
      fanSector: { level: 0 },
      fanshop: { level: 0 },
      catering: { level: 0 },
      stadium: { level: 0 }
    },

    trainingQueue: {
      physical: [],
      theory: []
    },
    medicalQueue: [],

    lastMatchNomination: {
      starters: [],
      bench: []
    }
  };
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
  return raw ? JSON.parse(raw) : null;
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
