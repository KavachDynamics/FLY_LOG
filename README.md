# FLY_LOG: 3D ArduPilot Log Viewer

**Free online ArduPilot DataFlash `.BIN` log viewer with 3D flight replay for drones and multirotors.**

Live app: https://kavachdynamics.github.io/FLY_LOG/

FLY_LOG helps developers and hobbyists review post-flight data. Instead of only graphs, you see what the drone actually did, in 3D. Everything runs in your browser and logs are never uploaded.

## Features
- Open or drag and drop an ArduPilot `.BIN` log (ArduCopter and other DataFlash logs)
- 3D flight replay with a detailed multirotor model, correct heading arrow and spinning propellers
- Flight summary: duration, armed time, max altitude, speed, distance, battery, GPS satellites, partial-flight detection
- Mini map, attitude horizon, compass, battery, GPS, motor outputs
- Flight message feed (MSG, ERR, EV, mode changes), click a message to jump to that moment
- Widget checklist to show or hide panels
- Export to CSV, JSON, and printable PDF report

## Use it for
Drone flight log analysis, multirotor crash investigation, post-flight review, tuning checks, and sharing flights with clients or teammates.

## Run locally
Open `index.html` in a browser. It is a single file and loads Three.js from a CDN.

## Notes
Not affiliated with the ArduPilot project. Built by Kavach Dynamics. MIT licensed.
