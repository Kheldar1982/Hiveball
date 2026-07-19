// Rep-basiertes Attributwachstum (Phasenplan Phase 1b, Spezifikation 3.1/3.2).
// Wandelt gesammelte Reps in "trainingsbereit"-Einträge in
// club.trainingQueue.physical um. Das eigentliche Verbrauchen der Reps und
// Erhöhen von attributes[attr].current passiert erst beim Training selbst
// (Phase 1c-Physisch) – hier nur Reps-Sammlung + Schwellen-Erkennung.

import { POSITIONS_MANAGER_EXT } from './positions.js';
import { defaultLeagueConfig } from './leagueConfig.js';
import { agePhaseOf, effectiveReps, repThreshold, maxAttributeValue } from './formulas.js';
import { savePlayer, saveClub } from './state.js';

export const TRAINABLE_ATTRIBUTES = ['bl', 'st', 'co', 'ag', 'pa'];

// "N" aus Formel 3.1: aktueller Wert - Positions-Grundwert + 1 (welcher
// Punkt als nächstes erreicht würde).
export function nextStepFor(player, attr) {
  return player.attributes[attr].current - POSITIONS_MANAGER_EXT[player.position][attr] + 1;
}

function alreadyQueued(club, playerId, attr) {
  return club.trainingQueue.physical.some((entry) => entry.playerId === playerId && entry.attribute === attr);
}

// rawReps sollte bereits pro Spiel auf maxRepsPerGamePerAttribute gedeckelt
// sein (Spezifikation 2.1 "repsThisGame") – diese Deckelung passiert im
// Kernspiel/Post-Match (Phase 1g), hier wird nur noch der Alters-Modifikator
// angewandt und gegen die Schwelle geprüft.
export function creditReps(player, club, attr, rawReps, config = defaultLeagueConfig) {
  if (!TRAINABLE_ATTRIBUTES.includes(attr)) throw new Error(`Nicht trainierbares Attribut: ${attr}`);

  const agePhase = agePhaseOf(player.age, config);
  player.reps[attr] += effectiveReps(rawReps, agePhase, config);

  const atMax = player.attributes[attr].current >= maxAttributeValue(attr, player, club, config);
  if (!atMax) {
    const threshold = repThreshold(nextStepFor(player, attr), config);
    if (player.reps[attr] >= threshold && !alreadyQueued(club, player.playerId, attr)) {
      club.trainingQueue.physical.push({ playerId: player.playerId, attribute: attr });
      saveClub(club);
    }
  }

  savePlayer(player);
  return player;
}
