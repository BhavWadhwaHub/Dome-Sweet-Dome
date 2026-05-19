# Dome Sweet Dome

Dome Sweet Dome is an Arduino-based temperature control and monitoring project with a FastAPI backend and a React dashboard. The system reads temperature and humidity from a DHT22 sensor, controls a fan and heater through Arduino output pins, and exposes live data to a web dashboard using REST API endpoints and a WebSocket connection.

The project is designed around a small climate-control setup where users can monitor the current environment, switch between operating modes, set a comfort target temperature, and manually toggle the fan or heater from the dashboard.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Main Features](#main-features)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Hardware Components](#hardware-components)
- [Arduino Pin Configuration](#arduino-pin-configuration)
- [Arduino Operating Modes](#arduino-operating-modes)
- [Serial Communication Protocol](#serial-communication-protocol)
- [Backend Overview](#backend-overview)
- [Backend Environment Variables](#backend-environment-variables)
- [Backend API Reference](#backend-api-reference)
- [WebSocket API](#websocket-api)
- [Frontend Overview](#frontend-overview)
- [Installation and Setup](#installation-and-setup)
- [Typical Usage Flow](#typical-usage-flow)
- [Testing and Reports](#testing-and-reports)
- [Troubleshooting](#troubleshooting)
- [Important Notes](#important-notes)

---

## Project Overview

Dome Sweet Dome is a full-stack hardware and software project for temperature control. It combines:

1. **Arduino firmware** that reads a DHT22 temperature/humidity sensor and controls fan/heater outputs.
2. **A Python FastAPI backend** that communicates with the Arduino over a serial connection.
3. **MongoDB storage** for sensor readings and Arduino event logs.
4. **A React frontend dashboard** that displays live system state and allows users to send commands.

The Arduino is responsible for the actual control logic. The backend acts as the bridge between the Arduino and the web app. The frontend provides a user-friendly dashboard for monitoring and control.

---

## Main Features

- Reads temperature and humidity using a DHT22 sensor.
- Controls a fan output and heater output from the Arduino.
- Supports emergency, comfort, idle, and manual modes.
- Uses a fixed emergency target temperature of `23°C`.
- Allows comfort target temperatures between `18°C` and `30°C`.
- Uses a `0.3°C` deadband to avoid rapid switching around the target temperature.
- Sends JSON-formatted data from Arduino to the backend over serial.
- Stores temperature readings in MongoDB.
- Stores Arduino event messages in MongoDB.
- Provides REST endpoints for status, history, events, serial ports, and commands.
- Provides a WebSocket endpoint for real-time dashboard updates.
- Includes a React dashboard with live temperature, humidity, target temperature, mode, fan state, heater state, LED state, charts, and logs.
- Includes manual dashboard controls for toggling fan and heater.
- Includes Windows batch scripts inside `local_package` for local setup/start workflows.

---

## System Architecture

```text
DHT22 Sensor + Buttons
        |
        v
Arduino UNO
        |
        | Serial JSON over USB
        v
FastAPI Backend
        |
        | REST API + WebSocket
        v
React Dashboard
        |
        v
User Monitoring and Control
```

The Arduino must remain connected to the computer running the backend because the backend communicates with it through a serial port.

---

## Technology Stack

### Embedded / Hardware

- Arduino UNO
- Arduino C/C++ sketch
- DHT22 temperature and humidity sensor
- Fan output
- Heater output
- Physical push buttons
- Status LEDs

### Backend

- Python
- FastAPI
- Uvicorn
- PySerial
- Motor async MongoDB driver
- MongoDB
- Pydantic
- python-dotenv
- WebSocket support

### Frontend

- React
- CRACO
- Tailwind CSS
- Recharts
- Lucide React icons
- Sonner toast notifications
- JavaScript

---

## Project Structure

```text
Dome-Sweet-Dome-main/
├── arduino/
│   └── dome_city_controller.ino
│
├── backend/
│   ├── server.py
│   └── requirements.txt
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── App.js
│   │   ├── App.css
│   │   ├── index.js
│   │   ├── index.css
│   │   ├── components/
│   │   ├── hooks/
│   │   └── lib/
│   ├── package.json
│   ├── craco.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── jsconfig.json
│   └── components.json
│
├── local_package/
│   ├── setup.bat
│   ├── start.bat
│   ├── README.md
│   ├── arduino/
│   └── backend/
│
├── memory/
│   └── PRD.md
│
├── test_reports/
│   ├── iteration_1.json
│   └── iteration_2.json
│
├── tests/
│   └── __init__.py
│
├── backend_test.py
├── DEPLOYMENT.md
├── design_guidelines.json
├── test_result.md
└── README.md
```

---

## Hardware Components

The project is written for an Arduino UNO-based setup. The Arduino sketch uses:

- DHT22 sensor for temperature and humidity readings
- Fan output pin
- Heater output pin
- Red, yellow, green, and blue LEDs
- Red and white physical buttons

The code uses `INPUT_PULLUP` for the buttons, so each button is expected to connect its input pin to ground when pressed.

---

## Arduino Pin Configuration

The current Arduino sketch in `arduino/dome_city_controller.ino` defines the following pin mapping:

| Component | Arduino Pin | Purpose |
|---|---:|---|
| DHT22 data pin | D2 | Reads temperature and humidity |
| Red button | D4 | Manual heater toggle in manual mode |
| White button | D5 | Manual fan toggle in manual mode |
| Fan output | D6 | Controls fan/cooling output |
| Heater output | D7 | Controls heater output |
| Red LED | D8 | Emergency/idle status indication |
| Yellow LED | D9 | Heater status indication |
| Green LED | D10 | Stable/waiting status indication |
| Blue LED | D11 | Fan status indication |

Use the Arduino sketch as the source of truth for wiring because it is the code that actually runs on the board.

---

## Arduino Operating Modes

The Arduino firmware defines four operating modes:

```cpp
IDLE
EMERGENCY
COMFORT
MANUAL
```

The system starts in `MANUAL` mode so that the physical buttons can work immediately after boot.

---

### 1. Manual Mode

Manual mode allows the fan and heater to be toggled manually.

In manual mode:

- The red button toggles the heater.
- The white button toggles the fan.
- If the heater turns on, the fan is turned off.
- If the fan turns on, the heater is turned off.
- Yellow LED blinks when the heater is active.
- Blue LED blinks when the fan is active.
- On first boot, all LEDs are turned on until the user interacts with the system.

Manual mode can also be entered through serial commands such as `MANUAL`, `TOGGLE_FAN`, and `TOGGLE_HEATER`.

---

### 2. Emergency Mode

Emergency mode uses a fixed target temperature of `23°C`.

In emergency mode:

- The red LED blinks.
- If the temperature is below `target - deadband`, the heater turns on.
- If the temperature is above `target + deadband`, the fan turns on.
- If the temperature is within the deadband range, both fan and heater turn off.
- The green LED blinks when the temperature is stable.

The Arduino code sets:

```cpp
targetTemp = 23.0;
deadband = 0.3;
```

This means emergency mode tries to keep the system around `23°C`, with a small tolerance range to reduce rapid switching.

---

### 3. Comfort Mode

Comfort mode allows the user to set a target temperature.

In comfort mode:

- The system waits for a valid target temperature.
- Valid target values are from `18°C` to `30°C`.
- While waiting for input, the green LED blinks.
- After a target is set, the system automatically controls the fan and heater.
- If temperature is below the target range, the heater turns on.
- If temperature is above the target range, the fan turns on.
- If temperature is within the target range, fan and heater turn off and the green LED blinks.

---

### 4. Idle Mode

Idle mode stops active temperature control.

In idle mode:

- Fan output is turned off.
- Heater output is turned off.
- Fan and heater state variables are set to false.
- If the system was stopped, the red LED stays on solid.

Idle mode can be triggered using the `STOP` or `IDLE` command.

---

## Serial Communication Protocol

The Arduino communicates with the backend through serial messages at `9600` baud by default.

The Arduino sends two main types of JSON messages:

1. **Event messages** that contain an `event` field.
2. **Regular sensor/status messages** that contain temperature, humidity, target, mode, actuator state, and LED state.

---

### Example Arduino Status Message

```json
{
  "temp": 24.5,
  "humidity": 41.2,
  "target": 23.0,
  "mode": "EMERGENCY",
  "fan": true,
  "heater": false,
  "stable": false,
  "leds": {
    "red": 2,
    "yellow": 0,
    "green": 0,
    "blue": 2
  },
  "error": false,
  "waiting": false
}
```

---

### LED State Values

| Value | Meaning |
|---:|---|
| `0` | Off |
| `1` | On / solid |
| `2` | Blinking |

---

### Supported Serial Commands

The Arduino sketch supports the following commands:

| Command | Description |
|---|---|
| `EMERGENCY` | Switches to emergency mode and sets target to `23°C` |
| `COMFORT` | Switches to comfort mode and waits for target temperature input |
| `STOP` | Stops active control and enters idle mode |
| `IDLE` | Stops active control and enters idle mode |
| `MANUAL` | Switches to manual mode |
| `TOGGLE_FAN` | Toggles the fan in manual mode |
| `FAN_TOGGLE` | Toggles the fan in manual mode |
| `TOGGLE_HEATER` | Toggles the heater in manual mode |
| `HEATER_TOGGLE` | Toggles the heater in manual mode |
| `FAN_ON` | Turns the fan on and turns the heater off |
| `FAN_OFF` | Turns the fan off |
| `HEATER_ON` | Turns the heater on and turns the fan off |
| `HEATER_OFF` | Turns the heater off |
| `T=18` to `T=30` | Sets target temperature using `T=` format |
| `18` to `30` | Sets target temperature while comfort mode is waiting for input |

---

## Backend Overview

The backend is implemented in:

```text
backend/server.py
```

It performs the following tasks:

- Loads environment variables from `backend/.env`.
- Connects to MongoDB using `MONGO_URL` and `DB_NAME`.
- Opens a serial connection to the configured Arduino port.
- Reads JSON lines from the Arduino.
- Stores event messages in the `arduino_events` collection.
- Stores sensor readings in the `temperature_readings` collection.
- Maintains an in-memory `temperature_history` list with a maximum of 100 entries.
- Broadcasts Arduino data to connected WebSocket clients.
- Exposes REST API routes under the `/api` prefix.

The backend repeatedly attempts to connect to the configured serial port. If the Arduino is not available, it waits and retries.

---

## Backend Environment Variables

Create a `.env` file in the `backend` folder.

Example:

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=dome_city
SERIAL_PORT=COM4
SERIAL_BAUD=9600
CORS_ORIGINS=http://localhost:3000
```

### Required Variables

| Variable | Description |
|---|---|
| `MONGO_URL` | MongoDB connection string |
| `DB_NAME` | MongoDB database name |

### Optional Variables

| Variable | Default | Description |
|---|---|---|
| `SERIAL_PORT` | `COM4` | Serial port used to connect to the Arduino |
| `SERIAL_BAUD` | `9600` | Serial baud rate |
| `CORS_ORIGINS` | `*` | Allowed CORS origins, comma-separated |

---

## Backend API Reference

All backend routes are prefixed with `/api`.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/` | Returns backend API message and version |
| `GET` | `/api/status` | Returns the current Arduino status object |
| `GET` | `/api/history` | Returns recent in-memory temperature history |
| `GET` | `/api/events` | Returns recent Arduino events from MongoDB |
| `GET` | `/api/ports` | Lists available serial ports and current configured port |
| `POST` | `/api/command` | Sends a raw command to the Arduino |
| `POST` | `/api/mode/emergency` | Sends the `EMERGENCY` command |
| `POST` | `/api/mode/comfort` | Sends the `COMFORT` command |
| `POST` | `/api/mode/idle` | Sends the `IDLE` command |
| `POST` | `/api/target` | Sends a target temperature value to the Arduino |

---

### `GET /api/status`

Returns the latest known Arduino state.

Example response shape:

```json
{
  "temp": 24.5,
  "humidity": 41.2,
  "target": 23.0,
  "mode": "EMERGENCY",
  "fan": true,
  "heater": false,
  "leds": {
    "red": 2,
    "yellow": 0,
    "green": 0,
    "blue": 2
  },
  "error": false,
  "waiting": false,
  "connected": true,
  "last_update": "2026-05-19T00:00:00+00:00"
}
```

---

### `GET /api/history`

Returns recent in-memory readings.

Optional query parameter:

| Parameter | Description |
|---|---|
| `limit` | Number of recent history entries to return. Default in code is `50`. |

Example response shape:

```json
{
  "history": [
    {
      "timestamp": "2026-05-19T00:00:00+00:00",
      "temp": 24.5,
      "target": 23.0,
      "humidity": 41.2
    }
  ],
  "count": 1
}
```

---

### `POST /api/command`

Sends a raw command to the Arduino.

Example request:

```json
{
  "command": "EMERGENCY"
}
```

Example success response:

```json
{
  "success": true,
  "command": "EMERGENCY"
}
```

If the Arduino is not connected, the backend returns a `503` response with `success: false`.

---

### `POST /api/target`

Sends a target temperature value to the Arduino.

Request body:

```json
{
  "temperature": 24
}
```

The backend model validates that the target is between `18` and `30`.

---

## WebSocket API

The backend exposes a WebSocket endpoint at:

```text
/api/ws
```

For local development, the full URL is usually:

```text
ws://localhost:8001/api/ws
```

When a WebSocket client connects, the backend sends an initial message with:

- `type: "init"`
- the latest Arduino state
- the most recent history entries

Regular Arduino status updates are broadcast with:

```json
{
  "type": "data",
  "temp": 24.5,
  "humidity": 41.2,
  "target": 23.0,
  "mode": "EMERGENCY",
  "fan": true,
  "heater": false
}
```

Commands can also be sent through the WebSocket.

Example:

```json
{
  "command": "COMFORT"
}
```

The backend forwards the command to the Arduino if the serial connection is open.

---

## Frontend Overview

The frontend dashboard is implemented mainly in:

```text
frontend/src/App.js
```

The dashboard displays:

- Current temperature
- Target temperature
- Humidity
- Current operating mode
- Arduino/dashboard connection status
- Fan state
- Heater state
- LED state indicators
- Temperature history chart
- Humidity history chart
- System event log
- Emergency mode button
- Comfort mode button
- Stop button
- Manual fan toggle button
- Manual heater toggle button
- Target temperature input

The frontend uses WebSocket updates when available and also includes REST polling as a fallback.

---

## Frontend Environment Variable

The frontend expects a backend URL in:

```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

This value is used to create both REST API URLs and WebSocket URLs.

For example:

- `http://localhost:8001/api/status`
- `ws://localhost:8001/api/ws`

---

## Installation and Setup

### Prerequisites

Before running the project, install or prepare:

- Arduino IDE
- Arduino UNO connected by USB
- DHT sensor library for Arduino
- Python environment for the backend
- Node.js and Yarn for the frontend
- MongoDB database

---

### 1. Arduino Setup

Open the Arduino sketch:

```text
arduino/dome_city_controller.ino
```

Install the required Arduino library:

- `DHT sensor library` by Adafruit

If prompted, also install:

- `Adafruit Unified Sensor`

Then:

1. Connect the Arduino UNO to the computer.
2. Select the correct board in Arduino IDE.
3. Select the correct serial port.
4. Upload `dome_city_controller.ino`.

---

### 2. Backend Setup

Move into the backend folder:

```bash
cd backend
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create a `.env` file in the backend folder:

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=dome_city
SERIAL_PORT=COM4
SERIAL_BAUD=9600
CORS_ORIGINS=http://localhost:3000
```

Start the backend:

```bash
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

The backend will start the FastAPI server and begin trying to connect to the Arduino over the configured serial port.

---

### 3. Frontend Setup

Move into the frontend folder:

```bash
cd frontend
```

Install dependencies:

```bash
yarn install
```

Create a frontend environment file if needed:

```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

Start the React development server:

```bash
yarn start
```

---

## Typical Usage Flow

1. Wire the DHT22 sensor, LEDs, fan output, heater output, and buttons to the Arduino.
2. Upload the Arduino sketch to the Arduino UNO.
3. Start MongoDB.
4. Start the FastAPI backend.
5. Start the React frontend.
6. Open the dashboard in the browser.
7. Use the dashboard to monitor temperature and humidity.
8. Select emergency mode, comfort mode, stop/idle mode, or manual controls.
9. In comfort mode, enter a target temperature between `18°C` and `30°C`.

---

## Local Package

The repository includes a `local_package` folder with Windows batch scripts:

```text
local_package/
├── setup.bat
├── start.bat
├── README.md
├── arduino/
└── backend/
```

This appears to be a packaged local-running version of the project for Windows users. The scripts are intended to help install dependencies and start the dashboard locally.

---

## Testing and Reports

The repository includes testing-related files:

```text
backend_test.py
test_reports/iteration_1.json
test_reports/iteration_2.json
test_result.md
tests/__init__.py
```

These files are used for backend testing records and project test tracking. The `test_reports` folder contains JSON reports from previous testing iterations.

---

## Troubleshooting

### Arduino is not connecting

Check the following:

- The Arduino is plugged into the computer running the backend.
- The `SERIAL_PORT` value in `backend/.env` matches the actual Arduino port.
- The Arduino IDE Serial Monitor is closed, because another program using the port can block the backend.
- The USB cable supports data transfer, not only charging.
- Use `/api/ports` to view detected serial ports.

---

### Dashboard shows no live data

Check the following:

- The backend is running on the URL set in `REACT_APP_BACKEND_URL`.
- MongoDB is running and reachable through `MONGO_URL`.
- The Arduino is connected to the backend computer.
- The Arduino sketch has been uploaded successfully.
- The serial port and baud rate are correct.
- The browser console does not show failed requests to `/api/status` or `/api/ws`.

---

### Sensor readings are not appearing

Check the following:

- The DHT22 data pin is connected to D2.
- The DHT22 has power and ground connected.
- The required DHT Arduino library is installed.
- The Arduino sketch uploaded successfully.
- The Arduino serial output is producing JSON messages.

---

### Commands are not affecting the Arduino

Check the following:

- The backend has an active serial connection.
- The command is one of the supported serial commands.
- The Arduino is not being used by another serial application.
- The backend `/api/command` endpoint is not returning a `503` response.

---

## Important Notes

- The Arduino sketch starts in `MANUAL` mode.
- Emergency mode always uses `23°C` as the target temperature.
- Comfort mode accepts target temperatures from `18°C` to `30°C`.
- The Arduino uses a `0.3°C` deadband around the target temperature.
- The fan and heater are prevented from running at the same time by the Arduino logic.
- The backend requires `MONGO_URL` and `DB_NAME` environment variables.
- The backend defaults to `COM4` and `9600` baud if serial environment variables are not provided.
- The frontend requires `REACT_APP_BACKEND_URL` to know where the backend is running.
- The backend must run on a machine that has physical serial access to the Arduino unless the serial connection is handled through another method.

---

## License

No license file was found in the provided project files. Add a license if you plan to publish or distribute this project.
