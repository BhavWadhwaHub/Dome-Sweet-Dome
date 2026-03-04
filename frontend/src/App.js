import { useState, useEffect, useCallback, useRef } from "react";
import "@/App.css";
import { Toaster, toast } from "sonner";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Thermometer,
  Fan,
  Flame,
  AlertTriangle,
  Wifi,
  WifiOff,
  Activity,
  Droplets,
  Target,
  Power,
  Zap,
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const WS_URL = BACKEND_URL?.replace("https://", "wss://").replace("http://", "ws://");

// Custom hook for Arduino data with polling fallback
const useArduino = () => {
  const [data, setData] = useState({
    temp: 0,
    humidity: 0,
    target: 23,
    mode: "IDLE",
    fan: false,
    heater: false,
    leds: { red: 0, yellow: 0, green: 0, blue: 0 },
    error: false,
    waiting: false,
    connected: false,
    last_update: null,
  });
  const [history, setHistory] = useState([]);
  const [events, setEvents] = useState([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [usePolling, setUsePolling] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const wsFailCountRef = useRef(0);

  // Polling fallback function
  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/status`);
      if (response.ok) {
        const newData = await response.json();
        setData((prev) => {
          // Add to history if temperature changed
          if (prev.temp !== newData.temp || prev.target !== newData.target) {
            setHistory((h) => {
              const entry = {
                timestamp: new Date().toISOString(),
                time: new Date().toLocaleTimeString(),
                temp: newData.temp,
                target: newData.target,
                humidity: newData.humidity,
              };
              return [...h, entry].slice(-50);
            });
          }
          return { ...prev, ...newData };
        });
      }
    } catch (e) {
      console.error("Polling error:", e);
    }
  }, []);

  // Start polling
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return;
    setUsePolling(true);
    toast.success("Dashboard Connected", { description: "Polling mode active" });
    fetchData(); // Initial fetch
    pollingIntervalRef.current = setInterval(fetchData, 1000);
  }, [fetchData]);

  // WebSocket connection
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (usePolling) return; // Already using polling

    try {
      const ws = new WebSocket(`${WS_URL}/api/ws`);

      ws.onopen = () => {
        setWsConnected(true);
        wsFailCountRef.current = 0;
        toast.success("Dashboard Connected", { description: "Real-time data stream active" });
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === "init") {
            setData((prev) => ({ ...prev, ...message }));
            if (message.history) {
              setHistory(
                message.history.map((h) => ({
                  ...h,
                  time: new Date(h.timestamp).toLocaleTimeString(),
                }))
              );
            }
          } else if (message.type === "data") {
            setData((prev) => ({ ...prev, ...message }));
            setHistory((prev) => {
              const newEntry = {
                timestamp: message.last_update,
                time: new Date().toLocaleTimeString(),
                temp: message.temp,
                target: message.target,
                humidity: message.humidity,
              };
              const updated = [...prev, newEntry];
              return updated.slice(-50);
            });
          } else if (message.event) {
            setEvents((prev) => {
              const newEvent = {
                ...message,
                timestamp: new Date().toISOString(),
              };
              return [newEvent, ...prev].slice(0, 50);
            });

            // Show toast for events
            if (message.event === "MODE_CHANGE") {
              if (message.mode === "EMERGENCY") {
                toast.error("Emergency Mode", { description: message.message });
              } else if (message.mode === "COMFORT") {
                toast.info("Comfort Mode", { description: message.message });
              } else {
                toast("System Idle", { description: message.message });
              }
            } else if (message.event === "CONNECTION") {
              if (message.status === "connected") {
                toast.success("Arduino Connected", { description: `Port: ${message.port}` });
              } else {
                toast.error("Arduino Disconnected", { description: message.error });
              }
            }
          }
        } catch (e) {
          console.error("Failed to parse WebSocket message:", e);
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        wsFailCountRef.current++;
        
        // After 2 failures, switch to polling
        if (wsFailCountRef.current >= 2) {
          startPolling();
        } else {
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    } catch (e) {
      // WebSocket not supported or blocked, use polling
      startPolling();
    }
  }, [usePolling, startPolling]);

  const sendCommand = useCallback(async (command) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ command }));
    } else {
      // Use REST API fallback
      try {
        await fetch(`${BACKEND_URL}/api/command`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command }),
        });
        // Add event to log
        setEvents((prev) => [
          { event: "COMMAND_SENT", message: `Command: ${command}`, timestamp: new Date().toISOString() },
          ...prev,
        ].slice(0, 50));
      } catch (e) {
        toast.error("Command Failed", { description: e.message });
      }
    }
  }, []);

  useEffect(() => {
    // Start with polling immediately for responsiveness
    fetchData();
    pollingIntervalRef.current = setInterval(fetchData, 2000);
    setUsePolling(true);
    
    // Try WebSocket as upgrade
    connect();
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      wsRef.current?.close();
    };
  }, [connect, fetchData]);

  return { data, history, events, wsConnected: wsConnected || usePolling, sendCommand, dashboardConnected: usePolling || wsConnected };
};

// LED Indicator Component
const LedIndicator = ({ color, state, label }) => {
  const colorMap = {
    red: { bg: "bg-red-500", shadow: "shadow-red-500/50", border: "border-red-600" },
    yellow: { bg: "bg-yellow-400", shadow: "shadow-yellow-400/50", border: "border-yellow-500" },
    green: { bg: "bg-emerald-500", shadow: "shadow-emerald-500/50", border: "border-emerald-600" },
    blue: { bg: "bg-sky-500", shadow: "shadow-sky-500/50", border: "border-sky-600" },
  };

  const isBlinking = state === 2;
  const isOn = state === 1 || state === 2;
  const styles = colorMap[color];

  return (
    <div className="flex flex-col items-center gap-2" data-testid={`led-${color}`}>
      <div
        className={`
          w-8 h-8 rounded-full border-2 transition-all duration-200
          ${styles.border}
          ${isOn ? `${styles.bg} shadow-[0_0_15px_currentColor] ${styles.shadow}` : "bg-zinc-800/50 opacity-30"}
          ${isBlinking ? "animate-pulse" : ""}
        `}
        aria-label={`${label} LED: ${isOn ? (isBlinking ? "blinking" : "on") : "off"}`}
      />
      <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
        {label}
      </span>
    </div>
  );
};

// Metric Card Component
const MetricCard = ({ children, className = "", highlight = false }) => (
  <div
    className={`
      bg-zinc-900/50 border border-zinc-800 p-4 md:p-6 relative overflow-hidden
      transition-all duration-300 hover:border-zinc-700
      ${highlight ? "border-amber-500/50 bg-amber-500/5" : ""}
      ${className}
    `}
  >
    {children}
  </div>
);

// Status Badge Component
const StatusBadge = ({ status, arduinoConnected, dashboardConnected }) => {
  const statusConfig = {
    IDLE: { color: "bg-zinc-700", text: "text-zinc-300", icon: Power },
    EMERGENCY: { color: "bg-red-600", text: "text-red-100", icon: AlertTriangle },
    COMFORT: { color: "bg-emerald-600", text: "text-emerald-100", icon: Thermometer },
    MANUAL: { color: "bg-amber-600", text: "text-amber-100", icon: Activity },
  };

  const config = statusConfig[status] || statusConfig.IDLE;
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-3" data-testid="status-badge">
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${config.color}`}>
        <Icon className={`w-4 h-4 ${config.text}`} />
        <span className={`text-xs font-bold uppercase tracking-wider ${config.text}`}>
          {status}
        </span>
      </div>
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
          dashboardConnected ? "bg-emerald-600/20 text-emerald-400" : "bg-red-600/20 text-red-400"
        }`}
        data-testid="connection-status"
      >
        {dashboardConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
        <span className="text-xs font-bold uppercase tracking-wider">
          {dashboardConnected ? (arduinoConnected ? "Arduino Online" : "Polling") : "Offline"}
        </span>
      </div>
    </div>
  );
};

// System Log Component
const SystemLog = ({ events }) => {
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = 0;
    }
  }, [events]);

  return (
    <div
      ref={logRef}
      className="font-mono text-xs bg-black/80 p-4 border border-zinc-800 h-48 overflow-y-auto"
      data-testid="system-log"
    >
      {events.length === 0 ? (
        <p className="text-zinc-600">Waiting for events...</p>
      ) : (
        events.map((event, index) => (
          <div key={index} className="mb-1 flex gap-2">
            <span className="text-zinc-600">
              {new Date(event.timestamp).toLocaleTimeString()}
            </span>
            <span
              className={`
                ${event.event === "MODE_CHANGE" && event.mode === "EMERGENCY" ? "text-red-400" : ""}
                ${event.event === "MODE_CHANGE" && event.mode === "COMFORT" ? "text-emerald-400" : ""}
                ${event.event === "CONNECTION" && event.status === "connected" ? "text-emerald-400" : ""}
                ${event.event === "CONNECTION" && event.status === "disconnected" ? "text-red-400" : ""}
                ${event.event === "TARGET_SET" ? "text-amber-400" : ""}
                ${!["MODE_CHANGE", "CONNECTION", "TARGET_SET"].includes(event.event) ? "text-zinc-400" : ""}
              `}
            >
              [{event.event}] {event.message || JSON.stringify(event)}
            </span>
          </div>
        ))
      )}
    </div>
  );
};

// Custom Chart Tooltip
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-900 border border-zinc-700 p-3 rounded-lg">
        <p className="text-zinc-400 text-xs mb-2">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {entry.value?.toFixed(1)}
            {entry.name === "Humidity" ? "%" : "°C"}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Main Dashboard Component
const Dashboard = () => {
  const { data, history, events, wsConnected, sendCommand, dashboardConnected } = useArduino();
  const [targetInput, setTargetInput] = useState("");

  const handleSetTarget = () => {
    const temp = parseFloat(targetInput);
    if (temp >= 18 && temp <= 30) {
      sendCommand(String(temp));
      setTargetInput("");
      toast.info("Setting target temperature", { description: `${temp}°C` });
    } else {
      toast.error("Invalid temperature", { description: "Enter a value between 18-30°C" });
    }
  };

  const isEmergency = data.mode === "EMERGENCY";

  return (
    <div
      className={`min-h-screen bg-[#09090b] text-zinc-100 ${
        isEmergency ? "emergency-pulse" : ""
      }`}
      data-testid="dashboard"
    >
      <Toaster
        theme="dark"
        position="top-right"
        toastOptions={{
          style: { background: "#18181b", border: "1px solid #27272a" },
        }}
      />

      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold uppercase tracking-widest text-amber-500 font-heading">
              Dome City Controller
            </h1>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mt-1">
              Temperature Control System
            </p>
          </div>
          <StatusBadge status={data.mode} arduinoConnected={data.connected} dashboardConnected={dashboardConnected} />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
        {/* Sensor Error Banner */}
        {data.error && (
          <div
            className="mb-6 p-4 bg-red-900/30 border border-red-600 rounded flex items-center gap-3"
            data-testid="error-banner"
          >
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span className="text-red-300 font-medium">
              SENSOR ERROR - All outputs disabled for safety
            </span>
          </div>
        )}

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {/* Temperature Display - Large */}
          <MetricCard className="lg:col-span-2 lg:row-span-2" highlight={isEmergency}>
            <div className="flex flex-col h-full justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs uppercase tracking-wider text-zinc-500 font-medium flex items-center gap-2">
                    <Activity className="w-3 h-3" />
                    Current Temperature
                  </span>
                  <div
                    className="mt-4 font-mono text-6xl md:text-8xl font-bold tracking-tighter"
                    data-testid="current-temp"
                  >
                    {data.temp.toFixed(1)}
                    <span className="text-3xl md:text-4xl text-zinc-500">°C</span>
                  </div>
                </div>
                <Thermometer
                  className={`w-12 h-12 ${
                    data.heater ? "text-amber-500" : data.fan ? "text-sky-500" : "text-zinc-600"
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mt-6">
                <div>
                  <span className="text-xs uppercase tracking-wider text-zinc-500 font-medium flex items-center gap-2">
                    <Target className="w-3 h-3" />
                    Target
                  </span>
                  <div className="font-mono text-2xl mt-1" data-testid="target-temp">
                    {data.target.toFixed(1)}°C
                  </div>
                </div>
                <div>
                  <span className="text-xs uppercase tracking-wider text-zinc-500 font-medium flex items-center gap-2">
                    <Droplets className="w-3 h-3" />
                    Humidity
                  </span>
                  <div className="font-mono text-2xl mt-1" data-testid="humidity">
                    {data.humidity.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          </MetricCard>

          {/* LED Status */}
          <MetricCard className="lg:col-span-2">
            <span className="text-xs uppercase tracking-wider text-zinc-500 font-medium">
              LED Status
            </span>
            <div className="flex justify-around mt-6">
              <LedIndicator color="red" state={data.leds.red} label="Emergency" />
              <LedIndicator color="yellow" state={data.leds.yellow} label="Heating" />
              <LedIndicator color="green" state={data.leds.green} label="Target OK" />
              <LedIndicator color="blue" state={data.leds.blue} label="Cooling" />
            </div>
          </MetricCard>

          {/* Actuators Status */}
          <MetricCard>
            <span className="text-xs uppercase tracking-wider text-zinc-500 font-medium flex items-center gap-2">
              <Fan className="w-3 h-3" />
              Fan Status
            </span>
            <div
              className={`mt-4 flex items-center gap-3 ${
                data.fan ? "text-sky-400" : "text-zinc-600"
              }`}
              data-testid="fan-status"
            >
              <Fan className={`w-8 h-8 ${data.fan ? "animate-spin" : ""}`} />
              <span className="font-mono text-xl font-bold uppercase">
                {data.fan ? "ON" : "OFF"}
              </span>
            </div>
          </MetricCard>

          <MetricCard>
            <span className="text-xs uppercase tracking-wider text-zinc-500 font-medium flex items-center gap-2">
              <Flame className="w-3 h-3" />
              Heater Status
            </span>
            <div
              className={`mt-4 flex items-center gap-3 ${
                data.heater ? "text-amber-400" : "text-zinc-600"
              }`}
              data-testid="heater-status"
            >
              <Flame className={`w-8 h-8 ${data.heater ? "animate-pulse" : ""}`} />
              <span className="font-mono text-xl font-bold uppercase">
                {data.heater ? "ON" : "OFF"}
              </span>
            </div>
          </MetricCard>

          {/* Controls */}
          <MetricCard className="lg:col-span-2">
            <span className="text-xs uppercase tracking-wider text-zinc-500 font-medium">
              System Controls
            </span>
            {/* Mode Buttons */}
            <div className="mt-4 grid grid-cols-3 gap-3">
              <button
                onClick={() => sendCommand("EMERGENCY")}
                className="px-4 py-3 bg-red-600 hover:bg-red-500 text-white font-bold uppercase text-sm tracking-wider rounded transition-colors flex items-center justify-center gap-2"
                data-testid="emergency-btn"
              >
                <Zap className="w-4 h-4" />
                Emergency
              </button>
              <button
                onClick={() => sendCommand("COMFORT")}
                className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase text-sm tracking-wider rounded transition-colors flex items-center justify-center gap-2"
                data-testid="comfort-btn"
              >
                <Thermometer className="w-4 h-4" />
                Comfort
              </button>
              <button
                onClick={() => sendCommand("STOP")}
                className="px-4 py-3 bg-zinc-700 hover:bg-zinc-600 text-white font-bold uppercase text-sm tracking-wider rounded transition-colors flex items-center justify-center gap-2"
                data-testid="stop-btn"
              >
                <Power className="w-4 h-4" />
                Stop
              </button>
            </div>

            {/* Manual Mode Controls */}
            <div className="mt-4">
              <span className="text-xs uppercase tracking-wider text-zinc-500 font-medium">
                Manual Controls
              </span>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <button
                  onClick={() => sendCommand("TOGGLE_FAN")}
                  className={`px-4 py-3 ${data.fan ? 'bg-sky-600 ring-2 ring-sky-400' : 'bg-zinc-800 border border-zinc-700'} hover:bg-sky-500 text-white font-bold uppercase text-sm tracking-wider rounded transition-colors flex items-center justify-center gap-2`}
                  data-testid="toggle-fan-btn"
                >
                  <Fan className={`w-5 h-5 ${data.fan ? 'animate-spin' : ''}`} />
                  Toggle Fan
                </button>
                <button
                  onClick={() => sendCommand("TOGGLE_HEATER")}
                  className={`px-4 py-3 ${data.heater ? 'bg-amber-600 ring-2 ring-amber-400' : 'bg-zinc-800 border border-zinc-700'} hover:bg-amber-500 text-white font-bold uppercase text-sm tracking-wider rounded transition-colors flex items-center justify-center gap-2`}
                  data-testid="toggle-heater-btn"
                >
                  <Flame className={`w-5 h-5 ${data.heater ? 'animate-pulse' : ''}`} />
                  Toggle Heater
                </button>
              </div>
            </div>

            {/* Target Temperature Input */}
            <div className="mt-4 flex gap-2">
              <input
                type="number"
                min="18"
                max="30"
                step="0.5"
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                placeholder="Target (18-30°C)"
                className="flex-1 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded text-zinc-100 font-mono placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
                data-testid="target-input"
              />
              <button
                onClick={handleSetTarget}
                disabled={data.mode !== "COMFORT" || data.waiting === false}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-bold uppercase text-sm tracking-wider rounded transition-colors"
                data-testid="set-target-btn"
              >
                Set
              </button>
            </div>
            {data.waiting && (
              <p className="mt-2 text-xs text-amber-400">
                Waiting for temperature input (18-30°C)
              </p>
            )}
          </MetricCard>

          {/* Temperature Chart */}
          <MetricCard className="lg:col-span-2">
            <span className="text-xs uppercase tracking-wider text-zinc-500 font-medium">
              Temperature History
            </span>
            <div className="mt-4 h-64" data-testid="temp-chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    dataKey="time"
                    stroke="#52525b"
                    tick={{ fill: "#71717a", fontSize: 10 }}
                  />
                  <YAxis
                    stroke="#52525b"
                    tick={{ fill: "#71717a", fontSize: 10 }}
                    domain={["dataMin - 1", "dataMax + 1"]}
                    tickCount={20}
                    unit="°C"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ paddingTop: "10px" }}
                    formatter={(value) => (
                      <span className="text-xs uppercase tracking-wider">{value}</span>
                    )}
                  />
                  <Line
                    type="monotone"
                    dataKey="temp"
                    name="Temperature"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: "#f59e0b" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="target"
                    name="Target"
                    stroke="#10b981"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </MetricCard>

          {/* Humidity Chart */}
          <MetricCard className="lg:col-span-2">
            <span className="text-xs uppercase tracking-wider text-zinc-500 font-medium">
              Humidity History
            </span>
            <div className="mt-4 h-64" data-testid="humidity-chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    dataKey="time"
                    stroke="#52525b"
                    tick={{ fill: "#71717a", fontSize: 10 }}
                  />
                  <YAxis
                    stroke="#52525b"
                    tick={{ fill: "#71717a", fontSize: 10 }}
                    domain={[0, 100]}
                    tickCount={11}
                    unit="%"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ paddingTop: "10px" }}
                    formatter={(value) => (
                      <span className="text-xs uppercase tracking-wider">{value}</span>
                    )}
                  />
                  <Line
                    type="monotone"
                    dataKey="humidity"
                    name="Humidity"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: "#0ea5e9" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </MetricCard>

          {/* System Log */}
          <MetricCard className="lg:col-span-4">
            <span className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-4 block">
              System Log
            </span>
            <SystemLog events={events} />
          </MetricCard>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-4 mt-8">
        <div className="max-w-[1600px] mx-auto px-4 md:px-8 flex justify-between items-center text-xs text-zinc-600">
          <span>Dome City Temperature Control v1.0.0</span>
          <span>
            Last Update:{" "}
            {data.last_update
              ? new Date(data.last_update).toLocaleTimeString()
              : "Never"}
          </span>
        </div>
      </footer>
    </div>
  );
};

function App() {
  return <Dashboard />;
}

export default App;
