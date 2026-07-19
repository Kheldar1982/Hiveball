// Preistabelle & Positions-Referenz für den Manager-Teil, siehe
// docs/hiveball_manager_spezifikation.md Abschnitt 6. Entspricht dem
// bestehenden POSITIONS-Objekt im Kernspiel (src/hiveball.html), erweitert
// um `price`. Lineman ist neu gegenüber dem Kernspiel-Roster "Option A".

export const POSITIONS_MANAGER_EXT = {
  Lineman: { icon: '🧑', mr: 5, bl: 3, st: 3, co: 3, ag: 3, pa: 3, skills: [], price: 30000 },
  Blocker: { icon: '🛡️', mr: 4, bl: 5, st: 5, co: 5, ag: 2, pa: 3, skills: ['Block'], price: 50000 },
  Werfer:  { icon: '🎯', mr: 5, bl: 3, st: 3, co: 4, ag: 4, pa: 6, skills: ['Zielwurf'], price: 55000 },
  Fänger:  { icon: '🙌', mr: 6, bl: 2, st: 2, co: 3, ag: 7, pa: 6, skills: ['Dodge'], price: 60000 },
  Läufer:  { icon: '🏃', mr: 6, bl: 3, st: 3, co: 3, ag: 6, pa: 5, skills: ['Blitz'], price: 65000 }
};
