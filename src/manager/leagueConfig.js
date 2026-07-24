// Default-Konfiguration der Liga (Manager-Teil), siehe
// docs/hiveball_manager_spezifikation.md Abschnitt 5. Alle Werte hier sind
// laut Abschnitt 1 der Spezifikation grundsätzlich änderbar – seit Phase 1e
// über settings.html editierbar (siehe Persistenz-/Override-Schicht am
// Dateiende). Keine harten Min/Max-Leitplanken je Feld (Abschnitt 11 ließ das
// offen); settings.html erzwingt nur, dass Zahlenfelder nicht negativ sind.

// W<n>-Wurf für die severityTable-Einträge unten (Formel 3.6: "W3+2"/"W4+5").
// Rein lokal, da die Tabelle selbst in dieser Datei lebt und dieser Helfer
// nirgends sonst gebraucht wird.
function roll(sides) {
  return 1 + Math.floor(Math.random() * sides);
}

export const defaultLeagueConfig = {
  training: {
    physical: {
      maxRepsPerGamePerAttribute: 4,
      repsFormula: { base: 10, step: 5 },
      levels: {
        1: { slots: 3 },
        2: { slots: 5 },
        3: { slots: 7, allowDualTraining: true } // Doppeltraining kostet 2 Slots
      }
      // Maximalwert wird NICHT hier konfiguriert, sondern immer als
      // Positions-Grundwert + level berechnet (siehe Spezifikation 3.2)
    },
    theory: {
      levels: {
        1: { slots: 2, skillLimit: 1 },
        2: { slots: 4, skillLimit: 2 },
        3: { slots: 6, skillLimit: 3 }
      },
      skillLimitBonusByAgePhase: { peak: 1, routinier: 1, veteran: 1 } // additiv
    }
  },

  aging: {
    gamesPerAgeCycle: 6,
    startAge: 20,
    phases: {
      talent:    { maxAge: 23, repsModifier: 0.7, declineChance: 0.0 },
      peak:      { maxAge: 29, repsModifier: 1.0, declineChance: 0.0 },
      routinier: { maxAge: 32, repsModifier: 1.0, declineChance: 0.2 },
      veteran:   { maxAge: 35, repsModifier: 1.5, declineChance: 0.4 },
      careerEnd: { maxAge: 37, repsModifier: null, declineChance: 1.0 }
    },
    forcedRetirementAge: 38,
    medicalDeclineReduction: { 1: 0.0, 2: 0.10, 3: 0.20 }, // Level 1 = kein Bonus
    medicalPhaseDelayGames:  { 1: 0, 2: 2, 3: 4 }
  },

  injury: {
    severityTable: [
      { max: 4,  label: "Geprellt",             gamesOut: () => 0 },
      { max: 7,  label: "Angeschlagen",          gamesOut: () => 1 },
      { max: 11, label: "Verletzt",              gamesOut: () => 2 },
      { max: 15, label: "Schwer verletzt",       gamesOut: () => roll(3) + 2,
        attributeLossChance: 0.20 },
      { max: Infinity, label: "Schwerste Verletzung", gamesOut: () => roll(4) + 5,
        attributeLossChance: 1.0, retirementChance: 0.08 }
    ]
  },

  medical: {
    slotsPerLevel: { 1: 1, 2: 2, 3: 3 },
    // Gesamtreduktion pro Spiel MIT Behandlung = 1 (automatisch) + level
    treatedReductionPerGame: { 1: 2, 2: 3, 3: 4 },
    untreatedReductionPerGame: 1
  },

  xp: {
    perAction: {
      participation: 3,
      touchdown: 8,
      passComplete: 3,
      catch: 3,
      blockWon: 3,
      dodgeSurvived: 2,
      teamWin: 5,
      mvp: 6
    },
    bonuses: {
      bomb: 1,
      longRunTD: 1,
      underdogBlock: 1
    },
    skillCosts: {
      Blitz: 100,
      Block: 100,
      Zielwurf: 100,
      "Ruhiger Kopf": 125,
      Dodge: 150,
      // Ökonomie-Skill (kein Kernspiel-Effekt): kehrt das Gehalt dieses
      // Spielers am Matchende in Sponsoreneinnahme um, siehe economy.js
      // deductSalaries.
      Sponsor: 125,
      // Platzhalter-Preise, gerne anpassen: Ballsicher/Trittsicher als
      // einfache situative +1-Boni günstiger, Robust/Gewandt teurer, da sie
      // bei (fast) jedem Block/Tackle wirken.
      Rückendeckung: 110,
      Ballsicher: 100,
      Robust: 125,
      Gewandt: 125,
      "Zweite Luft": 110,
      Trittsicher: 100,
      Hinterhältig: 110
    },
    additionalSkillMultiplier: { 1: 1.0, 2: 1.5, 3: 2.0, 4: 2.5 }
  },

  economy: {
    startingCapital: 200000,

    // Gehälter (Ökonomie-Redesign): gestaffelt nach der tatsächlichen Rolle
    // in DIESEM Match, nicht nach der reinen Vor-Match-Nominierung – siehe
    // economy.js deductSalaries. "feld" gilt auch für Spieler, die erst durch
    // Einwechslung während des Matches aufs Feld kamen.
    salaryRates: {
      feld: 0.10,
      bank: 0.05,
      frei: 0.02
    },

    winPrize: 8000,
    sponsorIncome: 20000,

    // Zuschauereinnahme = (Reputation * reputationFactor) * Würfelergebnis.
    // Die Würfelgröße hängt vom Stadion-Level ab – jede Stufe verbessert den
    // Würfel spürbar, größere Sprünge bei den teureren oberen Stufen.
    attendance: {
      reputationFactor: 100,
      diceSidesByStadiumLevel: { 1: 6, 2: 8, 3: 10, 4: 15, 5: 20 }
    },

    // Stadion: kein eigener Ertrag, nur der Würfel-Hebel oben + die
    // Obergrenze für Fanshop/Catering (siehe canUpgradeFacility). Startet bei
    // Level 1 (kostenlos, Teil der Vereinsgründung – ein Verein braucht immer
    // irgendeine Spielstätte, "Level 0" ergibt keinen Sinn). upgradeCost hat
    // deshalb keinen Eintrag für Level 1.
    stadium: {
      maxLevel: 5,
      upgradeCost: { 2: 60000, 3: 150000, 4: 375000, 5: 900000 },
      upkeepByLevel: { 1: 0, 2: 6000, 3: 13500, 4: 37000, 5: 67000 }
    },

    // Fanshop: ergebnisunabhängig, skaliert relativ zur Referenz-Reputation
    // (Startwert). Darf nie über das aktuelle Stadion-Level hinaus ausgebaut
    // werden (siehe economy.js canUpgradeFacility).
    fanshop: {
      baseIncomeByLevel: { 0: 0, 1: 3000, 2: 6000, 3: 10000, 4: 15000, 5: 21000 },
      reputationReference: 50,
      maxLevel: 5,
      upgradeCost: { 1: 15000, 2: 40000, 3: 95000, 4: 235000, 5: 585000 },
      upkeepByLevel: { 1: 0, 2: 3500, 3: 8200, 4: 12000, 5: 17400 }
    },

    // Catering: fester Prozentsatz der Zuschauereinnahme DIESES Matches,
    // zusätzlich zu ihr (kein Abzug) – die Reputationsabhängigkeit kommt so
    // automatisch über die Zuschauereinnahme mit, braucht keinen eigenen
    // Reputationsfaktor. Prozentsatz steigt pro Level (teurere Speisen). Auch
    // hier gilt die Stadion-Obergrenze.
    catering: {
      percentOfAttendanceByLevel: { 0: 0, 1: 0.05, 2: 0.08, 3: 0.12, 4: 0.17, 5: 0.23 },
      maxLevel: 5,
      upgradeCost: { 1: 5000, 2: 12000, 3: 30000, 4: 75000, 5: 190000 },
      upkeepByLevel: { 1: 0, 2: 1300, 3: 2700, 4: 3700, 5: 5300 }
    },

    // Reputationsänderung nach Elo-Prinzip (economy.js updateReputation).
    // opponentReputation ist nur noch der Fallback ohne Liga-Kontext (z.B.
    // sehr alter Spielstand ohne club.league) – der Normalfall zieht die
    // feste Startreputation des tatsächlichen Liga-Gegners aus
    // opponents.js/league.js (50/60/70/80/90 nach Stärke-Rang, siehe
    // postMatch.js). prBonusPerLevel kommt vom Level der Öffentlichkeitsarbeit
    // und wirkt bewusst asymmetrisch (Nutzervorgabe: PR darf nie schaden) –
    // bei Sieg (1 + Level*Bonus) verstärkt den Gewinn, bei Niederlage
    // (1 - Level*Bonus) dämpft den Verlust, statt ihn wie ein reiner
    // Multiplikator zu vergrößern.
    reputation: {
      opponentReputation: 50,
      k: 6,
      eloScale: 50,
      prBonusPerLevel: 0.1
    },

    // Trainingscenter/Akademie: direkt kaderwirksam (mehr Trainings-/
    // Skill-Slots pro Zyklus), deshalb teurer als die reinen
    // Wirtschaftsgebäude. Gehen aktuell nur bis Level 3 (siehe
    // training.physical.levels/training.theory.levels) – Level 4-5 sind laut
    // Spezifikation explizit erst Phase 3.
    physicalTraining: {
      maxLevel: 3,
      upgradeCost: { 2: 50000, 3: 125000 },
      upkeepByLevel: { 1: 0, 2: 7000, 3: 16000 }
    },
    theoryTraining: {
      maxLevel: 3,
      upgradeCost: { 2: 50000, 3: 125000 },
      upkeepByLevel: { 1: 0, 2: 7000, 3: 16000 }
    },

    // Medizinische Abteilung: etwas günstiger als Trainingscenter/Akademie,
    // wichtig für Kadertiefe/Langlebigkeit, aber weniger direkt
    // leistungssteigernd. Ebenfalls nur bis Level 3 (medical.slotsPerLevel).
    medical: {
      maxLevel: 3,
      upgradeCost: { 2: 35000, 3: 90000 },
      upkeepByLevel: { 1: 0, 2: 5000, 3: 11000 }
    },

    // Öffentlichkeitsarbeit: moderater bepreist als Fanshop, da der Nutzen
    // (PR-Bonus oben) zweischneidig ist – anders als reine Zusatzeinnahmen
    // ohne jedes Risiko.
    publicRelations: {
      maxLevel: 5,
      upgradeCost: { 1: 10000, 2: 25000, 3: 60000, 4: 150000, 5: 375000 },
      upkeepByLevel: { 1: 0, 2: 3000, 3: 7000, 4: 16000, 5: 35000 }
    },

    basePricesByPosition: {
      Lineman: 30000,
      Blocker: 50000,
      Werfer: 55000,
      Fänger: 60000,
      Läufer: 65000
    },
    // Marktwert = Kaufwert (Basispreis der Position) + Aufschläge für
    // Fortschritt gegenüber dem Positions-Grundzustand (siehe formulas.js
    // calculateMarketValue). Ersetzt den reinen Phase-3-Platzhalter.
    marketValue: {
      perExtraAttributePoint: 2500,
      perExtraSkill: 10000
    }
  },

  roster: {
    maxClubSize: 12,
    maxMatchdayNomination: 8,
    startingLineupSize: 5,
    maxBench: 3,
    // Gilt für Blocker/Werfer/Fänger/Läufer (nicht Lineman), aber nur für
    // gleichzeitigen "Feld"-Status in der Matchday-Nominierung – keine
    // Ownership-Obergrenze. Ein Verein darf z.B. 3 Blocker besitzen, es
    // dürfen nur nie mehr als 2 davon gleichzeitig auf "Feld" stehen
    // (gilt später auch für Auswechslungen bei Verletzten).
    maxPerSpecialistPosition: 2
  }
};

/* ============================================================
   SETTINGS-UI (Phase 1e): lebender Override von defaultLeagueConfig
   ============================================================ */
// Bereiche, die über settings.html editierbar sind. injury.severityTable
// bleibt bewusst außen vor (Nutzer-Entscheidung): die Einträge enthalten
// Wurf-Funktionen (gamesOut), die sich nicht als Zahlenfeld abbilden oder
// nach JSON serialisieren lassen.
const EDITABLE_SECTIONS = ['training', 'aging', 'medical', 'xp', 'economy', 'roster'];

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

// Setzt jeden Blattwert aus source in target, ohne bestehende
// Zwischen-Objekte im Ziel zu ersetzen – alle 15+ Verbraucher-Dateien lesen
// defaultLeagueConfig per Objektreferenz zur Laufzeit, eine In-Place-Mutation
// der Blattwerte reicht deshalb aus (kein Re-Export nötig, keine Datei muss
// dafür angepasst werden).
function deepAssign(target, source) {
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {};
      deepAssign(target[key], value);
    } else {
      target[key] = value;
    }
  }
}

// Werksdefaults der editierbaren Bereiche, eingefroren BEVOR ein evtl.
// gespeicherter Override angewendet wird – Grundlage für "Zurücksetzen auf
// Standard" im Settings-UI.
export const factoryLeagueConfigDefaults = {};
for (const key of EDITABLE_SECTIONS) factoryLeagueConfigDefaults[key] = deepClone(defaultLeagueConfig[key]);

const OVERRIDES_STORAGE_KEY = 'hiveball:leagueConfigOverrides';

function applyStoredOverrides() {
  const raw = localStorage.getItem(OVERRIDES_STORAGE_KEY);
  if (!raw) return;
  deepAssign(defaultLeagueConfig, JSON.parse(raw));
}
applyStoredOverrides();

// Speichert einen (Teil-)Override der editierbaren Bereiche: mutiert das
// lebende defaultLeagueConfig sofort und persistiert zusätzlich in
// localStorage, damit er auch nach einem Reload wieder angewendet wird.
export function saveLeagueConfigOverrides(partial) {
  deepAssign(defaultLeagueConfig, partial);

  const raw = localStorage.getItem(OVERRIDES_STORAGE_KEY);
  const stored = raw ? JSON.parse(raw) : {};
  deepAssign(stored, partial);
  localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(stored));
}

// Setzt alle editierbaren Bereiche auf die Werksdefaults zurück und löscht
// den gespeicherten Override vollständig.
export function resetLeagueConfigToDefaults() {
  for (const key of EDITABLE_SECTIONS) {
    deepAssign(defaultLeagueConfig[key], factoryLeagueConfigDefaults[key]);
  }
  localStorage.removeItem(OVERRIDES_STORAGE_KEY);
}
