# Dome City Controller - Local Package

## Quick Start

### 1. Setup (Run Once)
```
Double-click: setup.bat
```
This installs Python dependencies.

### 2. Upload Arduino Code
1. Open `arduino/dome_city_controller.ino` in Arduino IDE
2. Select Board: **Arduino UNO**
3. Select Port: **COM4** (or your port)
4. Click **Upload**

### 3. Start Dashboard
```
Double-click: start.bat
```

Or specify a different port:
```
start.bat COM5
```

### 4. Open Dashboard
Open browser: **http://localhost:8001**

---

## Wiring Guide

```
Arduino UNO Pin Connections:
─────────────────────────────
D2  → DHT22 Data Pin
D3  → White Button (Comfort) → GND when pressed
D4  → Red Button (Emergency) → GND when pressed
D6  → Fan Relay Control
D7  → Heater Transistor Base (via 1kΩ resistor)
D8  → Red LED (via 220Ω)
D9  → Yellow LED (via 220Ω)
D10 → Green LED (via 220Ω)
D11 → Blue LED (via 220Ω)
5V  → DHT22 VCC
GND → Common ground
```

## Controls

| Button | Mode | Target |
|--------|------|--------|
| RED (D4) | Emergency | 23°C (fixed) |
| WHITE (D3) | Comfort | 18-30°C (user sets) |

## LED Meanings

| LED | Meaning |
|-----|---------|
| Red (blinking) | Emergency mode active |
| Yellow (blinking) | Heater running |
| Green (blinking) | Target reached |
| Blue (blinking) | Fan running |
| All blinking | Sensor error |

## Troubleshooting

**Arduino not connecting?**
- Check USB cable
- Verify COM port (Device Manager → Ports)
- Close Arduino IDE Serial Monitor
- Run: `start.bat COM5` (replace with your port)

**No sensor readings?**
- Check DHT22 wiring
- Ensure 10kΩ pull-up on data line
