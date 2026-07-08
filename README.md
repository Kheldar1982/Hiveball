# Hiveball – Projektstatus & Kontext

> Referenzdokument für die Weiterentwicklung (z.B. mit Claude Code). Enthält den
> aktuellen Stand der Spielregeln, die technische Architektur, bisherige
> Design-Entscheidungen und offene Punkte, damit nicht jedes Mal von vorne
> erklärt werden muss.
>
> Das vollständige, ursprüngliche Regelwerk-Dokument liegt zusätzlich unter
> [`docs/Hiveball_Manager_Regelwerk_v0_12.pdf`](docs/Hiveball_Manager_Regelwerk_v0_12.pdf).
> Die Werte unten sind direkt aus dem aktuellen Code (`src/hiveball.html`)
> übernommen und damit die verbindliche Quelle der Wahrheit für den
> Ist-Zustand – bei Widersprüchen zum PDF gilt der Code.

## 1. Was ist Hiveball?

Ein rundenbasiertes Football-Spiel, lose an Bloodbowl (Cyanide) angelehnt,
aber **bewusst eigenständig entwickelt** (eigene Attributsnamen, W10 statt
W6, eigene Mechaniken wie den Tackle-vs-Dodge-Zonenbonus und die
distanzbasierte Passschwierigkeit), um urheberrechtlich unabhängig zu sein.

Geplante Zwei-Teile-Architektur:

- **Kernspiel** (aktueller Fokus): das eigentliche rundenbasierte Match, 5 gegen 5.
- **Manager-Teil** (noch nicht begonnen): Kader-Verwaltung, Kauf/Verkauf,
  Training, Stadion, Werbung, Liga-System.

## 2. Aktueller Stand der Datei

**Einzige Datei:** `src/hiveball.html` – ein vollständig eigenständiger
Browser-Prototyp (HTML/CSS/Vanilla JS in einer Datei, keine Frameworks,
keine Build-Schritte). Läuft rein clientseitig, **keine Persistenz, kein
Backend, kein Multiplayer** – jedes Neuladen der Seite setzt das Spiel
zurück.

Zwei Teams: **Blau** (menschlich gesteuert) gegen **Rot** (einfache KI).

Einfach im Browser öffnen (`src/hiveball.html` doppelklicken oder per
lokalem Server ausliefern) – kein `npm install`, kein Build-Schritt nötig.

## 3. Spielfeld & Teams

- Raster: 13 Spalten × 7 Reihen (`COLS = 13, ROWS = 7`, Feldgröße `CELL = 60px`).
- Endzone Rot = Spalte 0 (links), Endzone Blau = Spalte 12 (rechts).
- Blau startet links (Spalte 2), Rot rechts (Spalte 10).
- 5 Spieler pro Team, Positionssystem **"Option A"**:
  - 2× 🛡️ Blocker (hoch BL/ST/CO, niedrig AG)
  - 1× 🎯 Werfer (hoch PA)
  - 1× 🙌 Fänger (hoch AG)
  - 1× 🏃 Läufer (hoch MR/AG)
- Jeder Spieler hat eine interne eindeutige `id` (Spiellogik, z.B.
  Ballträger-Zuordnung) UND eine Anzeige-`number` (1–5, pro Team eigenständig
  vergeben, für Log/UI). Diese Trennung ist wichtig – nicht wieder vermischen.

## 4. Attribute & Positionswerte

Die Grundwerte summieren sich je Position auf 20 (BL+ST+CO+AG+PA), MR steht
separat außerhalb dieses Budgets. RW und SP werden aus CO abgeleitet:
`RW = CO + ARMOR_BONUS (3)`, `SP = CO * STAMINA_MULTIPLIER (3)` (Wert zu
Spielbeginn). Der frühere pauschale `TEMP_CO_BONUS` auf CO selbst entfällt
damit – die Rüstungsfunktion, für die er ursprünglich als Provisorium diente,
übernimmt jetzt RW.

| Position | Icon | MR | BL | ST | CO | RW | SP | AG | PA |
|----------|------|----|----|----|----|----|----|----|----|
| Blocker  | 🛡️  | 4  | 5  | 5  | 5  | 8  | 15 | 2  | 3  |
| Läufer   | 🏃  | 6  | 3  | 3  | 3  | 6  | 9  | 6  | 5  |
| Fänger   | 🙌  | 6  | 2  | 2  | 3  | 6  | 9  | 7  | 6  |
| Werfer   | 🎯  | 5  | 3  | 3  | 4  | 7  | 12 | 4  | 6  |

- **MR** = Movement Range · **BL** = Block-Duell · **CO** = Konstitution
  (Basis für RW/SP) · **RW** = Rüstungswert, Ziel des Verletzungswurfs
  (`CO + 3`) · **SP** = Stamina Points, werden beim Verletzungscheck
  verbraucht (`CO * 3` zu Spielbeginn) · **AG** = Ballaufnahme/Fangen ·
  **PA** = Pass-Genauigkeit.
- Team-Zusammensetzung "Option A": 2 Blocker, 1 Läufer, 1 Fänger, 1 Werfer.
- Aufstehen aus der Bodenlage kostet `STAND_UP_COST = 2` Bewegungspunkte
  (Umfallen hat auch dann eine spürbare Konsequenz, wenn es während des
  gegnerischen Zuges passiert ist – kein gratis Aufstehen vor dem eigenen Zug).

## 5. Würfelsystem

- Alle Würfe nutzen einen **W10**.
- Eine gewürfelte **10** ist immer ein Erfolg (bei Duellen: automatischer
  Sieg), eine gewürfelte **1** immer ein Misserfolg (bei Duellen: automatische
  Niederlage) – unabhängig vom Zielwert bzw. den Werten des Gegners.
- Zielwert-Würfe: `W10 + Attribut + Modifikatoren >= Basiszielwert + Zielwert-Modifikatoren`.
- Opposed-Würfe (Block, Tackle): höhere Summe gewinnt, Krit-10/Krit-1-Sonderregel
  hat Vorrang.
- Verletzungscheck (kein Opposed-Wurf, siehe Abschnitt 7b): Gewinner wirft
  `W10 + ST`, die Differenz zum RW des Verlierers wird von dessen SP
  abgezogen.

## 6. Tacklezonen

Jeder stehende (nicht liegende/verletzte) Spieler kontrolliert die 8 Felder
um sich herum. Fangen, Werfen und Ballaufnahme werden pro gegnerischer
Tacklezone, in der man sich befindet, um 1 erschwert.

## 7. Tackle (Dodge)

Bewegt sich ein Spieler (**Dodger**) aus dem Feld eines Gegners (**Tackler**)
heraus, darf der Tackler tackeln: BL des Tacklers gegen AG des Dodgers.

- Bleibt der Dodger dabei in der Tacklezone desselben Tacklers, erhält
  dieser +1 auf seinen Wurf.
- Gewinnt der Tackler, fällt der Dodger an seiner Ausgangsposition um
  (inkl. Verletzungscheck, siehe 7b: Tackler gegen Dodger), die Bewegung
  wird abgebrochen.
- Würfelt der Tackler dabei eine natürliche 1, verreißt er den Tackle und
  stürzt selbst (ebenfalls mit eigenem Verletzungsrisiko: Verletzungscheck
  gegen sich selbst, eigene ST gegen eigene RW/SP).
- Ein Sturz mit Ballverlust ist immer ein Turnover; ein Sturz ohne Ball
  beendet den Zug nicht.

## 7a. Block & Unterstützung (Assists)

Aktive Aktion gegen einen angrenzenden, stehenden Gegner (`resolveBlock`). BL-Duell,
Verlierer fällt um + Verletzungscheck (siehe 7b: Gewinner gegen Verlierer). Zählt
als die eine erlaubte Aktion des Zuges (`acted`-Flag).

**Unterstützung beim Block:** Teamkameraden des Blockers, die in der Tacklezone
des Geblockten stehen (aber selbst in keiner *weiteren* gegnerischen
Tacklezone), addieren die Hälfte ihres BL-Werts (abgerundet, `Math.floor`)
zum Blockwurf ihres Kameraden (`getBlockAssists` / `assistParts`). Umgekehrt
gilt dasselbe für Teamkameraden des Geblockten. Beide Seiten können also
gleichzeitig Unterstützung erhalten. Fließt konsistent in drei Stellen ein:

- `resolveBlock` – der eigentliche Wurf inkl. Log-Zeile, wer wen unterstützt.
- `previewBlockPreview` – die Hover-Vorschau zeigt Unterstützer und die
  korrigierte Erfolgschance.
- `findBestBlockOption` – die KI rechnet Unterstützung mit ein, wenn sie
  entscheidet, ob Blocken einer riskanten Bewegung vorzuziehen ist.

## 7b. Verletzungscheck (RW & SP)

Ausgelöst nach jedem verlorenen Block und jedem verlorenen Tackle
(`resolveInjuryCheck(winner, loser)`), sowie beim Selbst-Sturz eines
Tacklers, der eine natürliche 1 würfelt (dort ist Gewinner = Verlierer =
der stürzende Tackler selbst).

- Gewinner wirft `W10 + eigene ST`.
- Davon wird der RW (Rüstungswert) des Verlierers abgezogen; ist das
  Ergebnis negativ, richtet der Treffer keinen Schaden an (`Math.max(0, …)`).
- Die verbleibende Differenz wird von den SP (Stamina Points) des
  Verlierers abgezogen.
- Fallen die SP eines Spielers dabei auf 0 oder darunter, ist er
  **verletzt** und scheidet endgültig aus. Bleiben SP > 0, liegt er nur
  **am Boden** und steht regulär wieder auf.
- Kein Opposed-Wurf – der Verlierer würfelt hier selbst nicht mit, es gibt
  daher keine Krit-10/Krit-1-Sonderregel auf dieser Seite.
- SP werden nur durch diesen Check verringert; es gibt (noch) keine
  Regeneration oder sonstigen Verbrauch.

## 8. Pass & Fangen

- Reichweite und Schwierigkeit basieren auf derselben Metrik: der
  tatsächlichen Distanz (`fieldsCrossed`, diagonale Schritte zählen √2).
  Damit ist die reale Reichweite unabhängig von der Wurfrichtung gleich.
- Maximale Passdistanz: 9 Felder.
- Zielwert für den Wurf: `5 + zurückgelegte Distanz (aufgerundet)`, plus
  Tacklezonen des Werfers.
- Distanz-Label: ≤3 Felder = Kurzer Pass, ≤6 = Langer Pass, sonst Bombe.
- Fangversuch (Ziel 8 + Tacklezonen des Fängers) erst nach erfolgreichem Wurf.
- Liegende Spieler können nicht fangen und nicht als Passziel gewählt werden.

## 9. Ballaufnahme

Ziel 8 + Tacklezonen. Bei Misserfolg: Turnover, Ball streut (siehe unten).

## 10. Streuung (`scatterBallNear`)

Ball springt auf eines der 8 Nachbarfelder, läuft in einer Schleife weiter,
bis er entweder gefangen wird oder auf einem freien Feld liegen bleibt (max.
20 Sprünge als Sicherheitslimit). Liegende Spieler können nicht fangen – Ball
springt über sie hinweg. Fangversuch dort: Ziel 9 (+Tacklezonen), also 1
schwerer als normal.

## 11. Touchdown, Zugstruktur, Spielende

- Touchdown: Team-Punkt +1, Reset auf Startpositionen, Ball zur Mitte, Zug
  wechselt automatisch.
- Ein Team kann pro Zug mehrere Spieler bewegen; jeder Spieler max. 1 Aktion
  (Block ODER Pass).
- **Spielende:** Sofortiger Sieg bei `WIN_SCORE = 3` Touchdowns. Sonst Ende
  nach `MAX_TURNS_PER_TEAM = 10` Zügen je Team – mehr Touchdowns gewinnt,
  Gleichstand = Unentschieden. `gameEnded`-Flag sperrt danach alle Eingaben.
- **Anstoß:** Zu Spielbeginn würfeln beide Teams je einen W10
  (`rollForFirstTurn`), höherer Wurf beginnt, Gleichstand wird wiederholt.
  Nach Touchdowns bleibt die normale `endTurn()`-Wechsel-Logik unverändert.

## 12. KI (Rot)

- Nutzt dieselbe Bewegungslogik wie der Mensch (`findSmartPath`), volle
  MR-Reichweite pro Zug.
- Zielwahl (`aiChooseDestination`): eigener Ballträger → Richtung eigene
  Endzone; loser Ball → hin zum Ball; Mitspieler trägt Ball → Eskorte-Position
  vorauslaufen; Gegner trägt Ball → nächstes freies Feld neben ihm.
- Risikobewusste Bewegung (`aiAdvanceCarefully`): vor jedem riskanten Schritt
  (Dodge-Erfolgschance < 50%, Näherungsformel `opposedChance` = 50% +
  Differenz/10) prüft die KI, ob ein Block gegen einen angrenzenden Gegner
  eine bessere Chance bietet; sonst bricht sie die Bewegung lieber ab, statt
  das Risiko einzugehen.
- KI passt **nicht** selbst (keine Wurf-Entscheidungslogik implementiert).
- Reihenfolge: eigener Ballträger zuerst, dann nach Nähe zum Ball sortiert.

## 13. UI/UX-Konventionen

- **Log:** gruppiert pro Aktion (Kopfzeile mit Icon: 🏃 Bewegung, 🛡️ Block,
  🎯 Pass), Hintergrundfarbe = Team-Farbe des **ausführenden** Teams (nicht
  abwechselnd). Jeder Wurf zeigt die volle Rechnung (Wurf + Attribut +
  Modifikatoren = Summe, Ziel = Basis + Modifikatoren).
- **Vorschau-Feld** (Hover): zeigt vor der Aktion Zielwerte/benötigte Würfe
  (Pass, Ballaufnahme) bzw. Erfolgswahrscheinlichkeiten (Block, Tackle-Risiko
  pro Bewegungsschritt) – nutzt dieselbe Pfadsuche wie die echte Bewegung.
- **SP-Anzeige:** kleines rotes Herz unten links an jedem Spieler-Icon
  (spiegelbildlich zum Nummern-Badge unten rechts), zeigt die aktuellen
  Stamina Points (`drawHeart`).

## Offene Punkte / Nächste Schritte

- **Manager-Teil** ist konzeptionell vorgesehen, aber im Code noch nicht
  begonnen: Kader-Verwaltung, Kauf/Verkauf, Training, Stadion, Werbung,
  Liga-System.
- Keine Persistenz/Speicherung – Spielstand geht bei Neuladen verloren.
  Relevant, sobald ein Manager-Teil mit Kader über mehrere Spiele hinweg
  existieren soll.
- RW und SP fließen in den Verletzungscheck ein (siehe 7b), haben aber
  sonst noch keine weitere Spielmechanik – kein Regenerations- oder
  Erschöpfungssystem für SP jenseits des Verletzungschecks.
- KI wirft nicht selbst (keine Pass-Entscheidungslogik für Rot).

## Projektstruktur

```
hiveball/
├── README.md                                   ← dieses Dokument
├── src/
│   └── hiveball.html                           ← einziger Prototyp (HTML/CSS/JS, keine Deps)
└── docs/
    └── Hiveball_Manager_Regelwerk_v0_12.pdf     ← ursprüngliches Design-/Regeldokument
```

## Hinweis zur Weiterentwicklung

Die Ein-Datei-Architektur (`src/hiveball.html`) ist eine bewusste
Design-Entscheidung für den Kernspiel-Prototyp (keine Build-Schritte, überall
lauffähig). Diese Konvention sollte beibehalten werden, solange keine
triftigen Gründe (z.B. der Manager-Teil mit eigenem Zustand/Persistenz)
dagegen sprechen – dann ggf. gezielt in mehrere Dateien aufteilen und das
hier dokumentieren.
