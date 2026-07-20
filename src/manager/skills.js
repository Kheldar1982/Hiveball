// EP-für-Skills (Phasenplan Phase 1, Spezifikation 3.3/3.4) plus das
// eigentliche Theorie-Training (Phase 1c-Theorie): Kauf legt einen Eintrag
// in player.bankedSkillPurchases UND club.trainingQueue.theory an (Spezifikation
// 2.2: "bezahlt, wartet auf Slot"); das tatsächliche Einsteuern in
// player.skills passiert danach im Akademiegebäude (academy.html) gegen
// einen Theorie-Slot.

import { defaultLeagueConfig } from './leagueConfig.js';
import { POSITIONS_MANAGER_EXT } from './positions.js';
import { skillPrice, skillLimit } from './formulas.js';
import { savePlayer, saveClub } from './state.js';

// Bereits gebankte, aber noch nicht trainierte Käufe zählen sowohl gegen die
// Preis-Eskalation (3.3) als auch gegen das Skill-Limit (3.4), damit nicht
// mehr gekauft werden kann, als der Spieler je trainieren könnte.
export function purchaseSkill(player, club, skill, config = defaultLeagueConfig) {
  const base = POSITIONS_MANAGER_EXT[player.position];

  if (player.skills.includes(skill) || player.bankedSkillPurchases.some((b) => b.skill === skill)) {
    throw new Error(`${player.name} hat ${skill} bereits oder wartet schon darauf`);
  }

  const alreadyPurchasedAdditional = (player.skills.length - base.skills.length) + player.bankedSkillPurchases.length;

  const limit = skillLimit(player, club, config);
  const totalSkills = player.skills.length + player.bankedSkillPurchases.length;
  if (totalSkills >= limit) {
    throw new Error(`Skill-Limit erreicht (${limit})`);
  }

  const price = skillPrice(skill, alreadyPurchasedAdditional + 1, config);
  if (player.xp < price) {
    throw new Error(`Nicht genug EP: ${player.xp} < ${price}`);
  }

  player.xp -= price;
  player.bankedSkillPurchases.push({ skill, paidEp: price, purchaseDate: Date.now() });
  club.trainingQueue.theory.push({ playerId: player.playerId, skill });

  saveClub(club);
  savePlayer(player);
  return player;
}

// Verarbeitet einen Theorie-Slot im Akademiegebäude: verschiebt den Skill
// von bankedSkillPurchases/trainingQueue.theory tatsächlich in player.skills.
export function trainSkill(player, club, skill, config = defaultLeagueConfig) {
  const queueIndex = club.trainingQueue.theory.findIndex(
    (entry) => entry.playerId === player.playerId && entry.skill === skill
  );
  if (queueIndex === -1) {
    throw new Error(`${player.name} steht für ${skill} nicht in der Theorie-Warteschlange`);
  }

  const bankedIndex = player.bankedSkillPurchases.findIndex((b) => b.skill === skill);
  if (bankedIndex !== -1) player.bankedSkillPurchases.splice(bankedIndex, 1);

  player.skills.push(skill);
  club.trainingQueue.theory.splice(queueIndex, 1);

  saveClub(club);
  savePlayer(player);
  return player;
}
