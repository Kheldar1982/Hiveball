# Hiveball – Projekt-Hinweise für Claude

## Vor Beginn jeder Session: Branch-Stand prüfen

Dieses Projekt wird oft in mehreren parallelen Worktrees/Branches gleichzeitig
weiterentwickelt. Bevor du mit neuer Arbeit beginnst:

1. `git branch -a -v` und `git log --all --oneline -15` ausführen.
2. Prüfen, ob der aktuelle Branch hinter anderen lokalen Branches zurückliegt
   (insbesondere hinter `master`).
3. Falls ja: dem Nutzer den Rückstand melden und klären, ob der aktuelle
   Branch per `git rebase` auf den fortgeschritteneren Stand gehoben werden
   soll, bevor neue Features gebaut werden. Nicht stillschweigend auf einem
   veralteten Stand weiterarbeiten.

## Nach Abschluss einer Session: in master mergen

Abgeschlossene Feature-Branches zeitnah per `git merge --ff-only` in `master`
mergen, damit `master` immer der aktuelle Stand ist und neue Worktrees/Branches
nicht versehentlich von veraltetem Code abzweigen.
