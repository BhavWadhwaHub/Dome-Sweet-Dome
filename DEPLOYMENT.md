# Deployment Guide - Dome City Temperature Control System

This guide covers deployment options for all components of the system.

## Table of Contents
1. [Arduino Deployment](#1-arduino-deployment)
2. [Backend Deployment](#2-backend-deployment)
3. [Frontend Deployment](#3-frontend-deployment)
4. [Full Stack Deployment Options](#4-full-stack-deployment-options)

---

## 1. Arduino Deployment

### Option A: Direct Upload via Arduino IDE (Recommended for Development)

**Requirements:**
- Arduino IDE installed
- USB cable to connect Arduino to computer
- DHT library installed

**Steps:**
1. Open Arduino IDE
2. Install DHT Library:
   - Go to `Sketch → Include Library → Manage Libraries`
   - Search for "DHT sensor library" by Adafruit
   - Install it (and Adafruit Unified Sensor library if prompted)
3. Open `dome_city_controller.ino`
4. Select Board: `Tools → Board → Arduino UNO`
5. Select Port: `Tools → Port → COM4` (or your port)
6. Click `Upload` button (or press `Ctrl+U`)

**Note:** The Arduino must remain connected to the computer via USB for serial communication with the backend.

### Option B: OTA (Over-The-Air) Update (Advanced)

For remote updates without physical access:
- Use ESP8266/ESP32 instead of Arduino UNO
- Configure OTA update capability
- Requires WiFi connection

---

## 2. Backend Deployment

The backend is a FastAPI application that requires:
- Python 3.8+
- Access to serial port (for Arduino communication)
- MongoDB database
- Persistent connection to Arduino

### Option A: Local/On-Premise Server (Recommended)

**Best for:** Development, testing, or when Arduino is physically nearby

**Steps:**
```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Create .env file
cat > .env << EOF
SERIAL_PORT=COM4
SERIAL_BAUD=9600
MONGO_URL=mongodb://localhost:27017
DB_NAME=dome_city
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
EOF

# Run server
uvicorn server:app --host 0.0.0.0 --port 8001
```

**Note:** The backend must run on a machine with physical access to the Arduino via USB.

### Option B: Cloud Deployment (Limited Functionality)

**⚠️ Important Limitation:** Cloud deployment won't work for serial communication unless you use:
- Serial-to-IP bridge (e.g., ser2net, ESP8266 serial bridge)
- IoT platform with serial support (e.g., AWS IoT, Azure IoT Hub)

**Platform Options:**

#### Railway.app
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

**Environment Variables:**
- `SERIAL_PORT` - Not applicable (use serial bridge)
- `MONGO_URL` - MongoDB connection string
- `CORS_ORIGINS` - Your frontend URL

#### Render.com
1. Create new Web Service
2. Connect GitHub repository
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn server:app --host 0.0.0.0 --port $PORT`
5. Set environment variables

#### Heroku
```bash
# Install Heroku CLI
heroku create dome-city-backend

# Set environment variables
heroku config:set SERIAL_PORT=COM4
heroku config:set MONGO_URL=your_mongodb_url

# Deploy
git push heroku main
```

#### AWS EC2 / DigitalOcean Droplet
```bash
# SSH into server
ssh user@your-server

# Install Python and dependencies
sudo apt update
sudo apt install python3-pip
pip3 install -r requirements.txt

# Use systemd service
sudo nano /etc/systemd/system/dome-backend.service
```

Service file:
```ini
[Unit]
Description=Dome City Backend
After=network.target

[Service]
User=your-user
WorkingDirectory=/path/to/backend
Environment="SERIAL_PORT=/dev/ttyUSB0"
ExecStart=/usr/bin/python3 -m uvicorn server:app --host 0.0.0.0 --port 8001

[Install]
WantedBy=multi-user.target
```

### Option C: Docker Deployment

Create `Dockerfile`:
```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
```

Build and run:
```bash
docker build -t dome-backend .
docker run -p 8001:8001 --device=/dev/ttyUSB0 dome-backend
```

**Note:** Requires `--device` flag to access serial port.

---

## 3. Frontend Deployment

The frontend is a React application that can be deployed as static files.

### Option A: Netlify (Recommended - Free Tier)

**Steps:**
1. Build the frontend:
   ```bash
   cd frontend
   yarn install
   yarn build
   ```

2. Deploy to Netlify:
   - Go to [netlify.com](https://netlify.com)
   - Drag and drop the `build` folder, OR
   - Connect GitHub repository and set build command: `yarn build`
   - Set publish directory: `build`

3. Configure environment:
   - Add environment variable: `REACT_APP_API_URL=https://your-backend-url.com`

**Netlify CLI:**
```bash
npm install -g netlify-cli
netlify deploy --prod --dir=build
```

### Option B: Vercel (Recommended - Free Tier)

**Steps:**
1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Deploy:
   ```bash
   cd frontend
   vercel
   ```

3. Set environment variables in Vercel dashboard:
   - `REACT_APP_API_URL`

**GitHub Integration:**
- Connect repository to Vercel
- Auto-deploys on push to main branch

### Option C: GitHub Pages

**Steps:**
1. Install gh-pages:
   ```bash
   cd frontend
   yarn add -D gh-pages
   ```

2. Update `package.json`:
   ```json
   {
     "homepage": "https://yourusername.github.io/dome-city",
     "scripts": {
       "predeploy": "yarn build",
       "deploy": "gh-pages -d build"
     }
   }
   ```

3. Deploy:
   ```bash
   yarn deploy
   ```

### Option D: AWS S3 + CloudFront

**Steps:**
1. Build frontend:
   ```bash
   yarn build
   ```

2. Upload to S3:
   ```bash
   aws s3 sync build/ s3://your-bucket-name --delete
   ```

3. Configure CloudFront distribution pointing to S3 bucket

### Option E: Traditional Web Hosting

Upload the `build` folder contents to your web hosting provider via FTP/SFTP.

---

## 4. Full Stack Deployment Options

### Option 1: Local Development Setup (Recommended for Testing)

**Architecture:**
```
Arduino (USB) → Backend (localhost:8001) → Frontend (localhost:3000)
```

**Setup:**
1. Upload Arduino code via IDE
2. Run backend: `uvicorn server:app --host 0.0.0.0 --port 8001`
3. Run frontend: `yarn start`

### Option 2: Hybrid Deployment (Recommended for Production)

**Architecture:**
```
Arduino (USB) → Backend (Local Server/VPS) → Frontend (Cloud - Netlify/Vercel)
```

**Why this works:**
- Backend needs physical access to Arduino (must be local)
- Frontend can be anywhere (just needs API URL)

**Setup:**
1. Deploy backend on local server/VPS with Arduino connected
2. Deploy frontend to Netlify/Vercel
3. Configure frontend to point to backend URL
4. Set up reverse proxy (nginx) for backend if needed

### Option 3: IoT Platform Integration

For true cloud deployment, consider:

**AWS IoT Core:**
- Arduino → ESP8266/ESP32 → AWS IoT Core → Backend API → Frontend

**Azure IoT Hub:**
- Similar architecture with Azure services

**Google Cloud IoT:**
- Similar architecture with GCP services

### Option 4: Serial-to-IP Bridge

**Using ESP8266/ESP32:**
1. Flash ESP8266 with serial bridge firmware
2. Connect ESP8266 to Arduino via serial
3. Backend connects to ESP8266 via TCP/IP instead of USB

**Using ser2net (Linux):**
```bash
# Install ser2net
sudo apt install ser2net

# Configure /etc/ser2net.yaml
connection: &arduino
    accepter: tcp,8002
    connector: serialdev,/dev/ttyUSB0,9600n81
```

Backend connects to `localhost:8002` instead of serial port.

---

## Environment Variables Reference

### Backend (.env)
```env
SERIAL_PORT=COM4                    # Windows: COM4, Linux: /dev/ttyUSB0
SERIAL_BAUD=9600
MONGO_URL=mongodb://localhost:27017
DB_NAME=dome_city
CORS_ORIGINS=http://localhost:3000,https://your-frontend.netlify.app
```

### Frontend
```env
REACT_APP_API_URL=http://localhost:8001  # Development
REACT_APP_API_URL=https://your-backend.com  # Production
```

---

## Quick Start Deployment Checklist

- [ ] Arduino code uploaded to board
- [ ] Backend dependencies installed
- [ ] MongoDB database set up
- [ ] Backend `.env` configured
- [ ] Backend running and accessible
- [ ] Frontend built (`yarn build`)
- [ ] Frontend environment variables set
- [ ] Frontend deployed to hosting
- [ ] CORS configured correctly
- [ ] WebSocket connection tested
- [ ] Serial communication verified

---

## Troubleshooting Deployment

### Backend can't connect to Arduino
- Check serial port name (Windows: `COM4`, Linux: `/dev/ttyUSB0`)
- Ensure no other app is using the port
- Check USB cable connection
- Verify Arduino is powered on

### Frontend can't connect to backend
- Check CORS settings in backend
- Verify `REACT_APP_API_URL` is correct
- Check backend is running and accessible
- Test API endpoint directly in browser

### WebSocket connection fails
- Verify backend WebSocket endpoint is accessible
- Check firewall settings
- Ensure WebSocket protocol (ws:// or wss://) matches

---

## Recommended Production Setup

1. **Arduino:** Upload code, keep connected to local server
2. **Backend:** Deploy on VPS (DigitalOcean, AWS EC2) with Arduino connected
3. **Frontend:** Deploy to Netlify/Vercel (free tier)
4. **Database:** MongoDB Atlas (free tier) or self-hosted
5. **Monitoring:** Add logging and health checks
6. **Security:** Use HTTPS, secure WebSocket (WSS), API authentication

---

## Cost Estimates

**Free Tier Options:**
- Netlify/Vercel: Free (frontend)
- MongoDB Atlas: Free 512MB (database)
- Railway/Render: Free tier available (backend)

**Paid Options:**
- VPS (DigitalOcean): $5-10/month
- AWS EC2: $10-20/month
- Domain name: $10-15/year

---

For more details, refer to the main [README.md](./README.md) file.
