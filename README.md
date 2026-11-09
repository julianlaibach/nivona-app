# Nivona BLE Demo

Web-App, die sich per **Web Bluetooth** direkt aus dem Browser mit einem Nivona-Kaffeevollautomaten verbindet und dessen Funktionen auslöst. Es gibt kein Backend und keine Abhängigkeiten.

Das Protokoll stammt aus [mpapierski/esp-coffee-bridge – docs/NIVONA.md](https://github.com/mpapierski/esp-coffee-bridge/blob/main/docs/NIVONA.md). Es wurde aus den offiziellen Android-Apps (`de.nivona.mobileapp` 3.8.6 und NIVONA Connect 1.2.0) rekonstruiert und an einer NICR 756 live validiert.

## Starten

```bash
docker compose -f docker-compose.dev.yml up -d     # → http://localhost:8765
# oder ohne Docker:
node server.mjs                                    # PORT=8765 node server.mjs
```

Die Seite muss in **Chrome oder Edge** über `http://localhost` oder HTTPS laufen, sonst stellt der Browser die Web-Bluetooth-API nicht bereit. Über den nginx-proxy (`*.test`, http) funktioniert es deshalb nicht.

Tests (ohne Bluetooth, prüfen die Protokoll-Vektoren aus der Doku):

```bash
docker exec -w /app nivona-dev node --test tests/
```

## App-Simulation (`/app/`)

Unter **http://localhost:8765/app/** läuft eine App-Simulation im NIVONA-CI (Farben und Schriften aus nivona.com, Rendering der NIVO 9'000). Auf dem Desktop erscheint sie im Telefonrahmen mit zwei Seitenspalten: links die Demo-Steuerung, rechts eine Live-Vorschau der Widgets. Auf dem Handy läuft sie im Vollbild.

- **Intro**: Willkommen, Maschine mit antippbaren Hotspots, App-Funktionen und Ersteinrichtung als Checkliste
- **Verbinden**: echte Maschine per Web Bluetooth oder **Demo** mit einer virtuellen NIVO 9'103 (`app/js/sim.js`), dazu Hilfe zur Fehlersuche
- **Start**: Status, Favoriten, Bohnenstand, Pflege auf einen Blick
- **Getränke**: alle Rezepte inkl. Chilled und MyCoffee; im Sheet lassen sich Stärke, Profil, Temperatur und ml ändern (unverändert wird das gespeicherte Rezept gebrüht)
- **Live-Zubereitung**: Fortschrittsring, sich füllende Tasse, Phasen, Abbrechen, Dynamic Island und Fertig-Benachrichtigung
- **Pflege**: Wartungsstand und Getränkestatistik
- **Erinnerungen**: Bohnen-Tracker (schätzt den Füllstand über den Bezugszähler, Register 213), automatische Erinnerungen fürs Nachfüllen, Nachkaufen und die Pflege sowie eigene Termin-Erinnerungen
- **Mehr**: Maschineneinstellungen, Hell/Dunkel, Intro erneut zeigen, Expertenansicht

App-Zustand (Favoriten, Bohnen, Erinnerungen) liegt im `localStorage`. Die Protokoll-Module in `js/` nutzen Demo-Konsole und App gemeinsam.

## Verbindungsablauf

1. `navigator.bluetooth.requestDevice` filtert auf Service `AD00` und auf die bekannten Namenspräfixe (z. B. `756…`, `8107…`). Wird die Maschine nicht angezeigt, die Option „alle Geräte“ aktivieren.
2. Die App baut die GATT-Verbindung auf, liest die Device Information (`180A`) und bindet `AD01`/`AD02`/`AD03`/`AD06`.
3. Sie aktiviert die Notifications auf `AD02`. Das braucht eine verschlüsselte Verbindung, deshalb fragt das Betriebssystem hier nach dem **Pairing**.
4. **HU-Handshake**: 4 zufällige Bytes plus Verifier gehen RC4-verschlüsselt raus, zurück kommt ein 2-Byte-Sessionschlüssel.
5. Alle weiteren Requests werden mit RC4 verschlüsselt und bekommen den Sessionschlüssel vorangestellt. Die Antworten sind verschlüsselt, enthalten den Schlüssel aber nicht.

Frame: `0x53 ‖ CMD(2) ‖ RC4(body ‖ crc) ‖ 0x45`, mit `crc = ~Σ(cmd + body) & 0xFF`.

## Funktionen

| Bereich | Kommandos |
| --- | --- |
| Prozessstatus (Polling), Bestätigen, Abbrechen | `HX`, `HY`, `HZ` |
| Getränke zubereiten, optional mit Stärke, Profil, Temperatur und ml | `HR 10000+sel*100+n` lesen → `HW 9001+n` → `HW 9001=sel` → `HE` |
| Einstellungen lesen und schreiben (je Modellfamilie) | `HR` / `HW` |
| Statistik und Wartungsstand (Entkalken, Brühgruppe, Filter …) | `HR 200…`, `600…` |
| MyCoffee-Slots | `HR`/`HA 20000+` |
| Experten: Prozessstart, Register roh, Roh-Frames, Ping, Features, Werksreset | `HE`, `HR/HW/HA/HD`, `Hp`, `HI` |
| Protokoll-Selbsttest im Browser | – |

## Einschränkungen

- Live validiert sind Familie 700 (NICR 756, Lesebefehle) und die NIVO 9000 (9101/9103). Die NIVO-9000-Tabellen und der Brühablauf stammen aus [melitta-barista-ha v0.96.0b11](https://github.com/dzerik/melitta-barista-ha/issues/56) (`js/family9101.js`), dort wurden sie von 9101-Besitzern getestet. Die Familien 600/79x/900/1030/1040/8000 sind im Bridge-Projekt hinterlegt. `7101` und `8141` sind nur aus der App rekonstruiert.
- Ablauf auf der NIVO 9000: Erst `HE [00 62 …]` (JOB_RETURN_HOME, 98) senden und auf ACK warten. Danach `HW 9000 = Auswahl` und das vollständige Rezept in `9001…9013` schreiben. Zum Schluss `HE [00 04 00 00 00 01]` senden. Ohne Anpassung genügt `HE [00 04 00 sel 00 00]`, MyCoffee-Plätze starten mit `HE [00 04 00 13+n 00 00]`.
- Prozess-IDs für Spülen, Reinigen und Entkalken sind in der Doku nicht belegt. Bekannt ist nur `JOB_RETURN_HOME = 98` auf NIVO 9000. Der Experten-Bereich erlaubt es deshalb, beliebige `HE`-Prozesse zu starten. Das bitte nur mit Bedacht nutzen.
- Inoffizielles Projekt ohne Verbindung zu Nivona oder Eugster.
