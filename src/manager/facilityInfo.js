// Beschreibt die Ausbaupfade aller sieben Gebäude (Kosten/Unterhalt aus
// leagueConfig.js economy.<key>, Wirkung aus den jeweils zuständigen
// Config-Abschnitten) - einzige Datenquelle für help.html. Rein informativ,
// ohne Bezug zu einem konkreten Verein (zeigt die statische Konfiguration,
// nicht den Stand eines bestimmten Clubs).

import { defaultLeagueConfig as cfg } from './leagueConfig.js';

const EUR = (n) => `${n.toLocaleString('de-DE')} €`;

function effectPhysicalTraining(level) {
  const l = cfg.training.physical.levels[level];
  const dual = l.allowDualTraining ? ' (Doppeltraining möglich)' : '';
  return `${l.slots} Trainings-Slots${dual}, Attribut-Obergrenze = Positions-Grundwert + ${level}`;
}

function effectTheoryTraining(level) {
  const l = cfg.training.theory.levels[level];
  return `${l.slots} Theorie-Slots, Skill-Limit ${l.skillLimit} (+1 je erreichter Alterphase ab Peak)`;
}

function effectMedical(level) {
  const slots = cfg.medical.slotsPerLevel[level];
  const heal = cfg.medical.treatedReductionPerGame[level];
  const declineReduction = Math.round(cfg.aging.medicalDeclineReduction[level] * 100);
  const delay = cfg.aging.medicalPhaseDelayGames[level];
  const declineText = declineReduction > 0 ? `, Alters-Verfallchance -${declineReduction} %` : '';
  const delayText = delay > 0 ? `, Phasenübergang +${delay} Spiele verzögert` : '';
  return `${slots} Behandlungsplatz/-plätze, Heilung ${heal} Spiele Ausfallzeit/Match${declineText}${delayText}`;
}

function effectStadium(level) {
  const dice = cfg.economy.attendance.diceSidesByStadiumLevel[level];
  return `Zuschauer-Würfel W${dice}, Fanshop/Catering bis Level ${level} ausbaubar`;
}

function effectFanshop(level) {
  const income = cfg.economy.fanshop.baseIncomeByLevel[level] ?? 0;
  return income > 0 ? `${EUR(income)} Zusatzeinnahme / Match` : 'keine Zusatzeinnahme (noch nicht gebaut)';
}

function effectCatering(level) {
  const pct = cfg.economy.catering.percentOfAttendanceByLevel[level] ?? 0;
  return pct > 0 ? `+${Math.round(pct * 100)} % der Zuschauereinnahme zusätzlich` : 'kein Catering-Bonus (noch nicht gebaut)';
}

function effectPublicRelations(level) {
  const bonus = Math.round(cfg.economy.reputation.prBonusPerLevel * level * 100);
  return bonus > 0
    ? `Sieg-Gewinn +${bonus} %, Niederlage-Verlust um ${bonus} % gedämpft`
    : 'kein PR-Bonus (noch nicht gebaut)';
}

// key = identisch zu club.facilities/economy.<key>. startLevel = niedrigstes
// existierendes Level (0 bei den vier "Wirtschaftsgebäuden", die ein Verein
// erst bauen muss; 1 bei den vier Gebäuden, die von Anfang an existieren).
export const FACILITIES_INFO = [
  { key: 'physicalTraining', icon: '🏋️', name: 'Trainingscenter', startLevel: 1, effect: effectPhysicalTraining },
  { key: 'theoryTraining', icon: '📘', name: 'Akademie', startLevel: 1, effect: effectTheoryTraining },
  { key: 'medical', icon: '🚑', name: 'Medizinische Abteilung', startLevel: 1, effect: effectMedical },
  { key: 'stadium', icon: '🏟️', name: 'Stadion', startLevel: 1, effect: effectStadium },
  { key: 'fanshop', icon: '🛍️', name: 'Fanshop', startLevel: 0, effect: effectFanshop },
  { key: 'catering', icon: '🌭', name: 'Catering', startLevel: 0, effect: effectCatering },
  { key: 'publicRelations', icon: '📣', name: 'Öffentlichkeitsarbeit', startLevel: 0, effect: effectPublicRelations },
];

// Liefert die vollständige Ausbautabelle für ein Gebäude: eine Zeile je
// Level von startLevel bis maxLevel. cost=null markiert die kostenlose
// Startstufe (kein upgradeCost-Eintrag für dieses Level).
export function facilityLevelRows(key) {
  const facility = FACILITIES_INFO.find((f) => f.key === key);
  const econ = cfg.economy[key];
  const rows = [];
  for (let level = facility.startLevel; level <= econ.maxLevel; level++) {
    rows.push({
      level,
      cost: econ.upgradeCost[level] ?? null,
      upkeep: econ.upkeepByLevel[level] ?? 0,
      effect: facility.effect(level),
    });
  }
  return rows;
}
