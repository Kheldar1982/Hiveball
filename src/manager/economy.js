// Vereinskasse (Phasenplan Phase 1): reine Auf-/Abbuchungsfunktionen auf
// Club-Objekten. Noch nicht ans Matchende in hiveball.html angebunden (das
// ist Abschnitt 7/Phase 1g, bewusst nicht Teil dieses Schritts) – hier nur
// die Buchungslogik selbst, aufrufbar sobald diese Anbindung existiert.

import { defaultLeagueConfig } from './leagueConfig.js';
import { saveClub } from './state.js';

// Zieht die Gehälter aller übergebenen Spieler von der Vereinskasse ab
// (Gehalt = marketValue * salaryPercentOfMarketValue). `players` sollte der
// komplette Kader sein (z.B. via loadPlayers(club.roster)).
export function deductSalaries(club, players, config = defaultLeagueConfig) {
  const total = players.reduce(
    (sum, p) => sum + p.marketValue * config.economy.salaryPercentOfMarketValue,
    0
  );
  club.money -= total;
  saveClub(club);
  return total;
}

// Gutschrift der Siegprämie (Ticket-/Fanshop-Einnahmen folgen erst Phase 2).
export function payMatchIncome(club, won, config = defaultLeagueConfig) {
  const amount = won ? config.economy.winPrize : 0;
  club.money += amount;
  saveClub(club);
  return amount;
}
