# Fluffspheres ✨

Ein rundenbasiertes Artillerie-Spiel mit flauschigen Kugelwesen, explosiven Karten und magischen Schmetterlingen. Es läuft komplett offline als **eine einzige HTML-Datei** (Three.js/WebGL, eigene Shader, Web Audio) und als **Android-APK**.

## Download

Die fertige APK findest du unter **Releases** (`Fluffspheres-v1.0.apk`). Auf dem Handy die Installation aus unbekannten Quellen erlauben, dann installieren. Läuft ab Android 8.0, im Querformat.

## Features

- **Fluffspheres**: echtes Shell-Fell (bis zu 34 Schichten) mit Locken, Wind- und Bewegungsträgheit, glänzende Kulleraugen mit Iris-Details, doppelten Glanzlichtern, Blinzeln und Blickverfolgung, Bauch-Abzeichen im Fell.
- **Traumwelt**: Pastell-Himmel mit Sternen, Regenbogen, Wolken, schwebende Lolli-Inseln, Zuckerwatte-Meer, Glitzerpartikel.
- **Zerstörbares 2.5D-Terrain** aus Torten-Schichten mit Zuckerguss, Streuseln und karamellisierten Kratern.
- **6 Waffen**: Herzchen-Bazooka, Plüsch-Splitterbombe, Regenbogen-Orbitalstrahl, Zuckerwatte-Greifhaken, Kuschel-Schubser, Bonbon-Mine. Wind und eine glitzernde Flugbahnvorschau inklusive.
- **Kartendeck im Exploding-Kittens-Stil**: Exploding Fluff, Kraulen (Entschärfen), Nope! (auch Nope-Ketten), Zug überspringen, Angriff verdoppeln, Zukunft sehen, Karte klauen, Mischen, Schmetterlings-Lockstoff, Zielhilfe, Kuschelschild.
- **Schmetterlingseffekt**: 9 Ereignisse wie Gravitations-Umkehr, Sternschnuppen-Schauer, Platztausch, Plüsch-Druckwelle oder Zuckerguss-Insel, mit Kettenreaktionen.
- **Modi**: gegen KI-Bots (3 Stärken, die KI berechnet echte Flugbahnen), lokales Pass & Play mit verdeckter Kartenhand, Chaos-Modus mit doppelt so vielen Schmetterlingen.
- **Material 3 Expressive UI**: Shape-Morphing-Buttons, verbundene Button-Gruppen, Cookie/Flower-Shapes, wellenförmige Fortschrittsanzeigen, schwebende Toolbars, FAB-Menü, Federanimationen, Roboto Flex.
- Charakter-Editor, Lexikon, Optionen, prozeduraler Sound-Synth und Musik, Kamera mit Action-Zoom.

## Steuerung

| Aktion | Touch | Tastatur/Maus |
|---|---|---|
| Zielen | Vom Fluffsphere wegziehen | Linke Maustaste ziehen, Q/E, R/F |
| Feuern | Rosa FEUER-Button | Leertaste / Enter |
| Laufen / Springen | Pfeil-Buttons unten links | A/D oder ←/→, W/↑, S/↓ = Salto rückwärts |
| Waffe wählen | Waffenleiste links | 1–6 |
| Kamera | Zwei Finger ziehen/zoomen | Rechte Maustaste, Mausrad |

## Selbst bauen

```bash
cd tools && npm install && node build.js     # erzeugt dist/index.html (+ kopiert in android/app/src/main/assets)
cd ../android && ./gradlew assembleRelease   # erzeugt app/build/outputs/apk/release/app-release.apk
```

Der Code liegt modular in `src/js/` (01-core … 16-main) und wird von `tools/build.js` zu einer Datei gebündelt. Eine GitHub-Actions-Vorlage zum automatischen APK-Bau liegt unter `tools/ci/android.yml` (nach `.github/workflows/` verschieben, um sie zu aktivieren).
