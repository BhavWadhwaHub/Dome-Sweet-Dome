# Dome City Temperature Control System

A complete Arduino-based temperature control system with Emergency and Comfort modes, featuring a real-time web dashboard for monitoring and control.

## System Overview

### Hardware Components
- **Arduino UNO** - Main controller
- **DHT22** - Temperature & humidity sensor (Pin D2)
- **Fan Relay** - Cooling control (Pin D6)
- **Kapton Heating Pad** - Heating via transistor (Pin D7)
- **LEDs** - Status indicators
  - Red (D8): Emergency mode indicator
  - Yellow (D9): Heating active
  - Green (D10): Target temperature reached
  - Blue (D11): Cooling active
- **Buttons**
  - White (D3): Comfort Mode
  - Red (D4): Emergency Mode

### Operating Modes

#### Emergency Mode (RED Button - D4)
- Target temperature: **23°C** (fixed)
- Red LED blinks while controlling
- When target reached:
  - Red LED stops blinking
  - Green LED starts blinking
  - Fan OFF, Heater OFF
- Temperature > target: Fan ON, Blue LED blinks
- Temperature < target: Heater ON, Yellow LED blinks

#### Comfort Mode (WHITE Button - D3)
- User sets target via Serial (18-30°C range)
- When target reached: Green LED blinks
- Temperature > target: Fan ON, Blue LED blinks
- Temperature < target: Heater ON, Yellow LED blinks

#### Safety Features
- Boot sequence: All LEDs ON, then sequential test
- Sensor error: All LEDs blink, outputs forced OFF

## Project Structure

```
/app/
├── arduino/
│   └── dome_city_controller.ino    # Arduino sketch
├── backend/
│   ├── server.py                   # FastAPI backend with WebSocket
│   ├── requirements.txt            # Python dependencies
│   └── .env                        # Environment configuration
├── frontend/
│   ├── src/
│   │   ├── App.js                  # React dashboard
│   │   └── App.css                 # Custom styles
│   └── package.json                # Node dependencies
└── README.md                       # This file
```

## Setup Instructions

### 1. Arduino Setup

1. **Install Arduino IDE** (if not already installed)
2. **Install DHT Library**:
   - Open Arduino IDE
   - Go to Sketch → Include Library → Manage Libraries
   - Search for "DHT sensor library" by Adafruit
   - Install it (and the Adafruit Unified Sensor library if prompted)

3. **Upload the Sketch**:
   - Open `/app/arduino/dome_city_controller.ino`
   - Select Board: Arduino UNO
   - Select Port: COM4 (or your port)
   - Click Upload

### 2. Wiring Diagram

```
Arduino UNO Pin Connections:
─────────────────────────────
D2  ──→ DHT22 Data Pin
D3  ──→ White Button (to GND when pressed)
D4  ──→ Red Button (to GND when pressed)
D6  ──→ Fan Relay Control
D7  ──→ Heater Transistor Base (via 1kΩ resistor)
D8  ──→ Red LED (via 220Ω resistor)
D9  ──→ Yellow LED (via 220Ω resistor)
D10 ──→ Green LED (via 220Ω resistor)
D11 ──→ Blue LED (via 220Ω resistor)
5V  ──→ DHT22 VCC, Pull-up resistors
GND ──→ Common ground
```

### 3. Backend Setup

```bash
cd /app/backend

# Install dependencies
pip install -r requirements.txt

# Configure serial port (edit .env)
SERIAL_PORT=COM4  # Change to your port
SERIAL_BAUD=9600

# Start the server
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### 4. Frontend Setup

```bash
cd /app/frontend

# Install dependencies
yarn install

# Start development server
yarn start
```

## API Reference

### REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/` | API health check |
| GET | `/api/status` | Current Arduino status |
| GET | `/api/history` | Temperature history |
| GET | `/api/events` | Recent system events |
| GET | `/api/ports` | List available serial ports |
| POST | `/api/command` | Send command to Arduino |
| POST | `/api/mode/emergency` | Activate Emergency mode |
| POST | `/api/mode/comfort` | Activate Comfort mode |
| POST | `/api/mode/idle` | Set system to idle |
| POST | `/api/target` | Set target temperature |

### WebSocket

Connect to `ws://localhost:8001/api/ws` for real-time data streaming.

**Message Types:**
- `init` - Initial state with history
- `data` - Regular sensor data updates
- `event` - System events (mode changes, errors)

**Send Commands:**
```json
{"command": "EMERGENCY"}
{"command": "COMFORT"}
{"command": "IDLE"}
{"command": "25"}  // Set target to 25°C
```

## Serial Protocol

### Arduino Output (JSON)
```json
{
  "temp": 25.5,
  "humidity": 60.0,
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
  "waiting": false
}
```

LED State Values:
- `0` = OFF
- `1` = ON
- `2` = BLINKING

### Serial Commands
- `EMERGENCY` - Activate Emergency mode
- `COMFORT` - Activate Comfort mode
- `IDLE` or `STOP` - Stop all control
- `18-30` - Set target temperature (in Comfort mode)

## Dashboard Features

- **Real-time Temperature Display** - Current temp, target, humidity
- **LED Status Visualization** - Animated LED indicators
- **Actuator Status** - Fan and heater ON/OFF with animations
- **Mode Controls** - Emergency, Comfort, Stop buttons
- **Temperature Chart** - Historical data with Recharts
- **System Log** - Live event console
- **Connection Status** - WebSocket and Arduino connection indicators

## Troubleshooting

### Arduino Not Connecting
1. Check the serial port in `/app/backend/.env`
2. Ensure no other application is using the port
3. Check USB cable connection
4. Verify Arduino IDE Serial Monitor is closed

### No Data on Dashboard
1. Check WebSocket connection status
2. Verify backend is running
3. Check browser console for errors
4. Ensure Arduino is sending data (check Serial Monitor)

### Sensor Errors
- All LEDs blinking indicates DHT22 error
- Check sensor wiring
- Ensure proper pull-up resistor on data line


