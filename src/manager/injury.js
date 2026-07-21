// Verletzungsschwere (Phasenplan Phase 1h, Spezifikation 3.6) + Ausfallzähler
// (automatische Heilung ohne medizinische Beschleunigung – die ist Phase 1i,
// Formel 3.7) + Zwangsrente-Anbindung für die verletzungsbedingten Auslöser
// (Attribut fällt auf <= 1, 8%-Sonderchance bei "Schwerste Verletzung").

import { defaultLeagueConfig } from './leagueConfig.js';
import { declineRandomAttribute, checkForcedRetirement, retirePlayer } from './aging.js';
import { loadPlayer, loadPlayers, savePlayer, saveClub } from './state.js';

function removeFromNomination(playerId, club) {
  club.lastMatchNomination.starters = club.lastMatchNomination.starters.filter((id) => id !== playerId);
  club.lastMatchNomination.bench = club.lastMatchNomination.bench.filter((id) => id !== playerId);
}

// Formel 3.6: Verletzungsschwere für einen im Match ausgeschiedenen Spieler
// (player.injured === true im Kernspiel). Kein Krit-1/10, siehe Spezifikation.
// Entfernt den Spieler außerdem sofort aus der aktuellen Nominierung
// (Nominierungssperre) – er kann ja frühestens in gamesRemaining Spielen
// wieder antreten.
export function applyInjurySeverity(player, club, finalSp, config = defaultLeagueConfig) {
  if (finalSp >= 0) return null; // kein Ausfall, keine Verletzungsschwere nötig

  const überschuss = Math.abs(finalSp);
  const gesamtwert = 1 + Math.floor(Math.random() * 10) + überschuss; // W10, kein Krit
  const entry = config.injury.severityTable.find((e) => gesamtwert <= e.max);

  player.injury.severity = entry.label;
  player.injury.gamesRemaining = entry.gamesOut();
  removeFromNomination(player.playerId, club);

  let attributeLost = null;
  if (entry.attributeLossChance && Math.random() < entry.attributeLossChance) {
    attributeLost = declineRandomAttribute(player);
  }

  let retired = attributeLost ? checkForcedRetirement(player, club, config) : false;
  if (!retired && entry.retirementChance && Math.random() < entry.retirementChance) {
    retirePlayer(player, club);
    retired = true;
  }

  savePlayer(player);
  saveClub(club);

  return { label: entry.label, gamesOut: player.injury.gamesRemaining, attributeLost, retired, gesamtwert };
}

// Ausfallzähler: automatische Heilung von 1 Spiel Ausfallzeit für jeden
// verletzten Spieler im Kader, unabhängig von Behandlung (Formel 3.7 –
// medizinisch beschleunigte Reduktion über medicalQueue folgt in Phase 1i).
export function healRosterByOneGame(club, config = defaultLeagueConfig) {
  const roster = loadPlayers(club.roster);
  for (const player of roster) {
    if (player.injury.gamesRemaining > 0) {
      player.injury.gamesRemaining = Math.max(0, player.injury.gamesRemaining - config.medical.untreatedReductionPerGame);
      if (player.injury.gamesRemaining === 0) player.injury.severity = null;
      savePlayer(player);
    }
  }
}

// Wird am Matchende aufgerufen (siehe hiveball.html endGame-Hook):
// 1) automatische Heilung für den gesamten Kader (Ausfallzähler),
// 2) Verletzungsschwere für alle, die in DIESEM Match ausgeschieden sind.
// matchResults: [{ managerPlayerId, finalSp, wasInjured }]
export function processMatchEndForClub(club, matchResults, config = defaultLeagueConfig) {
  healRosterByOneGame(club, config);

  for (const result of matchResults) {
    if (!result.wasInjured) continue;
    const player = loadPlayer(result.managerPlayerId);
    if (!player) continue;
    applyInjurySeverity(player, club, result.finalSp, config);
  }
}
