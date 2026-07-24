// Vereinskasse (Ökonomie-Redesign, siehe Chat-Zusammenfassung): Gehälter
// gestaffelt nach Matchday-Rolle, Einnahmen aus Zuschauern/Sponsor/Fanshop/
// Catering, Reputationsänderung nach Elo-Prinzip. Reine Auf-/Abbuchungs- bzw.
// Berechnungsfunktionen auf Club-Objekten, angebunden über postMatch.js.

import { defaultLeagueConfig } from './leagueConfig.js';
import { saveClub } from './state.js';

// W<n>-Wurf für die Zuschauereinnahme. Rein lokal, analog zum roll()-Helfer
// in leagueConfig.js (severityTable) – dort nicht exportiert, deshalb hier
// eine eigene, gleich einfache Kopie statt eines Imports.
function rollDie(sides) {
  return 1 + Math.floor(Math.random() * sides);
}

// Zieht die Gehälter aller übergebenen Spieler von der Vereinskasse ab.
// Gestaffelt nach der tatsächlichen Rolle in DIESEM Match (nicht der reinen
// Vor-Match-Nominierung): `playedPlayerIds` (Set von managerPlayerId aus den
// matchResults) markiert jeden, der tatsächlich auf dem Feld stand – auch
// Einwechselspieler, die vor dem Match nur auf der Bank nominiert waren.
// Wer nicht gespielt hat, aber auf der Bank nominiert war, zahlt den
// Bank-Satz; alle übrigen (frei/Reserve) den niedrigsten Satz.
//
// Skill "Sponsor" (Nutzervorgabe): kehrt genau diesen Betrag für den
// betreffenden Spieler um – kein Gehalt fällig, stattdessen derselbe Wert als
// zusätzliche Sponsoreneinnahme für den Verein. Gibt deshalb beide Summen
// getrennt zurück statt nur des Gehalts-Totals.
export function deductSalaries(club, players, playedPlayerIds, config = defaultLeagueConfig) {
  const rates = config.economy.salaryRates;
  let salaryTotal = 0;
  let sponsorSkillIncome = 0;

  for (const p of players) {
    const rate = playedPlayerIds.has(p.playerId)
      ? rates.feld
      : club.lastMatchNomination.bench.includes(p.playerId)
        ? rates.bank
        : rates.frei;
    const amount = Math.round(p.marketValue * rate);

    if (p.skills.includes('Sponsor')) sponsorSkillIncome += amount;
    else salaryTotal += amount;
  }

  club.money += sponsorSkillIncome - salaryTotal;
  saveClub(club);
  return { salaryTotal, sponsorSkillIncome };
}

// Zuschauereinnahme: Reputation bestimmt den Geldwert pro Würfel-Pip, das
// Stadion-Level die Würfelgröße – ein größerer Ausbau hebt Erwartungswert
// UND Obergrenze an, statt nur linear zu skalieren.
function calculateAttendanceIncome(club, config) {
  const cfg = config.economy.attendance;
  const level = club.facilities.stadium.level;
  const sides = cfg.diceSidesByStadiumLevel[level] ?? cfg.diceSidesByStadiumLevel[1];
  const perPip = club.reputation * cfg.reputationFactor;
  return Math.round(perPip * rollDie(sides));
}

// Fanshop: ergebnisunabhängig, skaliert relativ zur Referenz-Reputation
// (z.B. Startwert) – über/unterdurchschnittliche Reputation hebt/senkt die
// Einnahme proportional zum Nennwert des Levels. Exportiert, da auch
// previewNextMatchEconomy (finances.html) sie braucht.
export function calculateFanshopIncome(club, config) {
  const cfg = config.economy.fanshop;
  const base = cfg.baseIncomeByLevel[club.facilities.fanshop.level] ?? 0;
  return Math.round(base * (club.reputation / cfg.reputationReference));
}

// Catering: fester Prozentsatz der übergebenen Zuschauereinnahme, zusätzlich
// zu ihr (kein Abzug von den Eintrittsgeldern) – erbt die
// Reputationsabhängigkeit automatisch von der Zuschauereinnahme, braucht
// keinen eigenen Reputationsfaktor. Der Prozentsatz steigt pro Level
// (teurere Speisen im Angebot). Exportiert wie calculateFanshopIncome.
export function calculateCateringIncome(club, attendanceIncome, config) {
  const percent = config.economy.catering.percentOfAttendanceByLevel[club.facilities.catering.level] ?? 0;
  return Math.round(attendanceIncome * percent);
}

// Sieg-/Spieleinnahmen: Zuschauer (würfelbasiert) + Fanshop + Catering
// (beide ergebnisunabhängig) + Sponsor (fix) + Siegprämie (nur bei Sieg).
// Gibt die Einzelposten zurück statt nur der Summe, damit der Post-Match-
// Bildschirm sie einzeln anzeigen kann, ohne die Formeln zu duplizieren.
export function payMatchIncome(club, won, config = defaultLeagueConfig) {
  const attendance = calculateAttendanceIncome(club, config);
  const fanshop = calculateFanshopIncome(club, config);
  const catering = calculateCateringIncome(club, attendance, config);
  const sponsor = config.economy.sponsorIncome;
  const winBonus = won ? config.economy.winPrize : 0;

  const total = attendance + fanshop + catering + sponsor + winBonus;
  club.money += total;
  saveClub(club);

  return { attendance, fanshop, catering, sponsor, winBonus, total };
}

// Reputationsänderung nach Sieg/Niederlage (Elo-Prinzip): der Erwartungswert
// ergibt sich aus der Differenz zur Gegner-Reputation. opponentReputation
// kommt vom Aufrufer (postMatch.js, via league.js opponentReputation() – die
// feste Startreputation des Liga-Gegners dieses Spieltags, siehe
// opponents.js); ohne Liga-Kontext (Parameter weggelassen) greift der feste
// Platzhalter config.economy.reputation.opponentReputation. Bewusst wie an
// anderer Stelle im Kernspiel (siehe hiveball.html-Kommentar zum
// Post-Match-Bildschirm) nur Sieg/Nicht-Sieg, kein eigenes
// Unentschieden-Signal – das ist ein bestehender, bereits bekannter Gap,
// kein neuer.
// Der PR-Bonus aus dem Öffentlichkeitsarbeit-Level wirkt bewusst asymmetrisch
// (Nutzervorgabe: PR darf nie zu einem Nachteil führen): bei Sieg verstärkt
// er den Gewinn (Multiplikator > 1), bei Niederlage dämpft er den Verlust
// (Multiplikator < 1) – statt wie ein reiner Multiplikator auf die
// Roh-Differenz auch Niederlagen zu vergrößern.
// Reputation wird bei 1 nach unten gedeckelt, damit die Zuschauereinnahme
// (die linear mit Reputation skaliert) nicht ins Negative/degenerieren kann.
export function updateReputation(club, won, config = defaultLeagueConfig, opponentReputation = config.economy.reputation.opponentReputation) {
  const cfg = config.economy.reputation;
  const expected = 1 / (1 + Math.pow(10, (opponentReputation - club.reputation) / cfg.eloScale));
  const actual = won ? 1 : 0;
  const prBonus = cfg.prBonusPerLevel * club.facilities.publicRelations.level;
  const prMultiplier = won ? 1 + prBonus : 1 - prBonus;

  const delta = cfg.k * prMultiplier * (actual - expected);
  club.reputation = Math.max(1, club.reputation + delta);
  saveClub(club);
  return delta;
}

/* ============================================================
   GEBÄUDE-AUSBAU (alle sieben Gebäude aus club.facilities)
   ============================================================ */

const UPGRADABLE_FACILITIES = [
  'stadium', 'fanshop', 'catering',
  'physicalTraining', 'theoryTraining', 'medical', 'publicRelations'
];

// Nur Fanshop/Catering dürfen nie über das aktuelle Stadion-Level hinaus
// ausgebaut werden (Nutzervorgabe) – Trainingscenter/Akademie/Medizinische
// Abteilung/Öffentlichkeitsarbeit haben keine solche Abhängigkeit.
const STADIUM_GATED_FACILITIES = ['fanshop', 'catering'];

// Kosten für den nächsten Levelaufstieg, oder null, wenn keine weitere Stufe
// existiert (config.economy[facilityKey].upgradeCost hat für das aktuelle
// Startlevel keinen Eintrag, z.B. Stadion-Level 1 → 2 ist der erste
// bezahlte Schritt).
export function facilityUpgradeCost(club, facilityKey, config = defaultLeagueConfig) {
  const cfg = config.economy[facilityKey];
  const nextLevel = club.facilities[facilityKey].level + 1;
  return cfg.upgradeCost[nextLevel] ?? null;
}

// Prüft, ob ein Gebäude gerade ausgebaut werden könnte (Grundlage für den
// Button-Zustand in den jeweiligen Gebäude-Seiten): Obergrenze noch nicht
// erreicht, bei Fanshop/Catering zusätzlich nie über das aktuelle
// Stadion-Level hinaus, und genug Geld in der Kasse.
export function canUpgradeFacility(club, facilityKey, config = defaultLeagueConfig) {
  const cfg = config.economy[facilityKey];
  const currentLevel = club.facilities[facilityKey].level;
  if (currentLevel >= cfg.maxLevel) return false;
  if (STADIUM_GATED_FACILITIES.includes(facilityKey) && currentLevel >= club.facilities.stadium.level) return false;

  const cost = facilityUpgradeCost(club, facilityKey, config);
  return cost != null && club.money >= cost;
}

// Führt den Ausbau tatsächlich durch: zieht die Kosten ab, hebt das Level an.
export function upgradeFacility(club, facilityKey, config = defaultLeagueConfig) {
  if (!UPGRADABLE_FACILITIES.includes(facilityKey)) {
    throw new Error(`${facilityKey} ist kein ausbaubares Gebäude`);
  }
  if (!canUpgradeFacility(club, facilityKey, config)) {
    throw new Error(`${facilityKey} kann aktuell nicht ausgebaut werden`);
  }

  const cost = facilityUpgradeCost(club, facilityKey, config);
  club.money -= cost;
  club.facilities[facilityKey].level += 1;
  saveClub(club);
  return club.facilities[facilityKey].level;
}

// Reine Berechnung des laufenden Unterhalts pro Match für alle sieben
// Gebäude (Level 1 ist bei jedem unterhaltsfrei) – keine Mutation, damit
// sowohl deductFacilityUpkeep (mutierend) als auch previewNextMatchEconomy
// (reine Vorschau, finances.html) dieselbe Formel nutzen können.
function calculateFacilityUpkeep(club, config) {
  const upkeepFor = (key) => config.economy[key].upkeepByLevel[club.facilities[key].level] ?? 0;

  const stadium = upkeepFor('stadium');
  const fanshop = upkeepFor('fanshop');
  const catering = upkeepFor('catering');
  const physicalTraining = upkeepFor('physicalTraining');
  const theoryTraining = upkeepFor('theoryTraining');
  const medical = upkeepFor('medical');
  const publicRelations = upkeepFor('publicRelations');

  const total = stadium + fanshop + catering + physicalTraining + theoryTraining + medical + publicRelations;
  return { stadium, fanshop, catering, physicalTraining, theoryTraining, medical, publicRelations, total };
}

// Zieht den laufenden Unterhalt tatsächlich von der Vereinskasse ab. Wird von
// processPostMatch nach den Gehältern abgezogen. Gibt die Einzelposten
// zurück, analog zu payMatchIncome, damit der Post-Match-Bildschirm sie
// einzeln zeigen kann.
export function deductFacilityUpkeep(club, config = defaultLeagueConfig) {
  const upkeep = calculateFacilityUpkeep(club, config);
  club.money -= upkeep.total;
  saveClub(club);
  return upkeep;
}

// Reine Vorschau-Berechnung für den kommenden Spieltag (keine Mutation, kein
// saveClub) – Grundlage für finances.html. Nutzt die aktuelle Matchday-
// Nominierung als Annahme, wer "Feld"/"Bank" sein wird (echte Einwechslungen
// während des künftigen Matches sind naturgemäß nicht im Voraus bekannt).
// Würfelabhängige Posten (aktuell nur die Zuschauereinnahme, und davon
// abgeleitet Catering) werden als statistischer Durchschnitt angegeben
// (Mittelwert des Würfels), nicht als konkreter Wurf – daher `diceSides` und
// `attendanceIsAverage: true` im Rückgabewert, damit die UI das klar
// kennzeichnen kann. Die Siegprämie ist ergebnisabhängig und wird deshalb
// separat ausgewiesen statt in eine Summe eingerechnet.
export function previewNextMatchEconomy(club, players, config = defaultLeagueConfig) {
  const rates = config.economy.salaryRates;
  let salaryTotal = 0;
  let sponsorSkillIncome = 0;
  for (const p of players) {
    const rate = club.lastMatchNomination.starters.includes(p.playerId)
      ? rates.feld
      : club.lastMatchNomination.bench.includes(p.playerId)
        ? rates.bank
        : rates.frei;
    const amount = Math.round(p.marketValue * rate);
    if (p.skills.includes('Sponsor')) sponsorSkillIncome += amount;
    else salaryTotal += amount;
  }

  const attendanceCfg = config.economy.attendance;
  const stadiumLevel = club.facilities.stadium.level;
  const diceSides = attendanceCfg.diceSidesByStadiumLevel[stadiumLevel] ?? attendanceCfg.diceSidesByStadiumLevel[1];
  const avgRoll = (diceSides + 1) / 2;
  const attendance = Math.round(club.reputation * attendanceCfg.reputationFactor * avgRoll);

  const fanshop = calculateFanshopIncome(club, config);
  const catering = calculateCateringIncome(club, attendance, config);
  const sponsor = config.economy.sponsorIncome;
  const winBonus = config.economy.winPrize;

  const facilityUpkeep = calculateFacilityUpkeep(club, config);

  const guaranteedIncome = attendance + fanshop + catering + sponsor + sponsorSkillIncome;
  const netWithoutWin = guaranteedIncome - salaryTotal - facilityUpkeep.total;

  return {
    salaryTotal,
    sponsorSkillIncome,
    income: { attendance, fanshop, catering, sponsor, winBonus },
    facilityUpkeep,
    diceSides,
    attendanceIsAverage: true,
    netWithoutWin,
    netWithWin: netWithoutWin + winBonus
  };
}
