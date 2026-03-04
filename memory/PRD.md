# Dome City Temperature Control System - PRD

## Original Problem Statement
Build an Arduino-based temperature control system with:
- Emergency Mode (RED button D4): Fixed target 23°C
- Comfort Mode (WHITE button D3): User-selectable target 18-30°C
- DHT22 sensor, Fan relay, Heater transistor, 4 LEDs
- Live web dashboard with real-time data from Arduino via USB Serial (COM4)
- No fake data - all data from actual Arduino connection

## User Personas
1. **Control Room Operator** - Monitors dome temperature, triggers emergency/comfort modes
2. **Maintenance Engineer** - Checks system status, reviews temperature history
3. **System Administrator** - Configures serial port, reviews logs

## Core Requirements (Static)
- [x] Arduino code with Emergency/Comfort mode logic
- [x] DHT22 temperature/humidity sensing
- [x] LED status indicators (Red, Yellow, Green, Blue)
- [x] Fan and Heater control logic
- [x] Serial communication (JSON format)
- [x] Web dashboard with real-time updates
- [x] Temperature history chart
- [x] Mode control buttons
- [x] System event logging

## What's Been Implemented (2026-02-28)

### Arduino Code (`/app/arduino/dome_city_controller.ino`)
- Complete flowchart logic for Emergency/Comfort modes
- 500ms blink rate for LED indicators
- Range-validated temperature input (18-30°C)
- JSON serial output format
- Boot sequence with LED test
- Sensor error handling (all LEDs blink)
- Button debouncing

### Backend (`/app/backend/server.py`)
- FastAPI with WebSocket support
- Serial communication with Arduino (pyserial)
- REST API endpoints for status, history, commands
- MongoDB storage for readings and events
- Polling support when WebSocket unavailable

### Frontend (`/app/frontend/src/App.js`)
- Dark industrial theme (Tactical Minimalism)
- Real-time temperature display
- LED status visualization with animations
- Fan/Heater status indicators
- Mode control buttons (Emergency, Comfort, Stop)
- Temperature history chart (Recharts)
- System event log
- Polling fallback for reliable connectivity

## Prioritized Backlog

### P0 (Critical) - DONE
- [x] Arduino code with full flowchart logic
- [x] Backend serial communication
- [x] Frontend dashboard with real-time updates

### P1 (High Priority)
- [ ] Temperature alerts/notifications when thresholds exceeded
- [ ] Historical data export (CSV)
- [ ] Multi-dome support (multiple Arduino connections)

### P2 (Medium Priority)
- [ ] User authentication for dashboard access
- [ ] Mobile-responsive improvements
- [ ] Temperature scheduling (time-based targets)

### P3 (Low Priority)
- [ ] Email/SMS alerts integration
- [ ] Predictive maintenance warnings
- [ ] Dashboard customization (themes, layouts)

## Next Tasks
1. Connect physical Arduino and test end-to-end
2. Add temperature threshold alerts
3. Implement data export functionality

## Architecture
```
[Arduino UNO] --Serial/USB--> [Python Backend] --REST/WS--> [React Dashboard]
                                    |
                                    v
                               [MongoDB]
```

## Files Structure
- `/app/arduino/dome_city_controller.ino` - Arduino sketch
- `/app/backend/server.py` - FastAPI backend
- `/app/frontend/src/App.js` - React dashboard
- `/app/README.md` - Documentation
