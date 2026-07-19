// Persistente Datenmodelle des Manager-Teils, siehe
// docs/hiveball_manager_spezifikation.md Abschnitt 2. Die hier erzeugten
// Objekte sind die persistente Quelle der Wahrheit, aus der zu Matchbeginn
// die Kernspiel-Spielerobjekte (src/hiveball.html, POSITIONS) erzeugt werden.
// Reine Datenobjekte, keine Persistenz-/UI-Logik (siehe Spezifikation 9.2).

import { POSITIONS_MANAGER_EXT } from './positions.js';
import { defaultLeagueConfig } from './leagueConfig.js';

function createId() {
  return crypto.randomUUID();
}

// Erzeugt ein neues ManagerPlayer-Objekt (Spezifikation 2.1). Attribute und
// Startskill kommen aus POSITIONS_MANAGER_EXT; number muss vom Aufrufer
// eindeutig im Kader vergeben werden (hier nicht prüfbar).
export function createManagerPlayer({ position, name, clubId, number, age = defaultLeagueConfig.aging.startAge }) {
  const base = POSITIONS_MANAGER_EXT[position];
  if (!base) throw new Error(`Unbekannte Position: ${position}`);

  return {
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

    // Basis-Platzhalter (Aufschläge/volle Formel erst Phase 3, siehe Spezifikation 3 Offene Punkte)
    marketValue: base.price,
    retired: false,
    status: 'aktiv'
  };
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
