// Gemeinsame Ausbau-Zeile für Gebäude-Seiten (Stadion, Trainingscenter,
// Akademie, Medizinische Abteilung, Öffentlichkeitsarbeit) – Icon, Name,
// Level/Max, Ausbau-Button mit Kosten. Ursprünglich einzeln in stadium.html
// gebaut; hier extrahiert, sobald mehrere Seiten dieselbe Darstellung
// brauchten (siehe economy.js facilityUpgradeCost/canUpgradeFacility/
// upgradeFacility für die eigentliche Logik).

import { facilityUpgradeCost, canUpgradeFacility, upgradeFacility } from './economy.js';
import { defaultLeagueConfig } from './leagueConfig.js';

const EUR = (n) => `${n.toLocaleString('de-DE')} €`;

// maxLevelFromKey: optional, für Fanshop/Catering, deren Obergrenze vom
// Stadion-Level abhängt (siehe economy.js STADIUM_GATED_FACILITIES) – zeigt
// einen zusätzlichen Hinweis, warum der Button trotz vorhandenem Geld
// gesperrt sein könnte.
export function renderFacilityUpgradeRow(club, facilityKey, icon, name, onUpgrade, maxLevelFromKey = null) {
  const cfg = defaultLeagueConfig.economy[facilityKey];
  const level = club.facilities[facilityKey].level;

  const row = document.createElement('div');
  row.className = 'facility-row';

  const iconEl = document.createElement('div');
  iconEl.className = 'facility-icon';
  iconEl.textContent = icon;
  row.appendChild(iconEl);

  const nameEl = document.createElement('div');
  nameEl.className = 'facility-name';
  nameEl.textContent = name;
  row.appendChild(nameEl);

  const currentUpkeep = cfg.upkeepByLevel[level] ?? 0;

  const levelEl = document.createElement('div');
  levelEl.className = 'facility-level';
  levelEl.appendChild(document.createTextNode(`Level ${level} / ${cfg.maxLevel}`));
  const upkeepHint = document.createElement('div');
  upkeepHint.className = 'hint';
  upkeepHint.textContent = `Unterhalt: ${EUR(currentUpkeep)} / Match`;
  levelEl.appendChild(upkeepHint);
  if (maxLevelFromKey) {
    const maxLevel = club.facilities[maxLevelFromKey].level;
    const maxHint = document.createElement('div');
    maxHint.className = 'hint';
    maxHint.textContent = `(max. ${maxLevel}, durch Stadion begrenzt)`;
    levelEl.appendChild(maxHint);
  }
  row.appendChild(levelEl);

  const cost = document.createElement('span');
  cost.className = 'facility-cost hint';

  const upgradeBtn = document.createElement('button');
  const nextCost = facilityUpgradeCost(club, facilityKey, defaultLeagueConfig);

  if (nextCost == null) {
    upgradeBtn.textContent = 'Maximales Level erreicht';
    upgradeBtn.disabled = true;
    cost.textContent = '–';
  } else {
    const nextUpkeep = cfg.upkeepByLevel[level + 1] ?? 0;
    upgradeBtn.textContent = `Level erhöhen (auf ${level + 1})`;
    cost.textContent = `Kosten: ${EUR(nextCost)} (künftiger Unterhalt: ${EUR(nextUpkeep)} / Match)`;
    const canUpgrade = canUpgradeFacility(club, facilityKey, defaultLeagueConfig);
    upgradeBtn.disabled = !canUpgrade;
    if (!canUpgrade) {
      upgradeBtn.title = maxLevelFromKey && level >= club.facilities[maxLevelFromKey].level
        ? 'Erst das Stadion weiter ausbauen'
        : 'Nicht genug Geld in der Vereinskasse';
    }
    upgradeBtn.addEventListener('click', () => {
      upgradeFacility(club, facilityKey, defaultLeagueConfig);
      onUpgrade();
    });
  }
  row.appendChild(upgradeBtn);
  row.appendChild(cost);

  return row;
}
