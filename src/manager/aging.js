// Aging-System (Phasenplan Phase 1d, Spezifikation 3.5) plus Zwangsrente
// (Formel 3.8, eigentlich Phase 1h): die einzige aktuell erreichbare
// Auslösebedingung für Zwangsrente ("Alter >= forcedRetirementAge oder ein
// physisches Attribut <= 1") folgt direkt aus dem Aging-Verfall, daher schon
// hier mit eingebaut. Die übrigen Phase-1h-Punkte (Verletzungsschwere-Wurf
// 3.6, Ausfallzähler, Nominierungssperre) hängen an Matchergebnissen bzw.
// der Matchday-Nominierung (Phase 1f/1g) und sind nicht Teil dieses Moduls;
// die 8%-Sonderchance auf Zwangsrente bei "Schwerste Verletzung" bleibt
// entsprechend unerreichbar, bis Formel 3.6 existiert.

import { defaultLeagueConfig } from './leagueConfig.js';
import { agePhaseOf, ageFromGamesPlayed, effectiveAgeForPhase, declineChance } from './formulas.js';
import { savePlayer, saveClub } from './state.js';

// Nur diese drei verfallen durchs Aging (Grundprinzipien, Abschnitt 1).
const DECLINABLE_ATTRIBUTES = ['mr', 'ag', 'st'];

function getAttr(player, attr) {
  return attr === 'mr' ? player.mr : player.attributes[attr].current;
}

function setAttr(player, attr, value) {
  if (attr === 'mr') player.mr = value;
  else player.attributes[attr].current = value;
}

// Formel 3.8: Zwangsrente bei Alter >= forcedRetirementAge oder einem
// physischen Attribut <= 1. Entfernt den Spieler aus Kader und Nominierung.
function checkForcedRetirement(player, club, config) {
  const atMinimum = DECLINABLE_ATTRIBUTES.some((attr) => getAttr(player, attr) <= 1);
  if (player.age < config.aging.forcedRetirementAge && !atMinimum) return false;

  player.retired = true;
  player.status = 'im_ruhestand';
  club.roster = club.roster.filter((id) => id !== player.playerId);
  club.lastMatchNomination.starters = club.lastMatchNomination.starters.filter((id) => id !== player.playerId);
  club.lastMatchNomination.bench = club.lastMatchNomination.bench.filter((id) => id !== player.playerId);
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
      const attr = DECLINABLE_ATTRIBUTES[Math.floor(Math.random() * DECLINABLE_ATTRIBUTES.length)];
      setAttr(player, attr, Math.max(1, getAttr(player, attr) - 1));
      result.declined = true;
      result.attribute = attr;
    }

    result.retired = checkForcedRetirement(player, club, config);
  }

  savePlayer(player);
  saveClub(club);
  return result;
}
