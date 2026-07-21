// Einfacher Transfermarkt (Phasenplan Phase 1): Spieler zum Basispreis der
// Position kaufen. Verkauf/Release ist bewusst nicht enthalten – dafür fehlt
// laut Spezifikation (Abschnitt 11, offener Punkt) noch die vollständige
// Marktwert-/Erlösformel für Phase 3.

import { POSITIONS_MANAGER_EXT } from './positions.js';
import { defaultLeagueConfig } from './leagueConfig.js';
import { createManagerPlayer, saveClub, savePlayer, loadPlayers } from './state.js';

function nextAvailableNumber(existingNumbers, maxClubSize) {
  for (let n = 1; n <= maxClubSize; n++) {
    if (!existingNumbers.includes(n)) return n;
  }
  throw new Error(`Kein freier Kaderplatz für eine Trikotnummer (max. ${maxClubSize})`);
}

// Kauft einen neuen Spieler der angegebenen Position für den Club: prüft
// Vereinskasse und Kadergröße (leagueConfig.roster.maxClubSize), vergibt die
// nächste freie Trikotnummer, zieht den Preis ab und persistiert Club+Spieler.
// Keine Ownership-Obergrenze je Spezialposition mehr – die greift erst bei
// der Matchday-Nominierung (max. gleichzeitig "Feld", siehe nomination.js),
// ein Verein darf also z.B. mehr als 2 Blocker besitzen.
export function signPlayer({ club, position, name, config = defaultLeagueConfig }) {
  const base = POSITIONS_MANAGER_EXT[position];
  if (!base) throw new Error(`Unbekannte Position: ${position}`);

  const rosterConfig = config.roster;
  if (club.roster.length >= rosterConfig.maxClubSize) {
    throw new Error(`Kader ist bereits voll (max. ${rosterConfig.maxClubSize})`);
  }
  if (club.money < base.price) {
    throw new Error(`Vereinskasse reicht nicht: ${club.money} < ${base.price}`);
  }

  const teammates = loadPlayers(club.roster);
  const number = nextAvailableNumber(teammates.map((p) => p.number), rosterConfig.maxClubSize);
  const player = createManagerPlayer({ position, name, clubId: club.clubId, number });

  club.money -= base.price;
  club.roster.push(player.playerId);

  saveClub(club);
  savePlayer(player);

  return player;
}
