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

### Extrafelder

Sind die regulären MR aufgebraucht, kann sich jeder Spieler bis zu
`MAX_EXTRA_SQUARES = 2` zusätzliche Felder bewegen (`availableExtraSquares`,
`attemptExtraSquare`). Jedes Extrafeld kostet `EXTRA_SQUARE_SP_COST = 1` SP
statt eines Bewegungspunkts und erfordert einen Agilitätswurf (`W10 + AG`)
gegen `EXTRA_SQUARE_TARGET = 10`. Wie viele Extrafelder tatsächlich verfügbar
sind, wird zusätzlich durch die aktuellen SP begrenzt (ein Extrafeld ohne SP
ist nicht möglich). Bei einem Fehlschlag stürzt der Spieler an seiner
aktuellen Position, verliert zusätzlich `EXTRA_SQUARE_SP_COST` SP (insgesamt
also 2 SP für dieses Extrafeld) und die Bewegung endet dort – ein getragener
Ball fällt dabei zu Boden und verspringt wie bei jedem anderen Sturz.

Gilt gleichermaßen für Mensch (`movePlayer`) und KI (`aiAdvanceCarefully`);
die grün/gelb eingefärbten erreichbaren Felder auf dem Spielfeld sowie die
Hover-Vorschau (`previewMovePreview`) unterscheiden dabei zwischen regulär
erreichbaren Feldern (grün) und nur über Extrafelder erreichbaren Feldern
(gelb, inkl. Hinweis auf SP-Kosten und Sturzrisiko).

### Skills

Jede Position kann von Beginn an feste Skills mitbringen (`POSITIONS[...].skills`,
übernommen in `player.skills`). Bislang implementiert:

| Position | Skill    | Effekt |
|----------|----------|--------|
| Läufer   | **Blitz** | Kein Bewegungsabzug beim Blocken (siehe Abschnitt 7a), auch wenn vorher MR verbraucht wurden. |
| Blocker  | **Block** | Beim Blocken (nicht beim Tackeln) +1 auf den Blockwurf, für Blocker *und* Geblockten. Hat nur einer von beiden diesen Skill, gewinnt er den Block auch bei Gleichstand automatisch, der andere stürzt. |
| Fänger   | **Dodge** | Wird geblockt, wirft der Fänger AG statt BL. Gewinnt er (oder hält den Block zu seinen Gunsten), fällt der Angreifer *nicht* wie sonst üblich – außer der Angreifer würfelt dabei selbst eine natürliche 1. |

Weitere Positionen/Skills sind als Ausbaustufe vorgesehen (siehe Offene Punkte).

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

**Bewegungsabzug beim Block:** Ein Block nach vorheriger Bewegung im selben Zug ist
grundsätzlich erschwert (`movementBlockPenalty`). Pro angefangene zwei in diesem Zug
bereits genutzte MR (`MOVEMENT_BLOCK_PENALTY_PER_MR = 2`, ungerade genutzte MR werden
aufgerundet) sinkt der BL-Wert des *Blockers* (nicht des Geblockten) um 1. Auch für
Aufstehen genutzte MR (`STAND_UP_COST`) zählen mit, da beides über `movesLeft`
erfasst wird. Gilt nur für den aktiv blockenden Spieler, nicht für Unterstützer.
Fließt konsistent in dieselben drei Stellen ein wie die Unterstützung
(`resolveBlock`, `previewBlockPreview`, `findBestBlockOption`).

Spieler mit dem Skill **Blitz** (siehe Abschnitt 4) sind von diesem Abzug
komplett ausgenommen, unabhängig davon, wie viele MR sie bereits genutzt haben.

**Skill Block:** Spieler mit dem Skill **Block** (siehe Abschnitt 4) erhalten
+1 auf ihren BL-Wurf beim Blocken – das gilt für den Blocker *und* für den
Geblockten, aber ausdrücklich nicht beim Tackeln (`attemptLeavingTackleZones`
bleibt unverändert). Haben beide Beteiligten den Skill, heben sich die Boni
gegeneinander auf. Hat nur einer von beiden den Skill, gewinnt er bei
Gleichstand automatisch (statt des sonst üblichen "Unentschieden – beide
bleiben stehen"); der andere fällt um und durchläuft den Verletzungscheck
(siehe 7b) wie ein regulärer Verlierer.

**Skill Dodge:** Wird ein Spieler mit dem Skill **Dodge** (siehe Abschnitt 4)
geblockt, wirft er statt seines BL-Werts seinen AG-Wert im BL-Duell (weiterhin
inkl. eigener Unterstützung/Block-Skill-Bonus, falls vorhanden). Gewinnt der
Dodge-Spieler den Block (oder hält ihn per Gleichstand-Regel zu seinen
Gunsten), fällt der Angreifer – anders als bei einem normalen Block – *nicht*
um; es findet auch kein Verletzungscheck statt. Einzige Ausnahme: Würfelt der
Angreifer dabei selbst eine natürliche 1, stolpert er trotzdem und durchläuft
den regulären Sturz- und Verletzungscheck als Verlierer. Gewinnt umgekehrt der
Angreifer den Block regulär, fällt der Dodge-Spieler wie gewohnt um.

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
- SP werden außerdem durch Extrafelder verringert (Abschnitt 4) und durch
  Foul (7c) – dort mit derselben Formel, aber ohne dass ein Sturz die
  Vorbedingung ist. Regeneration gibt es bislang nur nach einem Touchdown
  (Abschnitt 11).

## 7c. Foul

Ein stehender, nicht erschöpfter (`!acted`) Spieler kann einen angrenzenden,
**liegenden** Gegner foulen (`resolveFoul(attacker, victim)`). Zählt als die
eine erlaubte Aktion des Zuges, genau wie Block oder Pass. Auslösen entweder
über den Button "Foul" oder per Klick direkt auf den liegenden Gegner (ein
Klick auf einen angrenzenden Gegner blockt bei stehenden und fault bei
liegenden Zielen).

**Limit: nur ein Foul pro Zug.** Unabhängig davon, wie viele eigene Spieler
noch nicht agiert haben, darf pro Zug insgesamt nur einmal gefoult werden
(`foulUsedThisTurn`, wird bei jedem Zugwechsel in `endTurn()` zurückgesetzt).
Das Flag wird gesetzt, sobald `resolveFoul` läuft – unabhängig vom Ausgang
(auch ein unentdecktes oder folgenloses Foul verbraucht das Limit). Gilt
gleichermaßen für Button, Direktklick und die KI-Entscheidung; ist das Limit
bereits ausgeschöpft, zeigen Button/Vorschau/Klick einen entsprechenden
Hinweis statt der Aktion.

1. **Verletzungscheck:** exakt dieselbe Formel wie der reguläre
   Verletzungscheck (Abschnitt 7b, `resolveInjuryCheck(attacker, victim)`) –
   W10 + ST des Foulenden vs. RW des Opfers, Differenz kostet dessen SP,
   SP ≤ 0 = verletzt. Kein Opposed-Wurf, keine Krit-10/Krit-1-Sonderregel
   (das Opfer liegt bereits am Boden und wehrt sich nicht).
2. **Entdeckungswurf** (`rollAgainstTarget`, danach, mit dem Schaden aus
   Schritt 1): AG des Foulenden gegen `ZIELWERT_FOUL = 4`, erschwert um
   `Math.floor(Schaden / 2)`. Erfolg = Foul bleibt unentdeckt. Fehlschlag =
   Platzverweis: der Foulende scheidet aus wie ein Verletzter (`injured =
   true`), erleidet dabei aber selbst **keinen** SP-Schaden. Zur
   Unterscheidung von einer echten Verletzung (z.B. für eine spätere
   Statistik/den Manager-Teil) wird zusätzlich `sentOff = true` gesetzt –
   spielmechanisch hat dieses Flag aktuell keine eigene Bedeutung, der
   Spieler wird exakt wie ein Verletzter vom Feld genommen. Hier gilt
   Krit-10/Krit-1 ganz normal (in `rollAgainstTarget` eingebaut).

**Design-Entscheidung – Trade-off zwischen Positionen:** Der Entdeckungswurf
kombiniert bewusst AG (Heimlichkeit) mit dem halbierten Schaden aus Schritt 1
(Brutalität). Dadurch ergibt sich ein Positions-Trade-off: ein Blocker (hohe
ST, niedrige AG) richtet im Foul viel Schaden an, wird aber deutlich öfter
erwischt; ein Fänger/Läufer (hohe AG, niedrige ST) foult "sauberer" – kaum
Schaden, aber auch ein deutlich geringeres Entdeckungsrisiko. Bei Zielwert 4
liegt das Grundrisiko (ohne Schadensfolge) bei ca. 30 % Entdeckung für einen
durchschnittlichen Wert, das durch angerichteten Schaden weiter steigt.

**KI:** Rot erwägt ein Foul, wenn ein liegender blauer Gegner direkt angrenzt
und noch keine Aktion in diesem Zug stattgefunden hat (`evaluateFoulOutcome`,
siehe Abschnitt 12). Gibt es mehrere liegende Gegner, hat der Ballträger
Priorität (analog zur Block-Zielwahl).

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
  wechselt automatisch. Zusätzlich ruhen sich dabei alle noch im Spiel
  befindlichen Spieler (SP > 0, betrifft beide Teams) kurz aus:
  `regenerateStaminaAfterTouchdown` erhöht ihre SP um den eigenen CO-Wert,
  gedeckelt auf `spMax` (den Wert zu Spielbeginn, `CO * STAMINA_MULTIPLIER`).
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
- **Konservativer Einsatz von Extrafeldern** (`aiExtraSquareBudget`, siehe
  Abschnitt 4 zu Extrafeldern): Die KI riskiert SP-Verlust und Sturz nur, wenn
  sich dadurch ein klarer Vorteil ergibt, nicht um bloß die Distanz zu einem
  Ziel zu verringern:
  - als eigener Ballträger nur, um tatsächlich aus der Bedrohungsreichweite
    eines Gegners zu entkommen (`isThreatenedPosition`, Näherung: gegnerische
    MR + 1 Feld) – nicht für zusätzliche Vorwärtsbewegung, wenn schon sicher;
  - gegen den gegnerischen Ballträger nur, wenn das tatsächlich in
    Blockreichweite (angrenzend) bringt, nicht nur näher heran;
  - bei einem losen Ball nur, wenn er dadurch in diesem Zug noch aufgenommen
    werden kann;
  - beim Eskortieren des eigenen Ballträgers werden grundsätzlich keine
    Extrafelder eingesetzt (kein klarer Sofortvorteil definiert).
  Genutzt wird dabei stets die minimal nötige Anzahl an Extrafeldern, nicht
  automatisch das verfügbare Maximum.
- KI passt **nicht** selbst (keine Wurf-Entscheidungslogik implementiert).
- **Foul-Entscheidung** (`evaluateFoulOutcome`, siehe 7c): Grenzt ein liegender
  blauer Gegner an und hat der Rot-Spieler noch keine Aktion in diesem Zug
  ausgeführt, wird das Foul exakt bewertet – über alle 10×10 möglichen
  Kombinationen aus Verletzungs- und Entdeckungswurf werden der erwartete
  Schaden (SP-Verlust im Schnitt) und die Entdeckungswahrscheinlichkeit
  berechnet. Die KI foult, wenn der erwartete Schaden das Entdeckungsrisiko
  übersteigt (`expectedDamage > catchChance`, Schaden in SP-Punkten direkt
  gegen die Wahrscheinlichkeit 0–1 verglichen – eine bewusst einfache
  Heuristik statt einer echten Kosten-Nutzen-Umrechnung). Gibt es mehrere
  liegende Gegner, hat der Ballträger Priorität (wie bei der Blockzielwahl).
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
- RW und SP fließen in den Verletzungscheck (siehe 7b) und in Extrafelder
  (siehe Abschnitt 4) ein. SP regeneriert bislang nur nach einem Touchdown
  (siehe Abschnitt 11, `regenerateStaminaAfterTouchdown`), sonst gibt es kein
  Erschöpfungssystem darüber hinaus: SP kann durch Extrafelder auf 0 oder
  darunter fallen, ohne dass das (anders als beim Verletzungscheck)
  automatisch "verletzt" auslöst – ein Spieler mit sehr niedrigen/negativen SP
  kann weiterhin ganz normal spielen, nur eben keine (oder nur noch wenige)
  Extrafelder mehr gehen. Da die Touchdown-Regeneration nur für `SP > 0`
  greift, regeneriert ein Spieler, der exakt bei 0 oder darunter steht, dabei
  nicht mehr – ein Grenzfall, den die aktuelle Regel wörtlich so vorgibt.
- **Skills** sind als System angelegt (`POSITIONS[...].skills`, `player.skills`,
  `hasSkill`), bislang für Läufer (Blitz), Blocker (Block) und Fänger (Dodge)
  belegt. Werfer hat noch keinen eigenen Skill – vorgesehen als nächster Schritt.
- KI wirft nicht selbst (keine Pass-Entscheidungslogik für Rot).
- `sentOff` (siehe 7c) ist rein informativ und wird aktuell nirgends
  ausgewertet – vorgesehen für eine spätere Statistik/den Manager-Teil, um
  Platzverweise von echten Verletzungen unterscheiden zu können.

## Projektstruktur

```
hiveball/
├── README.md                                   ← dieses Dokument
├── src/
│   ├── hiveball.html                           ← Kernspiel-Prototyp (HTML/CSS/JS, keine Deps)
│   └── manager/                                ← Manager-Teil, im Aufbau (siehe Spezifikation)
│       ├── overview.html                       ← Übersicht (Kasse, Teamwert, Kadergröße, Gebäude-Level) – Startseite
│       ├── index.html                          ← minimale Kader-UI (Verein anlegen, Spieler/Skills kaufen)
│       ├── training.html                       ← Trainingscenter-UI (physisches Training, Slot-Auswahl)
│       ├── academy.html                        ← Akademie-UI (Theorie-Training/Skills, Slot-Auswahl)
│       ├── layout.js                           ← gemeinsame Kopfzeile (Logo-Slot + Navigation) aller Seiten
│       ├── manager.css                         ← gemeinsames Stylesheet (Anthrazit-Theme)
│       ├── leagueConfig.js                     ← Default-Konfiguration der Liga
│       ├── positions.js                        ← Positions-/Preistabelle inkl. Lineman
│       ├── state.js                            ← Datenmodell (ManagerPlayer, Club) + Persistenz
│       ├── formulas.js                         ← Formeln: Marktwert, Skill-Preis/-Limit, Reps-Schwelle/Maximalwert, Alter/Verfallschance
│       ├── transferMarket.js                   ← einfacher Transfermarkt (Spieler kaufen)
│       ├── economy.js                          ← Vereinskasse (Gehälter, Siegprämie)
│       ├── skills.js                           ← EP-für-Skills (Skill-Kauf gegen XP)
│       ├── training.js                         ← Reps-Sammlung + physisches Training (Warteschlange verbrauchen)
│       ├── aging.js                            ← Aging-System (Formel 3.5) + Zwangsrente (Formel 3.8)
│       └── nomination.js                       ← Matchday-Status je Spieler (Feld/Bank/Frei), direkt im Kader
└── docs/
    ├── Hiveball_Manager_Regelwerk_v0_12.pdf     ← ursprüngliches Design-/Regeldokument
    └── hiveball_manager_spezifikation.md        ← technische Spezifikation Manager-Teil
```

## Hinweis zur Weiterentwicklung

Die Ein-Datei-Architektur (`src/hiveball.html`) ist eine bewusste
Design-Entscheidung für den Kernspiel-Prototyp (keine Build-Schritte, überall
lauffähig). Diese Konvention sollte beibehalten werden, solange keine
triftigen Gründe (z.B. der Manager-Teil mit eigenem Zustand/Persistenz)
dagegen sprechen – dann ggf. gezielt in mehrere Dateien aufteilen und das
hier dokumentieren.
