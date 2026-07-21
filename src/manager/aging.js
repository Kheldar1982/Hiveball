// Aging-System (Phasenplan Phase 1d, Spezifikation 3.5) plus Zwangsrente
// (Formel 3.8). Die Attribut-Verfall-/Zwangsrente-Hilfsfunktionen sind
// exportiert, damit injury.js (Phase 1h) sie für die verletzungsbedingten
// Auslöser (Attribut fällt auf <= 1, 8%-Sonderchance bei "Schwerste
// Verletzung") wiederverwenden kann, statt sie zu duplizieren.

import { defaultLeagueConfig } from './leagueConfig.js';
import { agePhaseOf, ageFromGamesPlayed, effectiveAgeForPhase, declineChance } from './formulas.js';
import { savePlayer, saveClub } from './state.js';

// Nur diese drei verfallen durchs Aging bzw. durch Verletzungen (Grundprinzipien, Abschnitt 1).
export const DECLINABLE_ATTRIBUTES = ['mr', 'ag', 'st'];

export function getAttr(player, attr) {
  return attr === 'mr' ? player.mr : player.attributes[attr].current;
}

export function setAttr(player, attr, value) {
  if (attr === 'mr') player.mr = value;
  else player.attributes[attr].current = value;
}

// Senkt ein zufällig gewähltes physisches Attribut um 1 (Minimum 1). Wird
// sowohl vom Aging-Verfall (unten) als auch vom verletzungsbedingten
// Attributverlust (injury.js, Formel 3.6) genutzt.
export function declineRandomAttribute(player) {
  const attr = DECLINABLE_ATTRIBUTES[Math.floor(Math.random() * DECLINABLE_ATTRIBUTES.length)];
  setAttr(player, attr, Math.max(1, getAttr(player, attr) - 1));
  return attr;
}

// Setzt einen Spieler in den Ruhestand: retired/status, entfernt ihn aus
// Kader und aktueller Nominierung (Formel 3.8, letzter Schritt).
export function retirePlayer(player, club) {
  player.retired = true;
  player.status = 'im_ruhestand';
  club.roster = club.roster.filter((id) => id !== player.playerId);
  club.lastMatchNomination.starters = club.lastMatchNomination.starters.filter((id) => id !== player.playerId);
  club.lastMatchNomination.bench = club.lastMatchNomination.bench.filter((id) => id !== player.playerId);
}

// Formel 3.8: Zwangsrente bei Alter >= forcedRetirementAge oder einem
// physischen Attribut <= 1. Gibt zurück, ob der Spieler dadurch in den
// Ruhestand gegangen ist.
export function checkForcedRetirement(player, club, config) {
  const atMinimum = DECLINABLE_ATTRIBUTES.some((attr) => getAttr(player, attr) <= 1);
  if (player.age < config.aging.forcedRetirementAge && !atMinimum) return false;

  retirePlayer(player, club);
  return true;
}

// Simuliert ein gespieltes Spiel: erhöht gamesPlayedTotal, aktualisiert das
// Alter (Formel 3.5). Bei jeder Alterssteigerung (alle gamesPerAgeCycle
// Spiele) wird mit den Regeln der neuen Phase gewürfelt, ob ein physisches
// Attribut (MR, AG oder ST) verfällt (Minimum 1). Prüft danach auf
// Zwangsrente (Formel 3.8).
export function checkAgeCycleAndDecline(player, club, config = defaultLeagueConfig) {
  const oldAge = player.age;

  player.gamesPlayedTotal += 1;
  player.age = ageFromGamesPlayed(player.gamesPlayedTotal, config);

  const result = { agedUp: player.age !== oldAge, declined: false, attribute: null, retired: false };

  if (result.agedUp) {
    const medicalLevel = club.facilities.medical.level;
    const phase = agePhaseOf(effectiveAgeForPhase(player.gamesPlayedTotal, medicalLevel, config), config);
    const chance = declineChance(phase, medicalLevel, config);

    if (Math.random() < chance) {
      result.attribute = declineRandomAttribute(player);
      result.declined = true;
    }

    result.retired = checkForcedRetirement(player, club, config);
  }

  savePlayer(player);
  saveClub(club);
  return result;
}
