# Dome Sweet Dome

Dome Sweet Dome is an Arduino-based temperature control system with a web dashboard for monitoring and controlling a small climate-control setup. The project connects an Arduino temperature system to a FastAPI backend through serial communication, then displays live system status in a React frontend.

The system supports automatic temperature control, emergency mode, comfort mode, manual fan/heater toggling and real-time dashboard updates through WebSocket or polling.

---

## Project Overview

This project is designed to control and monitor temperature inside a dome-style environment. The Arduino reads temperature and humidity from a DHT22 sensor and controls a fan and heater depending on the active mode. The backend reads data from the Arduino through a serial port, stores readings/events in MongoDB and exposes API endpoints for the frontend. The frontend provides a dashboard with live temperature, humidity, target temperature, LED states, system logs and control buttons.

---

## Main Features

- Arduino-based temperature and humidity monitoring
- DHT22 sensor support
- Fan and heater control through Arduino output pins
- Emergency mode with fixed target temperature
- Comfort mode with user-selected target temperature
- Manual fan and heater toggling
- LED indicators for system state
- JSON-based serial communication between Arduino and backend
- FastAPI backend with REST API and WebSocket support
- MongoDB storage for temperature readings and Arduino events
- React dashboard for real-time monitoring
- Temperature and humidity charts using Recharts
- WebSocket live updates with polling fallback
- Local Windows package scripts included in `local_package`

---

## Tech Stack

### Hardware / Embedded

- Arduino UNO
- DHT22 temperature and humidity sensor
- Fan relay or fan control output
- Heater output
- LEDs for status indication
- Physical buttons for manual control

### Backend

- Python
- FastAPI
- Uvicorn
- PySerial
- Motor / MongoDB
- python-dotenv
- WebSocket support

### Frontend

- React
- CRACO
- Tailwind CSS
- Recharts
- Lucide React icons
- Sonner toast notifications

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
│   │   └── index.html
│   ├── src/
│   │   ├── App.js
│   │   ├── App.css
│   │   ├── index.js
│   │   ├── index.css
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── components/ui/
│   ├── package.json
│   ├── craco.config.js
│   ├── tailwind.config.js
│   └── postcss.config.js
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
├── backend_test.py
├── DEPLOYMENT.md
├── design_guidelines.json
├── test_result.md
└── README.md
