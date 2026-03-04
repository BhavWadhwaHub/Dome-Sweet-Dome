from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
import asyncio
import serial
import serial.tools.list_ports
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone
from contextlib import asynccontextmanager

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Serial configuration
SERIAL_PORT = os.environ.get('SERIAL_PORT', 'COM4')
SERIAL_BAUD = int(os.environ.get('SERIAL_BAUD', '9600'))

# Global state
serial_connection = None
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
MAX_HISTORY = 100

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def read_serial():
    """Background task to read from Arduino serial port"""
    global serial_connection, arduino_data, temperature_history
    
    while True:
        try:
            if serial_connection is None or not serial_connection.is_open:
                # Try to connect
                try:
                    serial_connection = serial.Serial(SERIAL_PORT, SERIAL_BAUD, timeout=1)
                    arduino_data["connected"] = True
                    logger.info(f"Connected to Arduino on {SERIAL_PORT}")
                    await broadcast_message({"event": "CONNECTION", "status": "connected", "port": SERIAL_PORT})
                except Exception as e:
                    arduino_data["connected"] = False
                    logger.warning(f"Could not connect to {SERIAL_PORT}: {e}")
                    await asyncio.sleep(5)
                    continue
            
            # Read line from serial
            if serial_connection.in_waiting > 0:
                line = serial_connection.readline().decode('utf-8', errors='ignore').strip()
                if line:
                    try:
                        data = json.loads(line)
                        
                        # Check if it's a data message or event message
                        if "event" in data:
                            # Event message - broadcast directly
                            await broadcast_message(data)
                            
                            # Store event in database
                            event_doc = {
                                "id": str(uuid.uuid4()),
                                "event": data.get("event"),
                                "message": data.get("message", ""),
                                "data": data,
                                "timestamp": datetime.now(timezone.utc).isoformat()
                            }
                            await db.arduino_events.insert_one(event_doc)
                        else:
                            # Regular data message
                            arduino_data.update(data)
                            arduino_data["connected"] = True
                            arduino_data["last_update"] = datetime.now(timezone.utc).isoformat()
                            
                            # Add to temperature history
                            history_entry = {
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                                "temp": data.get("temp", 0),
                                "target": data.get("target", 0),
                                "humidity": data.get("humidity", 0)
                            }
                            temperature_history.append(history_entry)
                            if len(temperature_history) > MAX_HISTORY:
                                temperature_history.pop(0)
                            
                            # Store in database
                            reading_doc = {
                                "id": str(uuid.uuid4()),
                                **data,
                                "timestamp": datetime.now(timezone.utc).isoformat()
                            }
                            await db.temperature_readings.insert_one(reading_doc)
                            
                            # Broadcast to WebSocket clients
                            await broadcast_message({
                                "type": "data",
                                **arduino_data
                            })
                    except json.JSONDecodeError:
                        logger.debug(f"Non-JSON line: {line}")
            
            await asyncio.sleep(0.1)
            
        except serial.SerialException as e:
            logger.error(f"Serial error: {e}")
            arduino_data["connected"] = False
            serial_connection = None
            await broadcast_message({"event": "CONNECTION", "status": "disconnected", "error": str(e)})
            await asyncio.sleep(5)
        except Exception as e:
            logger.error(f"Error in serial read loop: {e}")
            await asyncio.sleep(1)

async def broadcast_message(message: dict):
    """Broadcast message to all connected WebSocket clients"""
    disconnected = []
    for ws in connected_websockets:
        try:
            await ws.send_json(message)
        except Exception:
            disconnected.append(ws)
    
    for ws in disconnected:
        if ws in connected_websockets:
            connected_websockets.remove(ws)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown"""
    # Startup
    logger.info("Starting Dome City Controller Backend...")
    serial_task = asyncio.create_task(read_serial())
    yield
    # Shutdown
    serial_task.cancel()
    if serial_connection and serial_connection.is_open:
        serial_connection.close()
    client.close()

# Create the main app
app = FastAPI(lifespan=lifespan)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Models
class CommandRequest(BaseModel):
    command: str

class TargetTemperatureRequest(BaseModel):
    temperature: float = Field(..., ge=18, le=30)

# API Routes
@api_router.get("/")
async def root():
    return {"message": "Dome City Controller API", "version": "1.0.0"}

@api_router.get("/status")
async def get_status():
    """Get current Arduino status"""
    return arduino_data

@api_router.get("/history")
async def get_history(limit: int = 50):
    """Get temperature history"""
    return {
        "history": temperature_history[-limit:],
        "count": len(temperature_history)
    }

@api_router.get("/events")
async def get_events(limit: int = 20):
    """Get recent events from database"""
    events = await db.arduino_events.find(
        {}, {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    return {"events": events}

@api_router.post("/command")
async def send_command(request: CommandRequest):
    """Send a command to Arduino via serial"""
    global serial_connection
    
    if serial_connection is None or not serial_connection.is_open:
        return JSONResponse(
            status_code=503,
            content={"error": "Arduino not connected", "success": False}
        )
    
    try:
        command = request.command.strip() + "\n"
        serial_connection.write(command.encode('utf-8'))
        logger.info(f"Sent command: {request.command}")
        return {"success": True, "command": request.command}
    except Exception as e:
        logger.error(f"Failed to send command: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "success": False}
        )

@api_router.post("/mode/emergency")
async def set_emergency_mode():
    """Activate emergency mode"""
    return await send_command(CommandRequest(command="EMERGENCY"))

@api_router.post("/mode/comfort")
async def set_comfort_mode():
    """Activate comfort mode"""
    return await send_command(CommandRequest(command="COMFORT"))

@api_router.post("/mode/idle")
async def set_idle_mode():
    """Set system to idle"""
    return await send_command(CommandRequest(command="IDLE"))

@api_router.post("/target")
async def set_target_temperature(request: TargetTemperatureRequest):
    """Set target temperature (for comfort mode)"""
    return await send_command(CommandRequest(command=str(request.temperature)))

@api_router.get("/ports")
async def list_serial_ports():
    """List available serial ports"""
    ports = serial.tools.list_ports.comports()
    return {
        "ports": [{"device": p.device, "description": p.description} for p in ports],
        "current": SERIAL_PORT,
        "connected": arduino_data["connected"]
    }

# WebSocket endpoint
@api_router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time data"""
    await websocket.accept()
    connected_websockets.append(websocket)
    logger.info(f"WebSocket client connected. Total clients: {len(connected_websockets)}")
    
    # Send current state immediately
    await websocket.send_json({
        "type": "init",
        **arduino_data,
        "history": temperature_history[-20:]
    })
    
    try:
        while True:
            # Handle incoming messages (commands from frontend)
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                if "command" in message:
                    # Forward command to Arduino
                    if serial_connection and serial_connection.is_open:
                        command = message["command"].strip() + "\n"
                        serial_connection.write(command.encode('utf-8'))
                        logger.info(f"WebSocket command: {message['command']}")
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    finally:
        if websocket in connected_websockets:
            connected_websockets.remove(websocket)

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
