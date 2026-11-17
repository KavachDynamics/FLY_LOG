# FLY_LOG

A browser-based 3D replay viewer for ArduPilot DataFlash `.BIN` logs. See what your drone or multirotor actually did, not just graphs.

**Everything runs locally in your browser. Logs are never uploaded.**

## Try it
Live demo: `https://<your-username>.github.io/FLY_LOG/` (enable GitHub Pages, see below)

## Features
- Open or drag-and-drop a `.BIN` log
- 3D flight path with a quadcopter that follows the logged roll, pitch and yaw
- Props spin and change colour from motor outputs (`RCOU`)
- Timeline strip with roll/pitch, altitude, motor output and flight-mode changes; click to seek
- Play/pause, 0.25x to 8x speed, follow camera
- HUD: mode, altitude, ground speed, attitude, battery, motor bars
- Built-in demo flight, plus a list of every message type found in the log

## Messages used
`ATT`, `POS` (falls back to `GPS`), `RCOU`, `MODE`, `BAT`, `BARO`. The parser reads the log's own `FMT` messages, so it adapts to different ArduPilot versions.

## Run locally
Open `index.html` in a browser, or serve the folder:

    python3 -m http.server 8000

then visit http://localhost:8000. Three.js is bundled in `lib/`, so it works offline (fonts fall back to system fonts).

## Deploy on GitHub Pages
Settings > Pages > Source: `main` branch, `/ (root)`.

## Project layout
    index.html    page structure
    style.css     styles
    parser.js     DataFlash .BIN parser
    app.js        timeline building, 3D scene, HUD, controls
    lib/          Three.js r128 + OrbitControls (MIT)
    samples/      put example logs here

## Roadmap
- [ ] Parser in a Web Worker with progress bar
- [ ] Graph panel: plot any message/field synced to the 3D cursor
- [ ] Hex/octo/plane/rover models
- [ ] Error/event markers (`ERR`, `EV`, `MSG`)
- [ ] Map underlay, flight comparison, screenshot/video export

## Notes
Not affiliated with the ArduPilot project. Inspired by [plot.ardupilot.org](https://plot.ardupilot.org/).

## License
MIT. See `LICENSE`.
