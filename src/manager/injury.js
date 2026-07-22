// Verletzungsschwere (Phasenplan Phase 1h, Spezifikation 3.6) + Ausfallzähler
// (automatische Heilung ohne medizinische Beschleunigung – die ist Phase 1i,
// Formel 3.7) + Zwangsrente-Anbindung für die verletzungsbedingten Auslöser
// (Attribut fällt auf <= 1, 8%-Sonderchance bei "Schwerste Verletzung").

import { defaultLeagueConfig } from './leagueConfig.js';
import { declineRandomAttribute, checkForcedRetirement, retirePlayer, checkAgeCycleAndDecline } from './aging.js';
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
    retirePlayer(player, club, 'Schwerste Verletzung');
    retired = true;
  }

  savePlayer(player);
  saveClub(club);

  return { label: entry.label, gamesOut: player.injury.gamesRemaining, attributeLost, retired, gesamtwert };
}

// Ausfallzähler (Formel 3.7): automatische Heilung von 1 Spiel Ausfallzeit
// für jeden verletzten Spieler im Kader, unabhängig von Behandlung. Steht der
// Spieler zusätzlich in club.medicalQueue (manuell zugewiesener
// Behandlungsplatz, siehe medical.js/Phase 1i), gilt stattdessen die höhere
// medizinisch beschleunigte Reduktion nach Gebäude-Level. Ein vollständig
// geheilter Spieler gibt seinen Behandlungsplatz automatisch wieder frei.
export function healRosterByOneGame(club, config = defaultLeagueConfig) {
  const medicalLevel = club.facilities.medical.level;
  const roster = loadPlayers(club.roster);
  let queueChanged = false;

  for (const player of roster) {
    if (player.injury.gamesRemaining > 0) {
      const treated = club.medicalQueue.some((entry) => entry.playerId === player.playerId);
      const reduction = treated ? config.medical.treatedReductionPerGame[medicalLevel] : config.medical.untreatedReductionPerGame;

      player.injury.gamesRemaining = Math.max(0, player.injury.gamesRemaining - reduction);
      if (player.injury.gamesRemaining === 0) {
        player.injury.severity = null;
        if (treated) {
          club.medicalQueue = club.medicalQueue.filter((entry) => entry.playerId !== player.playerId);
          queueChanged = true;
        }
      }
      savePlayer(player);
    }
  }

  if (queueChanged) saveClub(club);
}

// Wird am Matchende aufgerufen (siehe hiveball.html endGame-Hook):
// 1) automatische Heilung für den gesamten Kader (Ausfallzähler, auch für
//    nicht am Match beteiligte Spieler),
// 2) für jeden am Match beteiligten Spieler: Karriere-Statistik fortschreiben,
//    Alterszyklus/Verfall/Zwangsrente (dasselbe checkAgeCycleAndDecline wie
//    der Debug-Button "Spiele simulieren" – echte Matches zählen jetzt genauso
//    als gespieltes Spiel, sonst liefen gamesPlayedTotal und age auseinander),
// 3) Verletzungsschwere für alle, die in DIESEM Match ausgeschieden sind.
// matchResults: [{ managerPlayerId, finalSp, wasInjured, touchdowns, injuriesCaused }]
export function processMatchEndForClub(club, matchResults, config = defaultLeagueConfig) {
  healRosterByOneGame(club, config);

  for (const result of matchResults) {
    const player = loadPlayer(result.managerPlayerId);
    if (!player || player.retired) continue;

    player.careerTouchdowns += result.touchdowns || 0;
    player.careerInjuriesCaused += result.injuriesCaused || 0;
    savePlayer(player);

    checkAgeCycleAndDecline(player, club, config);

    if (result.wasInjured) {
      applyInjurySeverity(player, club, result.finalSp, config);
    }
  }
}
