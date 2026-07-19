// Default-Konfiguration der Liga (Manager-Teil), siehe
// docs/hiveball_manager_spezifikation.md Abschnitt 5. Alle Werte hier sind
// laut Abschnitt 1 der Spezifikation grundsätzlich änderbar (spätere
// Liga-Settings-UI, Phase 1e); Min/Max-Leitplanken je Feld sind noch offen.

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
      Zielwurf: 110,
      "Ruhiger Kopf": 140,
      Dodge: 150
    },
    additionalSkillMultiplier: { 1: 1.0, 2: 1.5, 3: 2.0, 4: 2.5 }
  },

  economy: {
    startingCapital: 200000,
    salaryPercentOfMarketValue: 0.09,
    winPrize: 5000,
    basePricesByPosition: {
      Lineman: 30000,
      Blocker: 50000,
      Werfer: 55000,
      Fänger: 60000,
      Läufer: 65000
    }
    // ticketIncome, fanshopIncome etc. folgen in Phase 2
  },

  roster: {
    maxClubSize: 10,
    maxMatchdayNomination: 8,
    startingLineupSize: 5,
    maxBench: 3,
    maxPerSpecialistPosition: 2 // gilt für Blocker/Werfer/Fänger/Läufer, nicht Lineman
  }
};
