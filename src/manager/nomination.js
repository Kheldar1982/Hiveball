// Matchday-Nominierung (Phasenplan Phase 1f): jeder Spieler hat einen
// Matchday-Status – "feld" (Startaufstellung), "bank" (Ersatzbank) oder
// "frei" (nicht nominiert) – gespeichert in club.lastMatchNomination
// {starters, bench}. Wird direkt in der Kader-Übersicht über eine Kombobox
// pro Spieler gesetzt, kein separater Bestätigungsschritt.
//
// "Feld" ist auf max. 2 gleichzeitig je Spezialposition begrenzt (Blocker/
// Werfer/Fänger/Läufer; Lineman unbegrenzt) plus die generelle Obergrenze
// von startingLineupSize (5) – ein Verein darf aber beliebig viele Spieler
// einer Spezialposition besitzen, die Obergrenze gilt nur fürs gleichzeitige
// "Feld". "Bank" ist nur in der Gesamtzahl (maxBench) begrenzt, ohne
// Positionsobergrenze.

import { defaultLeagueConfig } from './leagueConfig.js';
import { loadPlayers, saveClub } from './state.js';

const SPECIALIST_POSITIONS = ['Blocker', 'Werfer', 'Fänger', 'Läufer'];

export function getPlayerMatchdayStatus(player, club) {
  if (club.lastMatchNomination.starters.includes(player.playerId)) return 'feld';
  if (club.lastMatchNomination.bench.includes(player.playerId)) return 'bank';
  return 'frei';
}

function countFeldForPosition(club, position, excludePlayerId) {
  const ids = club.lastMatchNomination.starters.filter((id) => id !== excludePlayerId);
  return loadPlayers(ids).filter((p) => p.position === position).length;
}

// Prüft, ob ein Spieler in den gewünschten Status wechseln dürfte (ohne ihn
// zu setzen) – Grundlage dafür, welche Optionen die Kombobox überhaupt zeigt.
export function canSetMatchdayStatus(player, club, status, config = defaultLeagueConfig) {
  if (status === getPlayerMatchdayStatus(player, club)) return true;

  if (status === 'frei') return true;

  if (status === 'bank') {
    const benchCount = club.lastMatchNomination.bench.filter((id) => id !== player.playerId).length;
    return benchCount < config.roster.maxBench;
  }

  if (status === 'feld') {
    const starterCount = club.lastMatchNomination.starters.filter((id) => id !== player.playerId).length;
    if (starterCount >= config.roster.startingLineupSize) return false;
    if (SPECIALIST_POSITIONS.includes(player.position)) {
      return countFeldForPosition(club, player.position, player.playerId) < config.roster.maxPerSpecialistPosition;
    }
    return true; // Lineman: keine Positionsobergrenze
  }

  return false;
}

// Setzt den Matchday-Status eines Spielers und persistiert den Club.
export function setPlayerMatchdayStatus(player, club, status, config = defaultLeagueConfig) {
  if (!canSetMatchdayStatus(player, club, status, config)) {
    throw new Error(`${player.name} kann nicht auf "${status}" gesetzt werden`);
  }

  club.lastMatchNomination.starters = club.lastMatchNomination.starters.filter((id) => id !== player.playerId);
  club.lastMatchNomination.bench = club.lastMatchNomination.bench.filter((id) => id !== player.playerId);

  if (status === 'feld') club.lastMatchNomination.starters.push(player.playerId);
  else if (status === 'bank') club.lastMatchNomination.bench.push(player.playerId);

  saveClub(club);
  return club.lastMatchNomination;
}
