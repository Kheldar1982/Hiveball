# Hiveball Manager – Technische Spezifikation

> Grundlage für die Umsetzung mit Claude Code. Enthält Datenmodell, Formeln,
> Konfigurationsstruktur und Phasenplan für den Manager-Teil, der um das
> bestehende Kernspiel (`src/hiveball.html`) herum entsteht. Dieses Dokument
> ergänzt `README.md` (Kernspiel-Referenz) und wird bei Bedarf um weitere
> Design-Entscheidungen erweitert.
>
> Konventionen wie im Kernspiel: deutsche Bezeichner in Kommentaren/Doku,
> englische oder kurze deutsche Feldnamen im Code, W10-Würfelsystem,
> Ein-Datei-Prinzip nach Möglichkeit beibehalten, bis der Umfang das nicht
> mehr sinnvoll zulässt (siehe Abschnitt 8).

---

## 1. Grundprinzipien (Leitplanken für die Umsetzung)

Diese Punkte sind bewusste Design-Entscheidungen, keine Konfigurationswerte.
Sie sollten nicht über `leagueConfig` veränderbar sein (siehe Abschnitt 5):

- **MR wächst nie über Reps/Training.** Einzige Ausnahme bleibt ein
  möglicher zukünftiger, sehr teurer Sonderweg (nicht Teil dieser Spezifikation).
- **Nur physische Attribute (MR, AG, ST) unterliegen Aging-Verfall und
  verletzungsbedingtem Attributverlust.** BL, PA, CO sind davon nie betroffen.
- **Der Maximalwert eines Attributs wird berechnet, nicht gespeichert:**
  `Maximalwert = Positions-Grundwert + Physisches-Training-Level` (Level 0–3).
  Es gibt **keinen** separaten historischen Höchstwert.
- **Aging- und verletzungsbedingter Attributverlust senken nur den aktuellen
  Wert**, nie den berechneten Maximalwert. Wiederaufbau ist jederzeit über
  reguläres Training möglich, zu regulären Reps-Kosten.
- **Kein 1/10-Krit bei der Verletzungsschwere-Ermittlung** (dritter,
  eigenständiger Wurftyp neben `rollAgainstTarget`/`rollOpposed`).
- **Skills sind positionsoffen.** Jede Position kann jeden Skill erlernen;
  Empfehlungen sind reine UI-Hinweise, keine Sperren.
- **Wechsel finden ausschließlich vor einem Kickoff statt**, nie mitten in
  einem laufenden Drive. Das bestehende Risiko "unterlegen weiterspielen,
  bis der nächste Touchdown fällt" bleibt erhalten.
- **Kein Forfeit/keine Mindestformation.** Der Lineman garantiert
  Spielfähigkeit; es gibt nur Formations-Obergrenzen, keine Untergrenzen.

---

## 2. Datenmodell

### 2.1 Spieler (`ManagerPlayer`)

Erweitert das bestehende `player`-Objekt aus dem Kernspiel um persistente
Manager-Daten. Die Kernspiel-Felder (`bl`, `st`, `co`, `ag`, `pa`, `mr`,
`skills`, `rw`, `sp`, `spMax` usw.) bleiben pro Match wie bisher berechnet;
die hier gelisteten Felder sind die **persistente Quelle der Wahrheit**,
aus der zu Matchbeginn die Kernspiel-Spielerobjekte erzeugt werden.

```js
{
  playerId: "uuid",              // persistente ID, unabhängig von der Match-internen id
  clubId: "uuid",
  name: "string",                // generierter oder editierbarer Name
  position: "Blocker" | "Werfer" | "Fänger" | "Läufer" | "Lineman",
  number: 1-10,                  // Trikotnummer, eindeutig im Kader (nicht mehr nur 1-5)
  age: 20,                       // Jahre
  gamesPlayedTotal: 0,           // für Alterszyklus-Berechnung (alle N Spiele +1 Jahr)

  attributes: {
    bl: { current: 5 },
    st: { current: 5 },
    co: { current: 5 },
    ag: { current: 2 },
    pa: { current: 3 }
    // mr NICHT hier - siehe attributes.mr unten, kein current/max-Wachstum über Reps
  },
  mr: 4,                         // separat, da nie über Reps veränderbar

  reps: {                        // bankbare Fortschrittszähler pro Attribut
    bl: 0, st: 0, co: 0, ag: 0, pa: 0
  },
  repsThisGame: {                // wird nach jedem Spiel auf 0 zurückgesetzt
    bl: 0, st: 0, co: 0, ag: 0, pa: 0
  },

  skills: ["Block"],             // inkl. Startskill der Position
  bankedSkillPurchases: [],      // gekaufte, aber noch nicht trainierte Skills:
                                  // [{ skill: "Dodge", paidEp: 150, purchaseDate: n }]

  xp: 0,                         // verfügbare, noch nicht ausgegebene EP

  injury: {
    gamesRemaining: 0,           // Ausfallzähler, 0 = einsatzbereit
    severity: null               // "Geprellt" | "Angeschlagen" | "Verletzt" |
                                  // "Schwer verletzt" | "Schwerste Verletzung" | null
  },

  marketValue: 30000,            // Basis + Aufschläge (Formel siehe Phase 3, Platzhalter in Phase 1)
  retired: false,
  status: "aktiv" | "verletzt" | "im_ruhestand",

  // Nicht Teil der ursprünglichen Spezifikation, nachträglich für die
  // "Hall of Fame"-Seite ergänzt (ausgeschiedene Spieler, siehe Abschnitt 8
  // Architektur-Empfehlung/Implementierungsstand):
  careerTouchdowns: 0,           // im Kernspiel mitgezählt (checkScore)
  careerInjuriesCaused: 0,       // im Kernspiel mitgezählt (resolveBlock,
                                  // attemptLeavingTackleZones, resolveFoul)
  retirement: null                // null solange aktiv, sonst:
                                  // { reason: "Alter" | "Attribut-Minimum" |
                                  //   "Alter & Attribut-Minimum" |
                                  //   "Schwerste Verletzung",
                                  //   gamesPlayedTotal, retiredAt }
}
```

**Wichtig zur Reps-Zählung:** `reps` ist der bankbare Gesamtzähler seit
Karrierestart (bzw. seit letztem erfolgreichem Attributsprung – siehe unten).
`repsThisGame` ist nur die Zählhilfe für den Anti-Grinding-Deckel
(`maxRepsPerGamePerAttribute`) und wird nach jeder Aktion geprüft: Ist
`repsThisGame[attr] >= config.training.physical.maxRepsPerGamePerAttribute`,
wird die Aktion weiterhin regulär gewürfelt/ausgeführt, zählt aber nicht
mehr in `reps` hinein.

**Reps-Verbrauch bei Attributsprung:** Erreicht `reps[attr]` die Schwelle
`repsFormula.base + repsFormula.step * N` (N = Zielwert − Positions-Grundwert),
wird der Spieler "trainingsbereit" für dieses Attribut markiert (siehe
`trainingQueue` in 2.2). Nach erfolgreichem Training wird `reps[attr]` um
die verbrauchte Schwelle reduziert (nicht auf 0 gesetzt – Überschuss bleibt
erhalten und zählt sofort in Richtung des nächsten Punkts).

### 2.2 Verein (`Club`)

```js
{
  clubId: "uuid",
  name: "string",
  money: 200000,
  reputation: 50,                // Platzhalter für Phase 2 (Auslastung/Fans)

  roster: ["playerId", ...],     // max. 10

  facilities: {
    physicalTraining: { level: 1 },
    theoryTraining:   { level: 1 },
    medical:          { level: 1 },
    fanSector:        { level: 0 },   // Phase 2
    fanshop:          { level: 0 },   // Phase 2
    catering:         { level: 0 },   // Phase 2
    stadium:          { level: 0 }    // Phase 2
  },

  // Warteschlangen für die manuelle Slot-Vergabe nach jedem Spiel
  trainingQueue: {
    physical: [ { playerId, attribute } ],   // trainingsbereit, wartet auf Slot
    theory:   [ { playerId, skill } ]        // bezahlt, wartet auf Slot
  },
  medicalQueue: [ { playerId } ],            // verletzt, wartet auf Behandlungsplatz

  lastMatchNomination: {
    starters: ["playerId", ...],  // genau 5
    bench: ["playerId", ...]      // bis zu 3
  }
}
```

### 2.3 Post-Match-Ergebnis (Übergabe Kernspiel → Manager-Schicht)

Das Kernspiel muss am Spielende ein strukturiertes Ergebnis liefern, aus dem
die Manager-Schicht EP, Reps und Verletzungen ableitet. Vorschlag für die
Schnittstelle (kein Eingriff in die Würfellogik selbst nötig, nur Sammlung
bereits vorhandener Werte):

```js
{
  winner: TEAM_BLUE | TEAM_RED | null,   // null = Unentschieden
  finalScore: [blueScore, redScore],
  playerStats: [
    {
      matchPlayerId: 0,            // Kernspiel-interne id
      persistentPlayerId: "uuid",  // Mapping zur Manager-Schicht
      participated: true,
      touchdowns: 0,
      passesCompleted: 0,
      catches: 0,
      blocksWon: 0,
      dodgesSurvived: 0,
      bombsCompleted: 0,           // Pass ≥7 Felder erfolgreich
      longRunTouchdowns: 0,        // TD nach ≥5 Feldern am Stück
      underdogBlocksWon: 0,        // Block gegen höheren BL/AG-Wert gewonnen
      repsGained: { bl: 0, st: 0, co: 0, ag: 0, pa: 0 }, // bereits gedeckelt auf max. 4/Spiel
      finalSp: -3,                 // für Verletzungsschwere-Ermittlung
      wasInjuredThisMatch: true    // entspricht dem `injured`-Flag am Spielende
    }
  ]
}
```

---

## 3. Formeln – Referenz

### 3.1 Reps-Schwelle pro Attributpunkt

```
Schwelle(N) = leagueConfig.training.physical.repsFormula.base
            + leagueConfig.training.physical.repsFormula.step * N

N = Zielwert des Attributs − Positions-Grundwert des Attributs
```

Mit Standardwerten (`base: 10, step: 5`): 1. Punkt = 15, 2. Punkt = 20,
3. Punkt = 25 Reps.

**Alters-Modifikator** (multiplikativ auf die benötigten Reps, nicht auf
die Schwelle selbst – d.h. der Spieler sammelt bei Talent-Phase schneller
Fortschritt Richtung derselben Schwelle):

```
effektiveReps(Aktion) = 1 × leagueConfig.aging.phases[aktuellePhase].repsModifier
```

### 3.2 Maximalwert eines Attributs

```
Maximalwert(Attribut, Spieler) = Positions-Grundwert(Attribut)
                                + Club.facilities.physicalTraining.level
```

Gedeckelt auf max. Level 3 in Phase 1 (Level 4-5 sind Phase 3).

### 3.3 EP-Kosten für Skills

```
Preis(Skill, wievielterZusatzskill) =
  leagueConfig.xp.skillCosts[Skill]
  × leagueConfig.xp.additionalSkillMultiplier[wievielterZusatzskill]
```

`wievielterZusatzskill` zählt nur gekaufte Zusatzskills, **nicht** den
positionseigenen Startskill.

### 3.4 Skill-Limit

```
Limit(Spieler) = Club.facilities.theoryTraining.level  (max. 3)
               + Σ leagueConfig.training.theory.skillLimitBonusByAgePhase[phase]
                 für jede bereits erreichte Phase ab "peak"
```

### 3.5 Alter & Alterszyklus

```
Alter(Spieler) = 20 + floor(gamesPlayedTotal / leagueConfig.aging.gamesPerAgeCycle)
```

Bei jedem Zyklus-Übertritt in eine neue Phase (Routinier/Veteran/Karriereende
naht) wird die Verfallsprüfung durchgeführt:

```
verfällt = random() < (leagueConfig.aging.phases[phase].declineChance
                        - leagueConfig.aging.medicalDeclineReduction[medicalLevel])
// bei verfällt: -1 auf zufällig gewähltes physisches Attribut (MR, AG oder ST),
// Minimum 1, senkt nur den aktuellen Wert
```

Phasenübergänge selbst verschieben sich um
`leagueConfig.aging.medicalPhaseDelayGames[medicalLevel]` zusätzliche Spiele,
bevor die nächsthöhere Phase beginnt.

### 3.6 Verletzungsschwere (Post-Match, nur bei `finalSp < 0`)

```
if (finalSp === 0) {
  // kein Wurf, kein Ausfall, volle SP-Regeneration vor nächstem Spiel
} else if (finalSp < 0) {
  überschuss = Math.abs(finalSp)
  gesamtwert = rollD10() + überschuss   // KEIN Krit 1/10

  Tabelle:
   1–4  → Geprellt,             0 Spiele
   5–7  → Angeschlagen,         1 Spiel
   8–11 → Verletzt,             2 Spiele
  12–15 → Schwer verletzt,      W3+2 Spiele, 20% Chance: -1 auf MR/AG/ST
  16+   → Schwerste Verletzung, W4+5 Spiele, garantiert -1 auf MR/AG/ST,
                                 8% Chance: sofortige Zwangsrente
}
```

### 3.7 Medizinische Behandlung (Ausfallzeit-Reduktion)

Pro Spiel, das ein verletzter Spieler auf der Ausfallliste verbringt:

```
automatischeHeilung = 1 Spiel Ausfallzeit  // immer, unabhängig von Behandlung
mitBehandlungsplatz:
  zusätzlicheReduktion = Club.facilities.medical.level
  // Level 1: gesamt -2/Spiel, Level 2: -3/Spiel, Level 3: -4/Spiel
```

Platzvergabe: max. `Club.facilities.medical.level` Spieler gleichzeitig in
Behandlung, manuell vom Manager zugewiesen (`medicalQueue`).

### 3.8 Zwangsrente

Ausgelöst, wenn nach Aging- oder Verletzungsverfall gilt:
`age >= 38 OR irgendein physisches Attribut current <= 1`, oder durch die
8%-Sonderchance bei "Schwerste Verletzung". Setzt `retired: true`,
entfernt den Spieler aus `roster` und `lastMatchNomination`.

---

## 4. Spielablauf – Post-Match-Verarbeitung (Pseudocode)

```
function processPostMatch(matchResult, blueClub, redClub, config) {
  for (const stat of matchResult.playerStats) {
    const player = findPlayer(stat.persistentPlayerId);
    if (player.retired) continue;

    // 1. EP-Vergabe
    let xpGained = 0;
    if (stat.participated) xpGained += config.xp.perAction.participation;
    xpGained += stat.touchdowns * config.xp.perAction.touchdown;
    xpGained += stat.passesCompleted * config.xp.perAction.passComplete;
    xpGained += stat.catches * config.xp.perAction.catch;
    xpGained += stat.blocksWon * config.xp.perAction.blockWon;
    xpGained += stat.dodgesSurvived * config.xp.perAction.dodgeSurvived;
    xpGained += stat.bombsCompleted * config.xp.bonuses.bomb;
    xpGained += stat.longRunTouchdowns * config.xp.bonuses.longRunTD;
    xpGained += stat.underdogBlocksWon * config.xp.bonuses.underdogBlock;
    if (isWinner(player.clubId, matchResult)) xpGained += config.xp.perAction.teamWin;
    if (isMvp(stat, matchResult)) xpGained += config.xp.perAction.mvp;
    player.xp += xpGained;

    // 2. Reps-Gutschrift (bereits im Kernspiel auf max. 4/Spiel/Attribut gedeckelt)
    const ageMod = config.aging.phases[agePhaseOf(player)].repsModifier;
    for (const attr of ['bl','st','co','ag','pa']) {
      player.reps[attr] += stat.repsGained[attr] * ageMod;
      const n = nextStepFor(player, attr); // aktueller Wert - Grundwert + 1
      const threshold = config.training.physical.repsFormula.base
                       + config.training.physical.repsFormula.step * n;
      if (player.reps[attr] >= threshold
          && player.attributes[attr].current < maxValue(player, attr, config)) {
        enqueueIfNotAlready(player.clubId, 'physical', player.playerId, attr);
      }
    }

    // 3. Verletzungsschwere (nur wenn in diesem Match ausgeschieden)
    if (stat.wasInjuredThisMatch) {
      applyInjurySeverity(player, stat.finalSp, config); // s. Formel 3.6
      if (player.injury.gamesRemaining > 0) {
        enqueue(player.clubId, 'medical', player.playerId);
      }
    }

    // 4. Alterszyklus prüfen
    player.gamesPlayedTotal += 1;
    checkAgeCycleAndDecline(player, blueClub /* oder redClub */, config); // s. 3.5

    // 5. Gehalt abziehen (einmal pro Club, nicht pro Spieler-Loop)
  }

  deductSalaries(blueClub); deductSalaries(redClub);
  payoutMatchIncome(blueClub, redClub, matchResult, config);

  // 6. UI: Trainings-/Medizin-Slots manuell vergeben lassen (trainingQueue/medicalQueue
  //    ggü. verfügbaren Slots aus facilities-Level), Skill-Käufe aus bankedSkillPurchases
  //    ebenfalls über theoryTraining-Slots einsteuern.
}
```

---

## 5. `leagueConfig` – Vollstruktur

```js
const defaultLeagueConfig = {
  training: {
    physical: {
      maxRepsPerGamePerAttribute: 4,
      repsFormula: { base: 10, step: 5 },
      levels: {
        1: { slots: 3 },
        2: { slots: 5 },
        3: { slots: 7, allowDualTraining: true } // Doppeltraining kostet 2 Slots
      }
      // Maximalwert wird NICHT hier konfiguriert, sondern immer als
      // Positions-Grundwert + level berechnet (siehe Formel 3.2)
    },
    theory: {
      levels: {
        1: { slots: 2, skillLimit: 1 },
        2: { slots: 4, skillLimit: 2 },
        3: { slots: 6, skillLimit: 3 }
      },
      skillLimitBonusByAgePhase: { peak: 1, routinier: 1, veteran: 1 } // additiv
    }
  },

  aging: {
    gamesPerAgeCycle: 6,
    startAge: 20,
    phases: {
      talent:    { maxAge: 23, repsModifier: 0.7, declineChance: 0.0 },
      peak:      { maxAge: 29, repsModifier: 1.0, declineChance: 0.0 },
      routinier: { maxAge: 32, repsModifier: 1.0, declineChance: 0.2 },
      veteran:   { maxAge: 35, repsModifier: 1.5, declineChance: 0.4 },
      careerEnd: { maxAge: 37, repsModifier: null, declineChance: 1.0 }
    },
    forcedRetirementAge: 38,
    medicalDeclineReduction: { 1: 0.0, 2: 0.10, 3: 0.20 }, // Level 1 = kein Bonus
    medicalPhaseDelayGames:  { 1: 0, 2: 2, 3: 4 }
  },

  injury: {
    severityTable: [
      { max: 4,  label: "Geprellt",             gamesOut: () => 0 },
      { max: 7,  label: "Angeschlagen",          gamesOut: () => 1 },
      { max: 11, label: "Verletzt",              gamesOut: () => 2 },
      { max: 15, label: "Schwer verletzt",       gamesOut: () => roll(3) + 2,
        attributeLossChance: 0.20 },
      { max: Infinity, label: "Schwerste Verletzung", gamesOut: () => roll(4) + 5,
        attributeLossChance: 1.0, retirementChance: 0.08 }
    ]
  },

  medical: {
    slotsPerLevel: { 1: 1, 2: 2, 3: 3 },
    // Gesamtreduktion pro Spiel MIT Behandlung = 1 (automatisch) + level
    treatedReductionPerGame: { 1: 2, 2: 3, 3: 4 },
    untreatedReductionPerGame: 1
  },

  xp: {
    perAction: {
      participation: 3,
      touchdown: 8,
      passComplete: 3,
      catch: 3,
      blockWon: 3,
      dodgeSurvived: 2,
      teamWin: 5,
      mvp: 6
    },
    bonuses: {
      bomb: 1,
      longRunTD: 1,
      underdogBlock: 1
    },
    skillCosts: {
      Blitz: 100,
      Block: 100,
      Zielwurf: 110,
      "Ruhiger Kopf": 140,
      Dodge: 150
    },
    additionalSkillMultiplier: { 1: 1.0, 2: 1.5, 3: 2.0, 4: 2.5 }
  },

  economy: {
    startingCapital: 200000,
    salaryPercentOfMarketValue: 0.09,
    winPrize: 5000,
    basePricesByPosition: {
      Lineman: 30000,
      Blocker: 50000,
      Werfer: 55000,
      Fänger: 60000,
      Läufer: 65000
    }
    // ticketIncome, fanshopIncome etc. folgen in Phase 2
  },

  roster: {
    maxClubSize: 10,
    maxMatchdayNomination: 8,
    startingLineupSize: 5,
    maxBench: 3,
    maxPerSpecialistPosition: 2 // gilt für Blocker/Werfer/Fänger/Läufer, nicht Lineman
  }
};
```

**Konfigurierbarkeits-Hinweis:** Alle Werte in diesem Objekt sind laut
Abschnitt 1 grundsätzlich änderbar. Empfohlene Leitplanken (Min/Max je Feld)
sind noch nicht final spezifiziert und sollten vor dem Bau eines
Liga-Settings-UI (Phase 1e) ergänzt werden.

---

## 6. Positionen – Referenztabelle

```js
const POSITIONS_MANAGER_EXT = {
  Lineman: { icon: '🧑', mr: 5, bl: 3, st: 3, co: 3, ag: 3, pa: 3, skills: [], price: 30000 },
  Blocker: { icon: '🛡️', mr: 4, bl: 5, st: 5, co: 5, ag: 2, pa: 3, skills: ['Block'], price: 50000 },
  Werfer:  { icon: '🎯', mr: 5, bl: 3, st: 3, co: 4, ag: 4, pa: 6, skills: ['Zielwurf'], price: 55000 },
  Fänger:  { icon: '🙌', mr: 6, bl: 2, st: 2, co: 3, ag: 7, pa: 6, skills: ['Dodge'], price: 60000 },
  Läufer:  { icon: '🏃', mr: 6, bl: 3, st: 3, co: 3, ag: 6, pa: 5, skills: ['Blitz'], price: 65000 }
};
```

Entspricht dem bestehenden `POSITIONS`-Objekt im Kernspiel, erweitert um
`price`. Der Lineman ist neu und muss in `POSITIONS`, `TEAM_ROSTER`-Logik
(jetzt variabel statt fixer 5er-Liste) und die Formations-Obergrenzen-Prüfung
aufgenommen werden.

---

## 7. Notwendige Eingriffe in `hiveball.html` (Kernspiel)

Bewusst minimal gehalten, um die bestehende Architektur nicht unnötig zu
verändern:

1. **`POSITIONS`** um `Lineman` erweitern (kein Skill, siehe Abschnitt 6).
2. **`setupTeams()`** von fixer 5er-`ys`-Liste auf variable Kadergröße
   (5 Feldspieler + bis zu 3 Bank) umstellen; Startformation kommt jetzt aus
   der Matchday-Nominierung der Manager-Schicht statt aus `TEAM_ROSTER`.
3. **`startKickoff()`** erweitern: prüft nach jedem Reset, ob eine
   Positions-Stelle durch einen `injured`-Spieler verwaist ist, und ersetzt
   sie nach Priorität (gleiche Position → Lineman → beliebig verfügbar) durch
   einen Bankspieler, falls vorhanden. Grundlage für die spätere manuelle
   Wechselauswahl (Phase 2).
4. **Log-Wording:** *"ist verletzt und verlässt das Feld"* →
   *"scheidet aus"*, um Verwechslung mit der persistenten Verletzung der
   Manager-Schicht zu vermeiden.
5. **Match-Ende:** neue Funktion, die das Post-Match-Ergebnisobjekt
   (Abschnitt 2.3) aus den vorhandenen Spielerobjekten und mitgezählten
   Statistiken (Touchdowns, Pässe, Fänge, Blocks, Dodges, Bomben,
   Lauf-Touchdown-Distanz, Underdog-Blocks) zusammenstellt. Dafür müssen an
   den entsprechenden Stellen (`checkScore`, `attemptPass`, `resolveBlock`,
   `attemptLeavingTackleZones`, `tryPickupBall`) kleine Zähler pro Spieler
   ergänzt werden, die bisher nicht persistiert wurden.
6. **Reps-Zählung während des Matches:** an denselben Stellen wie Punkt 5
   werden `repsGained`-Zähler pro Attribut geführt (mit dem
   `maxRepsPerGamePerAttribute`-Deckel direkt im Kernspiel geprüft, damit die
   Manager-Schicht keine ungedeckelten Rohdaten verarbeiten muss).

---

## 8. Architektur-Empfehlung

Die README hält fest, dass die Ein-Datei-Architektur bewusst gewählt wurde
und beibehalten werden soll, "solange keine triftigen Gründe dagegen
sprechen". Mit dem Manager-Teil ist dieser Punkt erreicht: persistenter
Zustand, `leagueConfig`, Post-Match-Verarbeitung und mehrere neue UI-Screens
(Kader, Training, Transfermarkt, Vereinsausbau) sprengen den Rahmen einer
wartbaren Einzeldatei. Empfehlung für die Umsetzung mit Claude Code:

```
hiveball/
├── README.md
├── docs/
│   ├── Hiveball_Manager_Regelwerk_v0_12.pdf
│   └── hiveball_manager_spezifikation.md   ← dieses Dokument
├── src/
│   ├── core/
│   │   └── hiveball.html                   ← Kernspiel, minimal erweitert (Abschnitt 7)
│   └── manager/
│       ├── state.js                        ← Club-/Spieler-Datenmodell, Persistenz (localStorage o.ä.)
│       ├── leagueConfig.js                 ← Default-Config (Abschnitt 5)
│       ├── postMatch.js                    ← Verarbeitung gem. Abschnitt 4
│       ├── formulas.js                     ← Abschnitt 3 als reine Funktionen
│       └── ui/                             ← Kader, Training, Transfermarkt, Vereinsausbau
```

Die genaue technische Umsetzung (Framework-Wahl, Persistenzmechanismus,
Kopplung Kernspiel ↔ Manager-Schicht als Events oder direkte Funktionsaufrufe)
sollte zu Beginn der Phase-1-Umsetzung mit Claude Code selbst entschieden
werden, da das außerhalb des reinen Spieldesigns liegt.

---

## 9. Persistenz & künftige Server-/Multiplayer-Migration

### 9.1 Speichermechanismus für Phase 1

Empfehlung: **Kombination aus localStorage und Datei-Export/Import**, nicht
entweder-oder.

| | Vorteil | Nachteil |
|---|---|---|
| **localStorage** | automatisch, keine Nutzeraktion nötig, fühlt sich wie ein normales Spiel-Save an | an ein Gerät/einen Browser gebunden, geht bei "Browserdaten löschen" verloren, nicht portabel, schwer zu inspizieren |
| **Datei-Export/Import (JSON)** | portabel, sicherbar/teilbar, leicht zu inspizieren (auch praktisch für Debugging mit Claude Code) | manuelle Aktion bei jedem Speichern/Laden |

localStorage dient als automatisches Standard-Save, Datei-Export/Import
zusätzlich als manuelle Sicherung und Debug-Werkzeug. Beides ist mit
Vanilla JS ohne Build-Schritt umsetzbar und passt damit zur bestehenden
Ein-Datei-/Keine-Build-Schritt-Prämisse.

### 9.2 Der eigentlich entscheidende Punkt: Abstraktionsschicht statt direkter Zugriffe

Ob Phase 1 localStorage oder Dateien nutzt, ist für eine spätere
Server-Migration fast irrelevant. Entscheidend ist, **ob die Spiellogik
weiß, woher ihre Daten kommen.**

Ruft die Manager-Logik (Formeln, EP-Vergabe, Trainingsqueues) direkt
`localStorage`-Methoden oder Datei-Operationen auf, muss bei einer
Server-Umstellung jede einzelne Stelle angefasst werden. Liegt stattdessen
von Anfang an eine dünne Persistenz-Schicht dazwischen – z. B.
`saveClub(club)`, `loadClub(id)`, `saveMatchResult(result)` – die intern
mal auf localStorage, mal auf eine Datei, später auf einen API-Call zeigt,
betrifft ein späterer Umbau nur diese eine Schicht. Der Rest des Spiels
bleibt unverändert.

Diese Schicht entspricht `state.js` aus der Architektur-Empfehlung
(Abschnitt 8) und sollte rein datenorientiert bleiben (reine Objekte
rein/raus, keine Vermischung mit UI- oder Spiellogik).

Bereits mit Blick auf eine Mehrbenutzer-Zukunft vorbereitet: `playerId`/
`clubId` sind in Abschnitt 2 bewusst als UUIDs vorgesehen, nicht als
Array-Indizes (analog zur bestehenden Trennung `id` vs. `number` im
Kernspiel) – UUIDs bleiben eindeutig, auch wenn später mehrere
Clients/Server gleichzeitig Daten erzeugen.

### 9.3 Der eigentliche Brocken bei echtem Multiplayer: Spielsimulation, nicht Speicherung

Sobald es um echten Wettkampf zwischen zwei Menschen geht (nicht nur
"Spielstand persistent gegen KI"), reicht reine Datenspeicherung nicht
mehr aus. Aktuell laufen alle Würfe und die gesamte Spiellogik im Browser
des Spielers (`Math.random()` im Client) – für Solo-Spiel gegen KI
unproblematisch, aber in einem echten Multiplayer-Kontext ein Einfallstor
für Manipulation (ein Client könnte sich theoretisch bessere Würfe
erschummeln).

Für belastbares Online-Multiplayer müsste die Kernspiel-Logik
**serverseitig ausgeführt oder zumindest serverseitig verifiziert**
werden, nicht nur die Ergebnisse zentral gespeichert werden. Das ist ein
deutlich größerer Architektur-Schritt als die reine Speicherfrage und
sollte als **eigener, später Roadmap-Punkt** (siehe Phase 3+ unten)
behandelt werden, getrennt von der Persistenz-Entscheidung aus 9.1/9.2.

---

## 10. Phasenplan

**Phase 1** – Persistenter Kader (inkl. Lineman, 10-Spieler-Kader,
Preistabelle), EP-für-Skills, Vereinskasse, einfacher Transfermarkt,
`leagueConfig`-Grundgerüst, Datenmodell aus Abschnitt 2.

**Phase 1b** – Rep-basiertes Attributwachstum (Formel 3.1, Maximalwert
gemäß Formel 3.2).

**Phase 1c-Physisch** – Physisches Training (Slots/Deckel, Doppeltraining
ab Level 3).

**Phase 1c-Theorie** – Theorie-Training (Slots/Skill-Limit, EP-Banking über
`bankedSkillPurchases`).

**Phase 1d** – Aging-System (Formel 3.5, nur aktueller Wert betroffen).

**Phase 1f** – Matchday-Nominierung (8 aus 10, Formations-Obergrenzen aus
`leagueConfig.roster`).

**Phase 1g** – Wechsel-Logik in `hiveball.html` (Abschnitt 7, Punkt 3).

**Phase 1j** (umgesetzt) – Post-Match-Ergebnisobjekt (Abschnitt 7, Punkt 5) und
Reps-Zählung während des Matches (Abschnitt 7, Punkt 6): kleine Zähler pro
Spieler an den relevanten Stellen im Kernspiel (`resolveInjuryCheck`,
`attemptPass`, `resolveBlock`, `attemptLeavingTackleZones`, `tryPickupBall`)
für Touchdowns, Pässe, Fänge, Blocks, Dodges, Bomben, Underdog-Blocks sowie
`matchRepsGained` pro Attribut (gedeckelt auf `maxRepsPerGamePerAttribute`
über `creditMatchRep`). `processManagerPostMatch` (`hiveball.html`) bündelt
das Ergebnisobjekt je Spieler und ruft `processPostMatch` aus dem neuen
`src/manager/postMatch.js` auf (EP-Vergabe nach `config.xp.perAction`/
`bonuses`, MVP-Bonus, Reps-Gutschrift über `creditReps`, Verletzungsschwere,
Alterszyklus, Gehaltsabzug + Sieg-/Spieleinnahmen über `economy.js`).
Reps-Zuordnung (Nutzer-Entscheidung, abweichend von einer reinen
1:1-Ableitung): BL bei jedem Blockversuch (unabhängig vom Ausgang), ST beim
Gewinner jedes Verletzungschecks (unabhängig vom Ausgang), CO beim Verlierer
eines Verletzungschecks ohne SP-Schaden (`damage === 0`) *und* zusätzlich
einmal pro Spiel pauschal (nur falls die Rep-Obergrenze dadurch noch nicht
erreicht ist), AG bei Ballaufnahme/Fang/überstandenem Tackle, PA beim
gelungenen Wurf (unabhängig vom Fang). Lauf-Touchdowns (`longRunTD`-Bonus aus
`config.xp.bonuses`) sind bewusst zurückgestellt – siehe Backlog unten. Aus
Abschnitt 7 herausgelöst und als eigene Phase nachgetragen, da sie im
ursprünglichen Phasenplan keine eigene Nummer hatte, aber eine eigenständige,
von der reinen Wechsel-Logik (1g) unabhängige Integrationsarbeit ist.

**Phase 1h** – Verletzungsschwere-Wurf (Formel 3.6), Ausfallzähler,
Nominierungssperre, Zwangsrente-Anbindung (Formel 3.8).

**Phase 1i** – Medizinische Abteilung – Behandlungsplätze (Formel 3.7),
manuelle Zuweisung über `medicalQueue`.

**Phase 1e** – einfaches Settings-UI für `leagueConfig` (lokale Instanz,
noch keine Multi-Liga-Struktur).

**Phase 2** – Fan-Sektor, Fanshop, Catering, Stadion, Unterhaltssystem für
alle Gebäude; manuelle Wechselauswahl für den Menschen (statt automatischer
Priorität); zweite Skill-Welle (Feldgeneral, Letzter Ausweg, Auf Kommando –
Details in README/Konzept-Zusammenfassung); Marktwert-Formel-Vorarbeit.

**Phase 3** – Vollständige Marktwert-Formel, Multi-Liga mit echter
Admin-Rolle und Persistenz pro Liga, Trainingsgebäude-Level 4-5, flexible
Startformationen (Abweichung von 2/1/1/1-Kern), Scouting-Varianz bei neuen
Spielern, Balancing-Ventil gegen den Schneeball-Effekt (z. B.
Einnahmen-Deckel oder gegnerstärke-Skalierung).

---

## 11. Offene Punkte für die Umsetzung

Diese Punkte wurden im Konzept bewusst nicht abschließend festgelegt und
sollten zu Beginn der jeweiligen Phase konkretisiert werden:

- Min/Max-Leitplanken je `leagueConfig`-Feld (vor Phase 1e).
- Persistenzmechanismus (localStorage, Datei-Export/Import, o.ä.) – im
  Kernspiel-Kontext bislang bewusst nicht vorhanden.
- ~~Genaue Definition "Underdog-Block"~~ – seit Phase 1j geklärt: der
  Verteidiger hatte den höheren relevanten Duell-Wert (BL, bzw. AG bei
  Dodge-Skill), verliert das Duell aber trotzdem; kein zusätzlicher
  Schwellenwert.
- ~~MVP-Ermittlungslogik~~ – seit Phase 1j geklärt: höchste Summe aus
  Touchdowns, gewonnenen Blocks, Fängen, abgeschlossenen Pässen und
  überstandenen Tackles im Match (`postMatch.js`, `determineMvpId`).
- Backlog (aus Phase 1j zurückgestellt): Lauf-Touchdown-Bonus (`longRunTD`).
  Der reine Einzelzug-Blick (>=5 Felder am Stück) greift kaum, weil ein
  Läufer/Fänger nach einem Fang ohnehin fast immer >=5 Felder in einem Zug
  zurücklegt. Für eine sinnvolle Umsetzung müsste über mehrere Runden hinweg
  die zurückgelegte Distanz eines Laufs verfolgt und der Schwellenwert
  entsprechend höher angesetzt werden.
- Marktwert-Formel-Details (Phase 3, aktuell nur Platzhalterfeld im
  Datenmodell vorgesehen).
- Rückbau/Verkauf von Gebäuden ist aktuell nicht vorgesehen; falls das
  später eingeführt wird, siehe Randfall-Hinweis in Abschnitt 1 zum
  Maximalwert-Verhalten bei Level-Absenkung.
- Konkrete Ausgestaltung der Persistenz-Abstraktionsschicht (Abschnitt 9.2)
  vor Beginn von Phase 1.
- Architektur für serverseitige Spielsimulation/-verifikation, sobald
  echtes Online-Multiplayer angegangen wird (Abschnitt 9.3) – bewusst nicht
  Teil dieser Spezifikation, da es die Kernspiel-Architektur grundlegender
  betrifft als der Manager-Teil selbst.
