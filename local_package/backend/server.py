"""
Dome City Temperature Control - Local Backend
Run this on your PC where Arduino is connected via USB
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import serial
import serial.tools.list_ports
import asyncio
import json
import os
from datetime import datetime
from typing import List
from pydantic import BaseModel, Field

# Configuration - Auto-detect port or use environment variable
SERIAL_PORT = os.environ.get('SERIAL_PORT', None)  # None = auto-detect
SERIAL_BAUD = int(os.environ.get('SERIAL_BAUD', '9600'))
SERVER_PORT = int(os.environ.get('SERVER_PORT', '8002'))

app = FastAPI(title="Dome City Controller")

# CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state
serial_connection = None
current_port = None
connected_websockets: List[WebSocket] = []
arduino_data = {
    "temp": 0.0,
    "humidity": 0.0,
    "target": 23.0,
    "mode": "IDLE",
    "fan": False,
    "heater": False,
    "leds": {"red": 0, "yellow": 0, "green": 0, "blue": 0},
    "error": False,
    "waiting": False,
    "connected": False,
    "last_update": None
}
temperature_history = []
events_log = []

class CommandRequest(BaseModel):
    command: str

class TargetRequest(BaseModel):
    temperature: float = Field(..., ge=18, le=30)

def find_arduino_port():
    """Auto-detect Arduino port"""
    ports = serial.tools.list_ports.comports()
    for port in ports:
        desc = port.description.lower()
        if any(x in desc for x in ['arduino', 'ch340', 'usb serial', 'usb-serial', 'ftdi']):
            return port.device
    # Return first available COM port if no Arduino detected
    if ports:
        return ports[0].device
    return None

async def broadcast(message: dict):
    """Broadcast to all WebSocket clients"""
    for ws in connected_websockets[:]:
        try:
            await ws.send_json(message)
        except:
            if ws in connected_websockets:
                connected_websockets.remove(ws)

async def serial_reader():
    """Background task to read Arduino serial data"""
    global serial_connection, arduino_data, current_port
    
    retry_delay = 5  # seconds between connection attempts
    
    while True:
        try:
            if serial_connection is None or not serial_connection.is_open:
                # Determine which port to use
                port_to_use = SERIAL_PORT if SERIAL_PORT else find_arduino_port()
                
                if not port_to_use:
                    print("No serial ports found. Waiting for Arduino connection...")
                    await asyncio.sleep(retry_delay)
                    continue
                
                try:
                    serial_connection = serial.Serial(port_to_use, SERIAL_BAUD, timeout=1)
                    current_port = port_to_use
                    arduino_data["connected"] = True
                    print(f"Connected to Arduino on {port_to_use}")
                    await broadcast({"event": "CONNECTION", "status": "connected", "port": port_to_use})
                except Exception as e:
                    arduino_data["connected"] = False
                    # Only print once per retry cycle
                    print(f"Cannot connect to {port_to_use}: {e}")
                    await asyncio.sleep(retry_delay)
                    continue
            
            if serial_connection.in_waiting > 0:
                line = serial_connection.readline().decode('utf-8', errors='ignore').strip()
                if line:
                    try:
                        data = json.loads(line)
                        
                        if "event" in data:
                            events_log.insert(0, {**data, "timestamp": datetime.now().isoformat()})
                            events_log[:] = events_log[:100]
                            await broadcast(data)
                            print(f"Event: {data.get('event')} - {data.get('message', '')}")
                        else:
                            arduino_data.update(data)
                            arduino_data["connected"] = True
                            arduino_data["last_update"] = datetime.now().isoformat()
                            
                            # Add to history
                            temperature_history.append({
                                "timestamp": arduino_data["last_update"],
                                "temp": data.get("temp", 0),
                                "target": data.get("target", 0),
                                "humidity": data.get("humidity", 0)
                            })
                            temperature_history[:] = temperature_history[-100:]
                            
                            await broadcast({"type": "data", **arduino_data})
                    except json.JSONDecodeError:
                        pass
            
            await asyncio.sleep(0.05)
            
        except serial.SerialException as e:
            print(f"Serial error: {e}")
            arduino_data["connected"] = False
            serial_connection = None
            await broadcast({"event": "CONNECTION", "status": "disconnected"})
            await asyncio.sleep(retry_delay)
        except Exception as e:
            print(f"Error: {e}")
            await asyncio.sleep(1)

@app.on_event("startup")
async def startup():
    asyncio.create_task(serial_reader())
    print("\n" + "="*50)
    print("  DOME CITY CONTROLLER - LOCAL SERVER")
    print("="*50)
    print(f"  Serial Port: {SERIAL_PORT or 'Auto-detect'}")
    print(f"  Dashboard:   http://localhost:{SERVER_PORT}")
    print("="*50)
    print("  Tip: Set SERIAL_PORT env var to specify port")
    print("       e.g., set SERIAL_PORT=COM3")
    print("="*50 + "\n")

@app.get("/api/")
async def root():
    return {"message": "Dome City Controller API", "version": "1.0.0"}

@app.get("/api/status")
async def get_status():
    return arduino_data

@app.get("/api/history")
async def get_history(limit: int = 50):
    return {"history": temperature_history[-limit:], "count": len(temperature_history)}

@app.get("/api/events")
async def get_events(limit: int = 20):
    return {"events": events_log[:limit]}

@app.get("/api/ports")
async def list_ports():
    ports = serial.tools.list_ports.comports()
    return {
        "ports": [{"device": p.device, "description": p.description} for p in ports],
        "current": current_port,
        "connected": arduino_data["connected"]
    }

@app.post("/api/command")
async def send_command(req: CommandRequest):
    if not serial_connection or not serial_connection.is_open:
        return {"error": "Arduino not connected", "success": False}
    try:
        serial_connection.write((req.command.strip() + "\n").encode())
        return {"success": True, "command": req.command}
    except Exception as e:
        return {"error": str(e), "success": False}

@app.post("/api/mode/emergency")
async def emergency_mode():
    return await send_command(CommandRequest(command="EMERGENCY"))

@app.post("/api/mode/comfort")
async def comfort_mode():
    return await send_command(CommandRequest(command="COMFORT"))

@app.post("/api/mode/idle")
async def idle_mode():
    return await send_command(CommandRequest(command="STOP"))

@app.post("/api/target")
async def set_target(req: TargetRequest):
    return await send_command(CommandRequest(command=str(req.temperature)))

@app.websocket("/api/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    connected_websockets.append(ws)
    print(f"WebSocket client connected ({len(connected_websockets)} total)")
    
    await ws.send_json({"type": "init", **arduino_data, "history": temperature_history[-20:]})
    
    try:
        while True:
            data = await ws.receive_text()
            try:
                msg = json.loads(data)
                if "command" in msg and serial_connection and serial_connection.is_open:
                    serial_connection.write((msg["command"].strip() + "\n").encode())
            except:
                pass
    except WebSocketDisconnect:
        pass
    finally:
        if ws in connected_websockets:
            connected_websockets.remove(ws)
        print(f"WebSocket client disconnected ({len(connected_websockets)} remaining)")

# Serve frontend
if os.path.exists("frontend"):
    app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=SERVER_PORT)
