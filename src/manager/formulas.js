// Reine Formelfunktionen aus docs/hiveball_manager_spezifikation.md
// Abschnitt 3. Aging-Verfall (3.5, das eigentliche Würfeln), Verletzungs-
// schwere (3.6) etc. folgen erst mit den jeweiligen späteren Phasen.

import { POSITIONS_MANAGER_EXT } from './positions.js';

const PHYSICAL_ATTRIBUTES = ['bl', 'st', 'co', 'ag', 'pa'];

// Ordnet ein Alter der Aging-Phase zu (Spezifikation 3.5-Tabelle als reiner
// Lookup, ohne das eigentliche Verfallswürfeln – das bleibt Phase 1d).
export function agePhaseOf(age, config) {
  const phases = config.aging.phases;
  if (age <= phases.talent.maxAge) return 'talent';
  if (age <= phases.peak.maxAge) return 'peak';
  if (age <= phases.routinier.maxAge) return 'routinier';
  if (age <= phases.veteran.maxAge) return 'veteran';
  return 'careerEnd';
}

// Marktwert (Vorschlag Nutzer, ersetzt den Phase-3-Platzhalter aus
// Spezifikation 2.1/3): Kaufwert + Aufschlag pro Attributpunkt und Skill
// über den Positions-Grundzustand hinaus. Kann bei starkem Aging-Verfall
// (Phase 1d, noch nicht gebaut) theoretisch unter den Kaufwert fallen.
export function calculateMarketValue(player, config) {
  const base = POSITIONS_MANAGER_EXT[player.position];
  const extraAttributePoints = PHYSICAL_ATTRIBUTES.reduce(
    (sum, attr) => sum + (player.attributes[attr].current - base[attr]),
    0
  );
  const extraSkills = player.skills.length - base.skills.length;

  return base.price
    + extraAttributePoints * config.economy.marketValue.perExtraAttributePoint
    + extraSkills * config.economy.marketValue.perExtraSkill;
}

// Formel 3.1 (Reps-Schwelle): wie viele Reps für den n-ten Attributpunkt
// über dem Positions-Grundwert nötig sind.
export function repThreshold(n, config) {
  return config.training.physical.repsFormula.base + config.training.physical.repsFormula.step * n;
}

// Alters-Modifikator auf gesammelte Reps (Formel 3.1). Bewusst gegenüber dem
// wörtlichen Spezifikationstext umgedreht (1 / repsModifier statt
// × repsModifier) – Nutzerentscheidung, da der Beschreibungstext "Talente
// sammeln schneller Fortschritt" verspricht, die wörtliche Multiplikation mit
// den konfigurierten Werten (talent 0.7, veteran 1.5) aber das Gegenteil
// bewirkt hätte. careerEnd hat repsModifier: null → kein Fortschritt mehr.
export function effectiveReps(rawReps, agePhase, config) {
  const modifier = config.aging.phases[agePhase].repsModifier;
  if (!modifier) return 0;
  return rawReps / modifier;
}

// Formel 3.2 (Maximalwert): Positions-Grundwert + Level der physischen
// Trainingsanlage. Gilt nur für die trainierbaren Attribute (bl/st/co/ag/pa)
// – MR wächst nie über Reps (Grundprinzipien, Abschnitt 1).
export function maxAttributeValue(attr, player, club, config) {
  return POSITIONS_MANAGER_EXT[player.position][attr] + club.facilities.physicalTraining.level;
}

// Formel 3.3: Preis für den n-ten gekauften Zusatzskill (zählt nur gekaufte
// Zusatzskills, nicht den positionseigenen Startskill).
export function skillPrice(skill, additionalSkillNumber, config) {
  const baseCost = config.xp.skillCosts[skill];
  if (baseCost === undefined) throw new Error(`Unbekannter Skill: ${skill}`);

  const multiplier = config.xp.additionalSkillMultiplier[additionalSkillNumber];
  if (multiplier === undefined) {
    throw new Error(`Kein additionalSkillMultiplier für den ${additionalSkillNumber}. Zusatzskill konfiguriert`);
  }

  return baseCost * multiplier;
}

// Formel 3.4: wie viele Skills darf ein Spieler insgesamt haben (inkl.
// Startskill), abhängig vom Theorie-Trainings-Level des Clubs plus additive
// Boni je erreichter Aging-Phase ab "peak".
export function skillLimit(player, club, config) {
  const phaseOrder = ['peak', 'routinier', 'veteran', 'careerEnd'];
  const currentPhase = agePhaseOf(player.age, config);
  const reachedIndex = phaseOrder.indexOf(currentPhase);

  let bonus = 0;
  if (reachedIndex >= 0) {
    for (let i = 0; i <= reachedIndex; i++) {
      bonus += config.training.theory.skillLimitBonusByAgePhase[phaseOrder[i]] || 0;
    }
  }

  return club.facilities.theoryTraining.level + bonus;
}
