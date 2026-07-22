// Medizinische Abteilung (Phasenplan Phase 1i, Spezifikation 3.7):
// Behandlungsplätze. Manuelle Zuweisung verletzter Spieler zu
// club.medicalQueue, bis zu config.medical.slotsPerLevel[level] gleichzeitig.
// Die eigentliche Heilwirkung (höhere Reduktion pro Spiel für behandelte
// Spieler) steht in injury.js (healRosterByOneGame) – hier nur die
// Slot-Verwaltung, da sie passiv bei jedem Matchende wirkt statt als
// einmalige Aktion wie beim physischen/Theorie-Training.

import { defaultLeagueConfig } from './leagueConfig.js';
import { saveClub } from './state.js';

export function isInMedicalQueue(playerId, club) {
  return club.medicalQueue.some((entry) => entry.playerId === playerId);
}

function medicalSlotCount(club, config) {
  return config.medical.slotsPerLevel[club.facilities.medical.level];
}

// Prüft, ob ein Spieler zugewiesen werden könnte (Grundlage für die
// Slot-Auswahl in medical.html) – nur verletzte Spieler mit freiem Platz.
export function canAssignToMedicalQueue(player, club, config = defaultLeagueConfig) {
  if (player.injury.gamesRemaining <= 0) return false;
  if (isInMedicalQueue(player.playerId, club)) return true; // steht schon drin
  return club.medicalQueue.length < medicalSlotCount(club, config);
}

export function assignToMedicalQueue(player, club, config = defaultLeagueConfig) {
  if (isInMedicalQueue(player.playerId, club)) return club.medicalQueue;
  if (!canAssignToMedicalQueue(player, club, config)) {
    throw new Error(`${player.name} kann keinem Behandlungsplatz zugewiesen werden`);
  }

  club.medicalQueue.push({ playerId: player.playerId });
  saveClub(club);
  return club.medicalQueue;
}

export function removeFromMedicalQueue(playerId, club) {
  club.medicalQueue = club.medicalQueue.filter((entry) => entry.playerId !== playerId);
  saveClub(club);
  return club.medicalQueue;
}
