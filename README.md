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

Zwei-Teile-Architektur:

- **Kernspiel**: das eigentliche rundenbasierte Match, 5 gegen 5 (bzw. mehr
  bei Bank-Wechseln, siehe unten).
- **Manager-Teil** (Phase 1+2 abgeschlossen, Phase 3 offen – siehe
  `docs/hiveball_manager_spezifikation.md` und `src/manager/`):
  Kader-Verwaltung, Kauf/Verkauf, Training, Aging, Matchday-Nominierung,
  sieben ausbaubare Gebäude, komplette Vereinsökonomie, manuelle
  Wechselauswahl. Persistiert über `localStorage`, geteilt mit dem Kernspiel
  (siehe Abschnitt 2).

## 2. Aktueller Stand der Datei

**Kernspiel:** `src/hiveball.html` – ein weiterhin weitgehend eigenständiger
Browser-Prototyp (HTML/CSS/Vanilla JS, keine Frameworks, keine Build-Schritte).
Läuft rein clientseitig, **kein Backend, kein Multiplayer**.

Seit der Manager-Integration (Phase 1g) ist die Datei ein ES-Modul
(`<script type="module">`) und lädt beim Start `src/manager/state.js`: Existiert
ein Verein mit vollständiger Matchday-Nominierung (5 Feldspieler) in
`localStorage`, spielt **Blau** mit dessen echten (trainierten/gealterten)
Spielerwerten und Skills statt der festen Beispielaufstellung, inkl. Bank für
Wechsel bei Verletzung/Platzverweis (gleiche Position → Lineman → beliebig
verfügbar). **Rot** (KI) kam ursprünglich immer aus der festen Aufstellung
"Option A" plus 2 Lineman auf der Bank; seit der Singleplayer-Liga (siehe
unten) lädt Rot stattdessen den Gegner des aktuellen Liga-Spieltags aus
`src/manager/opponents.js` – fünf datengetriebene KI-Vereine mit eigenen
Namen/Werten/Skills/Persönlichkeit. Nur ohne Verein/ohne vollständige
Nominierung bleibt das Kernspiel unverändert über die feste `TEAM_ROSTER`
eigenständig spielbar (Fallback).

Seit Phase 1h meldet `endGame()` außerdem für jeden Blau-Spieler mit
Kaderanbindung SP-Endstand + Ausscheiden-Flag an `src/manager/injury.js`:
ausgeschiedene Spieler erhalten einen gewürfelten Verletzungsschwere-Grad
(Formel 3.6, inkl. möglichem Attributverlust/Zwangsrente) und werden aus der
Nominierung entfernt; der gesamte Kader heilt passiv 1 Spiel Ausfallzeit pro
gespieltem Match (Formel 3.7). Manuell einem Behandlungsplatz zugewiesene
Spieler (`src/manager/medical.html`, bis zu `medical.level` gleichzeitig)
heilen stattdessen mit der höheren, levelabhängigen Reduktion und geben den
Platz automatisch frei, sobald sie vollständig geheilt sind. Echte Matches
zählen dabei genauso als gespieltes Spiel wie der Debug-Button "Spiele
simulieren" (dasselbe `checkAgeCycleAndDecline`) – Alterszyklus/-verfall und
Alters-Zwangsrente können also jetzt auch aus echten Matches folgen. Zwei
Karriere-Zähler (Touchdowns, verursachte Verletzungen – kein Teil der
Spezifikation, für die Hall of Fame ergänzt) werden dafür pro Spieler direkt
im Kernspiel mitgezählt (`checkScore`, `resolveBlock`,
`attemptLeavingTackleZones`, `resolveFoul`). Scheidet ein Spieler per
Zwangsrente aus, bleibt sein Datensatz erhalten und erscheint auf der
"Hall of Fame"-Seite mit Statistik + Ausscheidegrund.

Seit Phase 1j zählt das Kernspiel zusätzlich pro Blau-Spieler mit
Kaderanbindung mit, was für die Post-Match-Auswertung nötig ist: BL bei jedem
Blockversuch, ST beim Gewinner jedes Verletzungschecks, CO beim Verlierer
eines schadenlos überstandenen Verletzungschecks (`damage === 0`) sowie
einmal pro Spiel pauschal (sofern die 4er-Obergrenze dadurch noch nicht
erreicht ist), AG bei Ballaufnahme/Fang/überstandenem Tackle und PA beim
gelungenen Wurf – jeweils gedeckelt auf `maxRepsPerGamePerAttribute`.
`processManagerPostMatch()` baut daraus (plus Touchdowns/Pässen/Fängen/
gewonnenen Blocks/überstandenen Tackles/Bomben/Underdog-Blocks) ein
Ergebnisobjekt pro Spieler und übergibt es an `processPostMatch()` in
`src/manager/postMatch.js`: dort werden EP nach `config.xp.perAction`/
`bonuses` vergeben (inkl. MVP-Bonus für die höchste Summe aus Touchdowns,
gewonnenen Blocks, Fängen, Pässen und überstandenen Tackles sowie
Sieg-Bonus), die Reps über das bestehende `creditReps` (Alters-Modifikator,
Trainings-Warteschlange bei erreichter Schwelle) gutgeschrieben, und
Gehalt/Sieg-Einnahmen über `economy.js` verbucht. Ein Lauf-Touchdown-Bonus
ist bewusst zurückgestellt (siehe `docs/hiveball_manager_spezifikation.md`,
Abschnitt 11) – die reine Einzelzug-Distanz wäre kaum aussagekräftig, dafür
müsste über mehrere Runden verfolgt werden.

Seit Phase 1e gibt es außerdem `src/manager/settings.html`: ein generischer
Editor für `leagueConfig` (Training, Aging, Medical, XP, Economy, Roster –
`injury.severityTable` bleibt bewusst außen vor, da sie Würfel-Formeln statt
Zahlenwerten enthält). Änderungen werden über `saveLeagueConfigOverrides()`
sofort in das lebende `defaultLeagueConfig`-Objekt gemergt und zusätzlich in
`localStorage` gespeichert, sodass sie auch nach einem Reload gelten – alle
bestehenden Manager-Dateien lesen `defaultLeagueConfig` ohnehin per
Objektreferenz zur Laufzeit, mussten also nicht angepasst werden.
„Zurücksetzen auf Standard" stellt die beim Modul-Start eingefrorene
Werkskopie wieder her.

Seit Phase 1k zeigt `endGame()` außerdem einen Post-Match-Bildschirm
(Overlay direkt in `hiveball.html`, kein Seitenwechsel): Endstand,
Touchdown-Verlauf (Zug/Team/Spieler), eine kombinierte Spielerliste beider
Teams (Match-Statistik für alle, Reps/EP zusätzlich für Blau-Spieler mit
echter Kaderanbindung – Rot hat grundsätzlich keinen persistenten Verein und
zeigt dort bewusst „–"), die vollständig aufgeschlüsselte Vereinskasse (siehe
Phase 2 unten) sowie MVP-Hervorhebung und Hinweise zu Verletzungen/
Zwangsrenten und neu fürs Training angemeldeten Spielern. `processPostMatch()`
in `src/manager/postMatch.js` gibt dafür jetzt eine strukturierte
Zusammenfassung zurück statt nur Seiteneffekte zu haben.

**Phase 2 (Ökonomie-Redesign + Gebäude) ist umgesetzt.** Die ursprünglichen
Gehälter (pauschal 9 % des Marktwerts fürs gesamte Kader) deckten die
Einnahmen (nur Siegprämie) bei Weitem nicht – komplett neu aufgebaut:

- **Gehälter** gestaffelt nach der tatsächlichen Rolle in DIESEM Match (nicht
  der reinen Vor-Match-Nominierung): Feld 10 %, Bank 5 %, Frei 2 % des
  Marktwerts. Einwechselspieler zahlen den Feld-Satz, auch wenn sie vor dem
  Match nur als Bank nominiert waren (`src/manager/economy.js`
  `deductSalaries`).
- **Einnahmen pro Match:** Zuschauer (würfelbasiert – Reputation × 100 pro
  Pip, Würfelgröße abhängig vom Stadion-Level: W6/W8/W10/W15/W20 für Level
  1–5), fester Sponsor (20.000 €), Siegprämie (8.000 €), Fanshop
  (reputationsabhängig, Levelbasis × Reputation/50), Catering (fester
  Prozentsatz der Zuschauereinnahme DIESES Matches, steigt pro Level).
- **Reputation** ändert sich nach Sieg/Niederlage nach Elo-Prinzip (Erwartung
  aus der Differenz zur Gegner-Reputation – seit der Singleplayer-Liga die
  feste Startreputation des tatsächlichen Liga-Gegners dieses Spieltags,
  50/60/70/80/90 nach Stärke-Rang, siehe unten; nur ohne Liga-Kontext greift
  weiterhin ein fester Platzhalter). Der PR-Bonus aus dem Öffentlichkeitsarbeit-Level wirkt
  bewusst asymmetrisch: verstärkt den Gewinn bei Sieg, dämpft aber den
  Verlust bei Niederlage – kann also nie schaden.
- **Sieben Gebäude** (`club.facilities`): Trainingscenter, Akademie,
  Medizinische Abteilung starten kostenlos bei Level 1 (wie zuvor); Stadion
  ebenfalls (ein Verein braucht immer eine Spielstätte); Fanshop, Catering
  und Öffentlichkeitsarbeit (vormals "Fan-Sektor", nie mit echter Funktion
  belegt) starten bei Level 0. Jedes Gebäude hat Ausbaukosten (einmalig,
  geometrisch wachsend) und laufenden Unterhalt pro Match (Level 1 überall
  unterhaltsfrei) – siehe `leagueConfig.js` `economy.{stadium,fanshop,
  catering,physicalTraining,theoryTraining,medical,publicRelations}`.
  Fanshop/Catering dürfen nie über das aktuelle Stadion-Level hinaus
  ausgebaut werden. Eigene Seiten je Gebäude (`stadium.html` bündelt
  Stadion+Fanshop+Catering, dazu `training.html`, `academy.html`,
  `medical.html`, `public-relations.html`) zeigen Level, aktuellen **und**
  künftigen Unterhalt sowie den Ausbau-Button – die gemeinsame
  `facilityUpgradeUI.js` rendert das für alle fünf Seiten identisch.
- **Skill "Sponsor"**: kein Kernspiel-Effekt – kehrt für den betreffenden
  Spieler das sonst fällige Gehalt in eine gleich hohe Sponsoreneinnahme des
  Vereins um ("gute Kontakte zu einem eigenen Sponsor").
- **Neue Seite `finances.html`**: links die tatsächliche Abrechnung des
  letzten Spieltags (`club.lastMatchEconomy`, persistiert seit Ende der
  Phase-2-Arbeiten – vorher gingen diese Zahlen nach dem Post-Match-Bildschirm
  verloren), rechts eine reine Vorschau-Berechnung für den kommenden
  Spieltag auf Basis des aktuellen Vereinszustands
  (`previewNextMatchEconomy`). Würfelabhängige Posten (Zuschauer, davon
  abgeleitet Catering) sind dort klar als statistischer Durchschnitt (Ø)
  gekennzeichnet, die Siegprämie separat als "nur bei Sieg" ausgewiesen.

**Manuelle Wechselauswahl** (ebenfalls Phase 2, ersetzt die bis dahin
automatische Priorität für Blau): `startKickoff()` in `hiveball.html`
ersetzt Rot (KI) weiterhin automatisch (gleiche Position → Lineman →
beliebig), pausiert aber für Blau bei jeder offenen Vakanz (verletzter, noch
nicht ersetzter Feldspieler) mit einem eingeblendeten Fenster
(`#substitution-overlay`, analog zum Post-Match-Bildschirm): alle 5
Feld-Positionen sichtbar, offene Slots mit Auswahltabelle aus der aktuellen
Bank. "Fortsetzen" wird erst klickbar, wenn alle Slots besetzt sind oder die
Bank leer ist – im zweiten Fall spielt Blau bewusst in Unterzahl weiter.
Wichtiger Bugfix dabei: `endTurn()` darf erst laufen, **nachdem** der Kickoff
(inkl. dieser Wechselauswahl) wirklich abgeschlossen ist – sonst schaltete
Rot (KI) bereits während des offenen Wechselfensters unsichtbar auf
veralteten (noch nicht zurückgesetzten) Positionen weiter.

**Singleplayer-Liga (Slice A+B, kein Teil des ursprünglichen Phasenplans –
siehe `docs/hiveball_manager_spezifikation.md` Abschnitt 10).** Ersetzt den
einen festen "Red AI"-Platzhalter durch eine 6-Team-Liga (der eigene Verein
plus fünf datengetriebene KI-Gegner):

- `src/manager/opponents.js`: fünf Gegnervereine als aufsteigende
  Stärke-Leiter (Wiesen-Grashüpfer → Grüne Zikaden → Stahl-Ameisen →
  Sturm-Wespen → Königinnengarde), jeder positionskonform und innerhalb der
  Trainingscenter-/Akademie-Attributdecken, mit fester Startreputation
  (50/60/70/80/90 nach Rang) sowie einer KI-`personality` (siehe Abschnitt 12).
- `src/manager/league.js`: Einfachrunde über 5 Spieltage – der eigene Verein
  trifft die Gegner in aufsteigender Reihenfolge; die je zwei übrigen
  Begegnungen eines Spieltags werden über ein Stärke-Rating
  (`rateRoster`/`rateOpponent`) abstrakt simuliert und beim Verbuchen des
  eigenen Ergebnisses festgeschrieben (kein Neu-Würfeln bei Reload). Tabelle
  mit 3/1/0 Punkten, Tie-Breaker TD-Differenz → TD erzielt →
  Verletzungsdifferenz. `startNewSeason()` erzeugt einen neuen Spielplan bei
  gleichbleibendem, weiterentwickeltem Kader.
- Neue Seite `src/manager/league.html` (Nav-Punkt "Liga"): Reiter
  Tabelle/Spielplan, Spieltag-Navigation, Saison-Abschluss +
  "Neue Saison"-Button. `next-match.html` zeigt den Spielplan-Gegner samt
  ★-Stärkeanzeige statt eines festen "Red AI"-Textes.
- `hiveball.html` `setupTeams()` lädt Rot über `loadRedRosterFromLeague()`
  aus dem aktuellen Liga-Spieltag (Fallback: feste `TEAM_ROSTER`, falls kein
  Verein/keine Liga existiert); `processManagerPostMatch()` verbucht das
  gespielte Ergebnis über `recordPlayerLeagueResult()` in die Liga.

**Gegner-Startreputation:** `economy.js` `updateReputation()` nimmt seither
einen optionalen `opponentReputation`-Parameter; `postMatch.js` zieht dafür
den tatsächlichen Liga-Gegner des gerade gespielten Spieltags (noch vor dem
Verbuchen des Liga-Ergebnisses) und übergibt dessen feste Startreputation
statt des bisherigen festen Platzhalters. Ohne Liga-Kontext (z. B. sehr alte
Spielstände) bleibt der alte Platzhalter als Fallback erhalten.

**KI-Persönlichkeiten (Slice C) und Selbstspiel-Tuning** – siehe Abschnitt 12
für die Verhaltenslogik und `scripts/tune-ai-personalities.mjs` für das
Kalibrierungswerkzeug.

**"Team löschen"** (Übersicht, Nutzeranfrage): roter Button in einer neuen
"Gefahrenzone", öffnet ein Bestätigungs-Modal (kein natives `confirm()`, da
eigene Button-Beschriftungen "Team löschen"/"Abbrechen" gefordert waren).
`state.js` `deleteClub(clubId)` entfernt den Club-Datensatz sowie jeden
Spieler mit dieser `clubId` – aktiver Kader **und** Hall-of-Fame-
Ausgeschiedene, die nur noch über `clubId` auffindbar sind. `club.league`
(Liga-/Saisonstand) lebt eingebettet im Club-Objekt und wird damit
automatisch mitgelöscht; `leagueConfigOverrides` (globale Regel-
Einstellungen) bleiben bewusst unangetastet, da sie keine Team-Eigenschaft
sind. Nach dem Löschen Redirect auf `index.html`, das bei fehlendem Verein
automatisch das bestehende "Verein gründen"-Formular zeigt.

**Kernspiel-Oberfläche neu strukturiert** (Nutzeranfrage): statt einer
einzigen Seitenleiste mit allem übereinander (Namen/Score/Züge, Status,
Buttons, Hover-Vorschau, Log, komplette Regel-Legende) jetzt klar getrennte
Bereiche – eine Header-Leiste oberhalb des Spielfelds mit drei zentrierten
Zeilen (Teamnamen, Punkte, Zuganzeige, je durch ":" getrennt), rechts vom
Spielfeld ein Spieler-Info-Panel für den aktivierten Spieler (Icon, Name,
Position, Attribute, Skills als Badges mit Tooltip) mit den Aktions-Buttons
darunter, das Log unterhalb von Spielfeld + Seitenpanel, und die komplette
Regel-Legende als Hilfe-Overlay (Button "❓ Hilfe", schließbar über "OK")
statt permanent sichtbarem Text. Nebenbei-Fix: `teams[TEAM_BLUE].name` wurde
zuvor nie gesetzt (blieb immer beim Default "Blau") – zeigt jetzt analog zu
Rot den echten Vereinsnamen, sobald ein Verein mit vollständiger
Matchday-Nominierung existiert.

Zwei Teams: **Blau** (menschlich gesteuert) gegen **Rot** (KI mit
Team-Persönlichkeit, siehe Abschnitt 12).

**Wichtig seit der Manager-Integration (ES-Module):** normale Browser
(Chrome/Edge) blockieren `<script type="module">`-Importe über `file://`
aus Sicherheitsgründen ("Cross origin requests are only supported for
protocol schemes: http, https, ..."). Doppelklicken auf `src/hiveball.html`
oder eine `src/manager/*.html`-Seite zeigt dann eine leere/kaputte Seite
ohne Fehlermeldung im UI (nur in der Browser-Konsole, F12). Daher:

```bash
node scripts/dev-server.mjs   # oder: npm run dev
```

und dann `http://localhost:8420/...` statt `file://...` öffnen (siehe
Konsolen-Ausgabe für die genauen Links). Kein `npm install`, keine
Abhängigkeiten – `scripts/dev-server.mjs` nutzt nur Node-Bordmittel. Kein
echter Build-Schritt, nur ein laufender Server-Prozess.

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
statt eines Bewegungspunkts und erfordert einen Agilitätswurf (`W10 + AG`,
mit dem Skill **Trittsicher**: +1) gegen `EXTRA_SQUARE_TARGET = 10`. Wie
viele Extrafelder tatsächlich verfügbar sind, wird zusätzlich durch die
aktuellen SP begrenzt (ein Extrafeld ohne SP ist normalerweise nicht
möglich – außer mit dem Skill **Zweite Luft**, der das erste Extrafeld einer
Bewegung von den SP-Kosten befreit, siehe `canAffordExtraSquare`). Bei einem
Fehlschlag stürzt der Spieler an seiner aktuellen Position, verliert
zusätzlich `EXTRA_SQUARE_SP_COST` SP (insgesamt also 2 SP für dieses
Extrafeld, bzw. 1 SP mit Zweite Luft) und die Bewegung endet dort – ein
getragener Ball fällt dabei zu Boden und verspringt wie bei jedem anderen
Sturz.

Gilt gleichermaßen für Mensch (`movePlayer`) und KI (`aiAdvanceCarefully`);
die grün/gelb eingefärbten erreichbaren Felder auf dem Spielfeld sowie die
Hover-Vorschau (`previewMovePreview`) unterscheiden dabei zwischen regulär
erreichbaren Feldern (grün) und nur über Extrafelder erreichbaren Feldern
(gelb, inkl. Hinweis auf SP-Kosten und Sturzrisiko).

### Skills

Jede Position kann von Beginn an feste Skills mitbringen (`POSITIONS[...].skills`,
übernommen in `player.skills`). Alle übrigen Skills werden im Manager-Teil
gegen EP gekauft und über die Akademie trainiert (`src/manager/skills.js`,
`leagueConfig.js` `xp.skillCosts`) – Werfer hat weiterhin keinen eigenen
**Start**-Skill, kann aber wie jede Position zusätzliche Skills erlernen.
Zwölf Skills sind mittlerweile mit echter Wirkung implementiert:

| Skill | Effekt |
|-------|--------|
| **Blitz** (Läufer-Start) | Kein Bewegungsabzug beim Blocken (siehe Abschnitt 7a), auch wenn vorher MR verbraucht wurden. |
| **Block** (Blocker-Start) | Beim Blocken (nicht beim Tackeln) +1 auf den Blockwurf, für Blocker *und* Geblockten. Hat nur einer von beiden diesen Skill, gewinnt er den Block auch bei Gleichstand automatisch, der andere stürzt. |
| **Dodge** (Fänger-Start) | Wird geblockt, wirft der Spieler AG statt BL. Gewinnt er, fällt der Angreifer *nicht* wie sonst üblich – außer der Angreifer würfelt dabei selbst eine natürliche 1. |
| **Zielwurf** | +1 auf den Wurfversuch beim Passen (`attemptPass`). |
| **Ruhiger Kopf** | Ignoriert gegnerische Tacklezonen beim Passen bzw. Fangen (kein Malus) – für Werfer und Fänger unabhängig voneinander. |
| **Rückendeckung** | Unterstützt einen Block auch aus einer zweiten gegnerischen Tacklezone heraus (normalerweise negiert das die Unterstützung komplett) – dann aber nur mit +1 statt der halben BL (`getBlockAssists`). |
| **Ballsicher** | +1 bei der Ballaufnahme vom Boden (`tryPickupBall`). |
| **Robust** | -1 Schaden (Floor bei 0) beim Verletzungscheck als Verlierer – repräsentiert erhöhte CO (`resolveInjuryCheck`). |
| **Gewandt** | +1 auf den Ausweichwurf (AG-Seite) beim Tackle, immer (`attemptLeavingTackleZones`). |
| **Zweite Luft** | Das erste Extrafeld einer Bewegung kostet keine Stamina (ein Sturz dabei kostet weiterhin die übliche zusätzliche SP). |
| **Trittsicher** | +1 auf den Erfolgswurf beim Extrafeld gehen (`attemptExtraSquare`). |
| **Hinterhältig** | -1 auf den Entdeckungs-Zielwert beim Foul (siehe Abschnitt 7c) – gleicht die dortige Anhebung des Basis-Zielwerts für spezialisierte Spieler wieder aus. |

Dazu ein rein ökonomischer Skill ohne Kernspiel-Effekt: **Sponsor** (siehe
Phase 2 in Abschnitt 2) kehrt das Gehalt des Spielers in eine gleich hohe
Sponsoreneinnahme um.

Eine geplante "zweite Skill-Welle" (Feldgeneral, Letzter Ausweg, Auf
Kommando) wurde verworfen – dafür gab es nie eine konkrete Definition,
stattdessen wurden die zwölf Skills oben umgesetzt.

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
   Schritt 1): AG des Foulenden gegen `ZIELWERT_FOUL = 5`, erschwert um
   `Math.floor(Schaden / 2)` (mit dem Skill **Hinterhältig**: -1 auf diesen
   Zielwert). Erfolg = Foul bleibt unentdeckt. Fehlschlag =
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
Schaden, aber auch ein deutlich geringeres Entdeckungsrisiko. Bei Zielwert 5
liegt das Grundrisiko (ohne Schadensfolge) bei ca. 40 % Entdeckung für einen
durchschnittlichen Wert, das durch angerichteten Schaden weiter steigt. Der
Zielwert wurde bewusst von 4 auf 5 angehoben (Nutzer-Begründung: Foul ist nur
1×/Zug möglich, anders als z.B. Tacklezonen-Situationen, die sehr oft
vorkommen) – der Skill **Hinterhältig** (siehe Abschnitt 4) gleicht das für
spezialisierte Spieler exakt wieder auf den alten Wert aus.

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

**Slice C (Nutzer-Feedback nach echten Liga-Partien) hat die KI von einer
reinen Distanz-Heuristik zu einer team-planbasierten, persönlichkeits-
gesteuerten Logik ausgebaut.** Die alte Version wählte den Ballaufnehmer rein
über Distanz – bei der symmetrischen Kickoff-Formation ein reines
Sortier-Artefakt (stabiler Sort ohne echten Tiebreak), das faktisch immer
Blocker #1 losschickte, egal ob er der geeignete Ballträger war. Grundlage
jetzt: `computeAiPlan(cageRoll)` in `hiveball.html`, einmal **pro
Spieleraktivierung** neu berechnet (nicht nur einmal pro Zug – der Ballstatus
kann sich mitten im Zug ändern, z. B. wenn der Ballaufnehmer den Ball noch
während desselben Zuges sichert, siehe Bugfix unten), gelesen von
`aiChooseDestination`.

**KI-Persönlichkeit** (`redPersonality`, gesetzt in `setupTeams()` aus
`opponents.js personality` bzw. `DEFAULT_AI_PERSONALITY` als Fallback ohne
Verein/Liga – 0.5 überall reproduziert exakt das alte Verhalten): fünf
Parameter 0..1, die dieselbe Plan-Logik team-spezifisch gewichten:

| Parameter | Wirkung |
|---|---|
| `ballHandlerPreference` | Wie stark Werfer/Fänger/Läufer statt "nächster Spieler" beim Aufnehmen eines losen Balls bevorzugt werden (`ROLE_BALL_BONUS`). |
| `passWillingness` | Wahrscheinlichkeit, dass der Ballträger den Ball per Hand-off-Pass an einen klar besser geeigneten Mitspieler weitergibt, statt selbst zu laufen (`findBestHandoffTarget`, nutzt das bereits vorhandene `attemptPass` – vorher nie von der KI aufgerufen). |
| `markingFocus` | Wie viele sonst freie Spieler unmarkierte, gefährliche Blau-Spieler aktiv zustellen (`computeMarkAssignments`, Fänger/Läufer priorisiert) statt pauschal vorzurücken; niedrig = "Klump"-Stil (mehr Jäger auf den Ballträger statt sauberer Markierung). |
| `riskTolerance` | Skaliert die früher festen Schwellen `dodgeAbortThreshold` (Dodge-Abbruch bei <50 %) und `foulRiskMargin` (Foul nur bei `expectedDamage > catchChance`) – 0.5 reproduziert exakt die alten Werte. |
| `cagePriority` | Wahrscheinlichkeit, dass die größte Bedrohung auf dem Fluchtweg des eigenen Ballträgers gezielt weggeblockt wird (`findBiggestCarrierThreat`). |

Team-Zuordnung passend zur Flavor aus `opponents.js` (siehe oben):
Stahl-Ameisen = "Klump" (Ball sekundär, hohe Risikobereitschaft, kaum
Markierung/Pass), Sturm-Wespen = Ballhandling-Fokus, Königinnengarde = beides
auf hohem Niveau, Grüne Zikaden = Referenz-Baseline (0.5 überall), Wiesen-
Grashüpfer etwas planloser. Vier der fünf Teams wurden zusätzlich per
Offline-Selbstspiel gegeneinander kalibriert (`scripts/tune-ai-personalities.mjs`
– Koordinaten-Aufstieg über ein vereinfachtes, separates Ballbesitz-Modell,
nicht die exakte Feldgeometrie; siehe Kommentar am Dateianfang). Sturm-Wespen
behielt bewusst die Handwerte, da die getunten Werte die Panel-Winrate
gesenkt hätten.

**Team-Plan pro Aktivierung** (`computeAiPlan`): weist konkrete Rollen zu,
mit klarer Reservierungs-Reihenfolge – eigener Ballträger → Ballaufnehmer
(rollen-gewichtet) → Wegblocker gegen die größte Bedrohung (`cageRoll` einmal
pro Zug gewürfelt, nicht bei jedem Refresh neu, sonst würde die
Käfig-Entscheidung mitten im Zug unmotiviert wechseln) → bis zu vier Eskorten
auf unterschiedlichen Punkten rund um den Ballträger (`escortOffsets`: direkt
voraus, schräg voraus beidseitig, Rückendeckung – **nicht** mehr alle auf
demselben einzigen Punkt, siehe Bugfix unten) → Jäger des gegnerischen
Ballträgers (1–2, mehr bei niedrigem `markingFocus`) → Rest als
Markierungspool. Jeder Spieler ohne konkrete Zuweisung fällt auf das
ursprüngliche Distanz-Verhalten zurück (rein additiv).

**Zwei konkrete Bugs gefunden und gefixt** (Nutzer-Feedback nach gespielten
Partien: "KI sichert den Ball nicht ab, Rest bleibt stehen" / "Deckung
miserabel, Team klumpt geschlossen, Ballträger leicht umblitzt"):
1. Der Plan wurde ursprünglich nur einmal zu Zugbeginn berechnet – für alle
   *später* im selben Zug aktivierten Spieler blieb er auf dem veralteten
   "Ball liegt frei"-Stand eingefroren, selbst nachdem der Ballaufnehmer (der
   zuerst aktiviert wird) den Ball bereits gesichert hatte. Fix: Neuberechnung
   bei jeder Spieleraktivierung.
2. Alle Eskorten-Spieler zielten auf denselben einzigen Punkt (3 Felder
   voraus, gleiche Reihe) statt sich zu verteilen. Fix: vier unterschiedliche
   Eskorten-Punkte, siehe oben.

- Nutzt weiterhin dieselbe Bewegungslogik wie der Mensch (`findSmartPath`),
  volle MR-Reichweite pro Zug; risikobewusste Bewegung (`aiAdvanceCarefully`)
  bricht vor riskanten Dodges lieber ab oder blockt stattdessen, Schwelle
  jetzt über `riskTolerance` skaliert (siehe oben).
- **Konservativer Einsatz von Extrafeldern** (`aiExtraSquareBudget`,
  unverändert seit Slice C, siehe Abschnitt 4 zu Extrafeldern): nur bei
  klarem Vorteil (aus Bedrohungsreichweite entkommen, Blockreichweite
  tatsächlich erreichen, losen Ball tatsächlich noch aufnehmen), nie nur um
  die Distanz zu verringern.
- **KI passt jetzt selbst** – als Hand-off (siehe `passWillingness` oben),
  nicht als eigenständige Wurf-Entscheidung während des Laufens.
- **Foul-Entscheidung** (`evaluateFoulOutcome`, siehe 7c): unverändert die
  Erwartungswert-Abwägung aus Schaden vs. Entdeckungsrisiko, jetzt zusätzlich
  über `riskTolerance`/`foulRiskMargin` team-abhängig verschoben.

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

- **Manager-Teil**: Phase 1 (Kader, Training, Aging, Matchday-Nominierung,
  Verletzungen, Hall of Fame) und Phase 2 (Ökonomie-Redesign, sieben
  Gebäude, manuelle Wechselauswahl, neun neue Skills) sind vollständig
  umgesetzt (siehe Abschnitt 2 sowie `docs/hiveball_manager_spezifikation.md`
  Abschnitt 10 für den detaillierten Phasenplan-Verlauf). Die
  Singleplayer-Liga (Slice A+B, fünf feste KI-Gegner + Spielplan/Tabelle,
  siehe Abschnitt 2) ist **kein** Ersatz für die in Abschnitt 11 der
  Spezifikation genannte "Multi-Liga mit echter Admin-Rolle" (echte
  Online-Ligen gegen andere Menschen) – das bleibt weiterhin Phase 3, ebenso
  wie vollständige Marktwert-Formel, Trainingsgebäude-Level 4-5, flexible
  Startformationen und ein Balancing-Ventil gegen den Schneeball-Effekt.
- **KI-Persönlichkeiten (Slice C)**: umgesetzt, siehe Abschnitt 12. Offener
  Folgepunkt: `scripts/tune-ai-personalities.mjs` liefert Vorschläge aus
  einem vereinfachten Selbstspiel-Modell, keine echte Simulation der realen
  Feldgeometrie – bei künftigen Team-/Werte-Änderungen sollte erneut
  gegengeprüft werden, ob die getunten Werte noch zur beabsichtigten
  Team-Identität passen.
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
- **Skills**: zwölf mit echter Wirkung implementiert (siehe Abschnitt 4).
  Werfer hat weiterhin keinen eigenen **Start**-Skill (nur die drei anderen
  Positionen haben einen von Anfang an) – kann aber wie jede Position
  zusätzliche Skills über die Akademie erlernen.
- KI wirft nur als Hand-off an einen besser geeigneten Mitspieler (siehe
  Abschnitt 12), nicht als eigenständige taktische Wurf-Entscheidung während
  des Laufens (z. B. um eine Blockreichweite zu umgehen).
- `sentOff` (siehe 7c) ist rein informativ und wird aktuell nirgends
  ausgewertet – vorgesehen für eine spätere Statistik/den Manager-Teil, um
  Platzverweise von echten Verletzungen unterscheiden zu können.

## Projektstruktur

```
hiveball/
├── README.md                                   ← dieses Dokument
├── package.json                                ← nur für "npm run dev" (kein echtes npm-Projekt, keine Deps)
├── scripts/
│   ├── dev-server.mjs                          ← statischer Dev-Server (ohne ihn blockieren Browser die ES-Module über file://)
│   └── tune-ai-personalities.mjs               ← Offline-Selbstspiel-Tuning der KI-Persönlichkeiten (Slice C, siehe Abschnitt 12)
├── src/
│   ├── hiveball.html                           ← Kernspiel-Prototyp (HTML/CSS/JS, keine Deps)
│   └── manager/                                ← Manager-Teil (Phase 1+2 abgeschlossen, siehe Spezifikation)
│       ├── overview.html                       ← Übersicht (Kasse, Teamwert, Kadergröße, Gebäude-Level, "Team löschen") – Startseite
│       ├── league.html                         ← Liga: Tabelle/Spielplan-Reiter, Spieltag-Navigation, Saison-Abschluss
│       ├── finances.html                       ← Finanzen: letzter Spieltag (tatsächlich) + nächster Spieltag (Vorschau)
│       ├── next-match.html                     ← Matchday-Nominierung + Spielstart aus dem Manager heraus
│       ├── index.html                          ← minimale Kader-UI (Verein anlegen, Spieler/Skills kaufen)
│       ├── training.html                       ← Trainingscenter-UI (physisches Training, Slot-Auswahl, Ausbau)
│       ├── academy.html                        ← Akademie-UI (Theorie-Training/Skills, Slot-Auswahl, Ausbau)
│       ├── stadium.html                        ← Stadion + Fanshop + Catering (Level, Ausbau, Unterhalt)
│       ├── medical.html                        ← Medizinische Abteilung (Behandlungsplätze, Ausbau)
│       ├── public-relations.html                ← Öffentlichkeitsarbeit (PR-Bonus auf Reputation, Ausbau)
│       ├── hall-of-fame.html                   ← ausgeschiedene Spieler mit Statistik/Ausscheidegrund
│       ├── settings.html                       ← Settings-UI für leagueConfig (generischer Editor)
│       ├── layout.js                           ← gemeinsame Kopfzeile (Logo-Slot + Navigation) aller Seiten
│       ├── facilityUpgradeUI.js                ← gemeinsame Ausbau-Zeile (Icon/Level/Unterhalt/Button) für alle Gebäudeseiten
│       ├── manager.css                         ← gemeinsames Stylesheet (Anthrazit-Theme)
│       ├── leagueConfig.js                     ← Default-Konfiguration der Liga
│       ├── opponents.js                        ← 5 datengetriebene KI-Gegnervereine + Persönlichkeit (Slice A+C)
│       ├── league.js                           ← Singleplayer-Liga: Spielplan, Tabelle, Stärke-Rating, Saison (Slice B)
│       ├── positions.js                        ← Positions-/Preistabelle inkl. Lineman
│       ├── state.js                            ← Datenmodell (ManagerPlayer, Club) + Persistenz + deleteClub()
│       ├── formulas.js                         ← Formeln: Marktwert, Skill-Preis/-Limit, Reps-Schwelle/Maximalwert, Alter/Verfallschance
│       ├── transferMarket.js                   ← einfacher Transfermarkt (Spieler kaufen)
│       ├── economy.js                          ← Vereinskasse: Gehälter, Zuschauer/Sponsor/Fanshop/Catering-Einnahmen, Reputation (Elo), Gebäude-Ausbau/-Unterhalt, Vorschau-Berechnung
│       ├── skills.js                           ← EP-für-Skills (Skill-Kauf gegen XP)
│       ├── training.js                         ← Reps-Sammlung + physisches Training (Warteschlange verbrauchen)
│       ├── aging.js                            ← Aging-System (Formel 3.5) + Zwangsrente (Formel 3.8)
│       ├── nomination.js                       ← Matchday-Status je Spieler (Feld/Bank/Frei), direkt im Kader
│       ├── injury.js                           ← Verletzungsschwere (Formel 3.6) + Ausfallzähler-Heilung
│       ├── medical.js                          ← Behandlungsplätze (Formel 3.7, Slot-Verwaltung)
│       └── postMatch.js                        ← Post-Match-Verarbeitung (EP, Reps-Gutschrift, MVP, volle Kassen-Abrechnung; Abschnitt 4)
└── docs/
    ├── Hiveball_Manager_Regelwerk_v0_12.pdf     ← ursprüngliches Design-/Regeldokument
    └── hiveball_manager_spezifikation.md        ← technische Spezifikation Manager-Teil
```

## Hinweis zur Weiterentwicklung

Die Ein-Datei-Architektur (`src/hiveball.html`) war eine bewusste
Design-Entscheidung für den Kernspiel-Prototyp (keine Build-Schritte, überall
lauffähig) und ist mit der Manager-Integration (Phase 1g) an genau der
vorgesehenen Stelle aufgeweicht worden: die Datei ist jetzt ein ES-Modul und
importiert `src/manager/state.js`, um Blaus Aufstellung aus einem echten
Verein zu laden. Weiterhin **kein echter Build-Schritt** (der `dev-server.mjs`
aus Abschnitt 2 ist nur ein statischer Dateiserver, keine Kompilierung), aber
kein reines Einzeldatei-Prototyp mehr – und wegen der ES-Module jetzt zwingend
über `http://localhost:8420/...` zu öffnen, **nicht** per Doppelklick/`file://`
(siehe Abschnitt 2, blockieren normale Browser aus Sicherheitsgründen). Ohne
Verein bleibt das Kernspiel über den TEAM_ROSTER-Fallback weiterhin
eigenständig spielbar.

## Lizenz

Siehe [`LICENSE`](LICENSE) – alle Rechte vorbehalten, keine Weiterverwendung
ohne Zustimmung des Urhebers.
