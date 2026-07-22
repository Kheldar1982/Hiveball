// Post-Match-Verarbeitung (Phasenplan Phase 1j, Spezifikation Abschnitt 4 +
// Abschnitt 7 Punkte 5+6): zentraler Einstiegspunkt, den hiveball.html am
// Matchende (processManagerPostMatch) aufruft. Baut auf den schon
// vorhandenen Bausteinen auf – injury.js (Heilung/Verletzungsschwere),
// aging.js (Alterszyklus), training.js (Reps/Warteschlange), economy.js
// (Vereinskasse) – und bündelt sie zur in Abschnitt 4 beschriebenen
// EP-Vergabe + Reps-Gutschrift pro Spieler.
//
// matchResults: Array von Objekten, eines pro am Match beteiligtem
// Manager-Spieler (siehe processManagerPostMatch in hiveball.html):
// {
//   managerPlayerId, finalSp, wasInjured, touchdowns, injuriesCaused,
//   passesCompleted, catches, blocksWon, dodgesSurvived, bombsCompleted,
//   underdogBlocksWon, repsGained: { bl, st, co, ag, pa }
// }

import { defaultLeagueConfig } from './leagueConfig.js';
import { loadPlayer, loadPlayers, savePlayer } from './state.js';
import { healRosterByOneGame, applyInjurySeverity } from './injury.js';
import { checkAgeCycleAndDecline } from './aging.js';
import { creditReps, TRAINABLE_ATTRIBUTES } from './training.js';
import { deductSalaries, payMatchIncome } from './economy.js';

// MVP (Spezifikation Abschnitt 4): höchste Summe aus Touchdowns, gewonnenen
// Blocks, Fängen, abgeschlossenen Pässen und überstandenen Tackles im Match.
function determineMvpId(matchResults) {
  let bestId = null;
  let bestScore = -Infinity;
  for (const result of matchResults) {
    const score = (result.touchdowns || 0) + (result.blocksWon || 0) + (result.catches || 0) +
      (result.passesCompleted || 0) + (result.dodgesSurvived || 0);
    if (score > bestScore) {
      bestScore = score;
      bestId = result.managerPlayerId;
    }
  }
  return bestId;
}

function calculateXp(result, won, isMvp, config) {
  const perAction = config.xp.perAction;
  const bonuses = config.xp.bonuses;

  let xp = perAction.participation;
  xp += (result.touchdowns || 0) * perAction.touchdown;
  xp += (result.passesCompleted || 0) * perAction.passComplete;
  xp += (result.catches || 0) * perAction.catch;
  xp += (result.blocksWon || 0) * perAction.blockWon;
  xp += (result.dodgesSurvived || 0) * perAction.dodgeSurvived;
  xp += (result.bombsCompleted || 0) * bonuses.bomb;
  xp += (result.underdogBlocksWon || 0) * bonuses.underdogBlock;
  if (won) xp += perAction.teamWin;
  if (isMvp) xp += perAction.mvp;

  return xp;
}

// Wird am Matchende aufgerufen (siehe hiveball.html endGame/processManagerPostMatch):
// 1) automatische Heilung für den gesamten Kader (Ausfallzähler, auch für
//    nicht am Match beteiligte Spieler),
// 2) für jeden am Match beteiligten Spieler: Karriere-Statistik, EP-Vergabe
//    (Abschnitt 4), Reps-Gutschrift (Abschnitt 3.1, inkl. Trainings-Warteschlange
//    bei erreichter Schwelle), Alterszyklus/Verfall/Zwangsrente,
// 3) Verletzungsschwere für alle, die in DIESEM Match ausgeschieden sind,
// 4) Gehaltsabzug + Sieg-/Spieleinnahmen für den Verein (einmal, nicht pro Spieler).
export function processPostMatch(club, matchResults, won, config = defaultLeagueConfig) {
  healRosterByOneGame(club, config);

  const mvpId = determineMvpId(matchResults);

  for (const result of matchResults) {
    const player = loadPlayer(result.managerPlayerId);
    if (!player || player.retired) continue;

    player.careerTouchdowns += result.touchdowns || 0;
    player.careerInjuriesCaused += result.injuriesCaused || 0;
    player.xp += calculateXp(result, won, result.managerPlayerId === mvpId, config);
    savePlayer(player);

    for (const attr of TRAINABLE_ATTRIBUTES) {
      const rawReps = result.repsGained?.[attr] || 0;
      if (rawReps > 0) creditReps(player, club, attr, rawReps, config);
    }

    checkAgeCycleAndDecline(player, club, config);

    if (result.wasInjured) {
      applyInjurySeverity(player, club, result.finalSp, config);
    }
  }

  const roster = loadPlayers(club.roster);
  deductSalaries(club, roster, config);
  payMatchIncome(club, won, config);
}
