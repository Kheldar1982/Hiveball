// EP-für-Skills (Phasenplan Phase 1, Spezifikation 3.3/3.4): kauft einen
// Skill auf Bank (bankedSkillPurchases). Das tatsächliche Trainieren über
// Theorie-Slots (Einsteuern aus der Bank in player.skills) folgt erst in
// Phase 1c-Theorie – hier nur der Kaufvorgang selbst.

import { defaultLeagueConfig } from './leagueConfig.js';
import { POSITIONS_MANAGER_EXT } from './positions.js';
import { skillPrice, skillLimit } from './formulas.js';
import { savePlayer } from './state.js';

// Bereits gebankte, aber noch nicht trainierte Käufe zählen sowohl gegen die
// Preis-Eskalation (3.3) als auch gegen das Skill-Limit (3.4), damit nicht
// mehr gekauft werden kann, als der Spieler je trainieren könnte.
export function purchaseSkill(player, club, skill, config = defaultLeagueConfig) {
  const base = POSITIONS_MANAGER_EXT[player.position];
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

  savePlayer(player);
  return player;
}
