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
export function deductSalaries(club, players, playedPlayerIds, config = defaultLeagueConfig) {
  const rates = config.economy.salaryRates;
  const total = players.reduce((sum, p) => {
    const rate = playedPlayerIds.has(p.playerId)
      ? rates.feld
      : club.lastMatchNomination.bench.includes(p.playerId)
        ? rates.bank
        : rates.frei;
    return sum + Math.round(p.marketValue * rate);
  }, 0);

  club.money -= total;
  saveClub(club);
  return total;
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
// Einnahme proportional zum Nennwert des Levels.
function calculateFanshopIncome(club, config) {
  const cfg = config.economy.fanshop;
  const base = cfg.baseIncomeByLevel[club.facilities.fanshop.level] ?? 0;
  return Math.round(base * (club.reputation / cfg.reputationReference));
}

// Catering: fester Prozentsatz der Zuschauereinnahme DIESES Matches,
// zusätzlich zu ihr (kein Abzug von den Eintrittsgeldern) – erbt die
// Reputationsabhängigkeit automatisch von der Zuschauereinnahme, braucht
// keinen eigenen Reputationsfaktor. Der Prozentsatz steigt pro Level
// (teurere Speisen im Angebot).
function calculateCateringIncome(club, attendanceIncome, config) {
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
// ergibt sich aus der Differenz zur Gegner-Reputation (Platzhalter, siehe
// leagueConfig.js – "Red AI" hat noch kein eigenes Vereinsmodell), die
// tatsächliche Abweichung davon wird mit dem PR-Multiplikator aus dem
// Öffentlichkeitsarbeit-Level skaliert. Bewusst wie an anderer Stelle im
// Kernspiel (siehe hiveball.html-Kommentar zum Post-Match-Bildschirm) nur
// Sieg/Nicht-Sieg, kein eigenes Unentschieden-Signal – das ist ein
// bestehender, bereits bekannter Gap, kein neuer.
// Reputation wird bei 1 nach unten gedeckelt, damit die Zuschauereinnahme
// (die linear mit Reputation skaliert) nicht ins Negative/degenerieren kann.
export function updateReputation(club, won, config = defaultLeagueConfig) {
  const cfg = config.economy.reputation;
  const expected = 1 / (1 + Math.pow(10, (cfg.opponentReputation - club.reputation) / cfg.eloScale));
  const actual = won ? 1 : 0;
  const prMultiplier = cfg.prMultiplierByLevel[club.facilities.publicRelations.level] ?? 1;

  const delta = cfg.k * prMultiplier * (actual - expected);
  club.reputation = Math.max(1, club.reputation + delta);
  saveClub(club);
  return delta;
}

/* ============================================================
   GEBÄUDE-AUSBAU (Stadion/Fanshop/Catering)
   ============================================================ */

const UPGRADABLE_FACILITIES = ['stadium', 'fanshop', 'catering'];

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
// Button-Zustand auf stadium.html): Obergrenze noch nicht erreicht, bei
// Fanshop/Catering zusätzlich nie über das aktuelle Stadion-Level hinaus
// (Nutzervorgabe), und genug Geld in der Kasse.
export function canUpgradeFacility(club, facilityKey, config = defaultLeagueConfig) {
  const cfg = config.economy[facilityKey];
  const currentLevel = club.facilities[facilityKey].level;
  if (currentLevel >= cfg.maxLevel) return false;
  if (facilityKey !== 'stadium' && currentLevel >= club.facilities.stadium.level) return false;

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

// Laufender Unterhalt pro Match für Stadion/Fanshop/Catering (Level 1 ist
// bei allen dreien unterhaltsfrei). Wird von processPostMatch nach den
// Gehältern abgezogen. Gibt die Einzelposten zurück, analog zu
// payMatchIncome, damit der Post-Match-Bildschirm sie einzeln zeigen kann.
export function deductFacilityUpkeep(club, config = defaultLeagueConfig) {
  const stadium = config.economy.stadium.upkeepByLevel[club.facilities.stadium.level] ?? 0;
  const fanshop = config.economy.fanshop.upkeepByLevel[club.facilities.fanshop.level] ?? 0;
  const catering = config.economy.catering.upkeepByLevel[club.facilities.catering.level] ?? 0;

  const total = stadium + fanshop + catering;
  club.money -= total;
  saveClub(club);

  return { stadium, fanshop, catering, total };
}
