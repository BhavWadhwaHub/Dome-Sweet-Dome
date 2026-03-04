/*
  Dome City Temperature Control System
  Based on user's working button logic
*/

#include <DHT.h>

#define DHTPIN 2
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

// LEDs
#define RED_LED     8
#define YELLOW_LED  9
#define GREEN_LED  10
#define BLUE_LED   11

// Actuators
#define FAN_PIN     6
#define HEATER_PIN  7

// Buttons
#define RED_BUTTON   4
#define WHITE_BUTTON 5

float targetTemp = 23.0;
float deadband = 0.3;

enum Mode { IDLE, EMERGENCY, COMFORT, MANUAL };
Mode mode = MANUAL;  // Start in MANUAL mode so buttons work immediately

bool heaterState = false;
bool fanState = false;
bool systemStopped = false;
bool waitingForInput = false;
bool firstBoot = true;  // Track if system just booted

// Blink control
unsigned long lastBlink = 0;
bool blinkState = false;
const unsigned long blinkInterval = 300;

// Serial output timer
unsigned long lastPrint = 0;
const unsigned long printInterval = 500;

// Button edge detect
bool lastRedRead = HIGH;
bool lastWhiteRead = HIGH;

String serialBuffer = "";

void setup() {
  Serial.begin(9600);
  dht.begin();

  pinMode(RED_LED, OUTPUT);
  pinMode(YELLOW_LED, OUTPUT);
  pinMode(GREEN_LED, OUTPUT);
  pinMode(BLUE_LED, OUTPUT);

  pinMode(FAN_PIN, OUTPUT);
  pinMode(HEATER_PIN, OUTPUT);

  pinMode(RED_BUTTON, INPUT_PULLUP);
  pinMode(WHITE_BUTTON, INPUT_PULLUP);

  // Initial state: ALL OFF
  digitalWrite(FAN_PIN, LOW);
  digitalWrite(HEATER_PIN, LOW);
  fanState = false;
  heaterState = false;

  // LEDs off
  digitalWrite(RED_LED, LOW);
  digitalWrite(YELLOW_LED, LOW);
  digitalWrite(GREEN_LED, LOW);
  digitalWrite(BLUE_LED, LOW);

  // Boot sequence
  bootSequence();

  Serial.println("{\"event\":\"SYSTEM_READY\",\"message\":\"System Ready\"}");
}

void bootSequence() {
  // All LEDs ON and stay ON until user command
  digitalWrite(RED_LED, HIGH);
  digitalWrite(YELLOW_LED, HIGH);
  digitalWrite(GREEN_LED, HIGH);
  digitalWrite(BLUE_LED, HIGH);
  // LEDs stay ON - user sees system is ready and waiting for input
}

void updateBlink() {
  if (millis() - lastBlink >= blinkInterval) {
    blinkState = !blinkState;
    lastBlink = millis();
  }
}

bool pressedEdge(int pin, bool &lastRead) {
  bool now = digitalRead(pin);
  bool edge = (lastRead == HIGH && now == LOW);
  lastRead = now;
  return edge;
}

void loop() {
  updateBlink();

  // Handle serial commands from dashboard
  handleSerial();

  // Read sensor
  float temp = dht.readTemperature();
  float hum = dht.readHumidity();

  if (isnan(temp) || isnan(hum)) {
    // Sensor error - all LEDs blink
    digitalWrite(RED_LED, blinkState);
    digitalWrite(YELLOW_LED, blinkState);
    digitalWrite(GREEN_LED, blinkState);
    digitalWrite(BLUE_LED, blinkState);
    digitalWrite(FAN_PIN, LOW);
    digitalWrite(HEATER_PIN, LOW);
    return;
  }

  // =========================
  // IDLE MODE (STOP)
  // =========================
  if (mode == IDLE) {
    if (systemStopped) {
      digitalWrite(RED_LED, HIGH);  // Red ON solid
      digitalWrite(YELLOW_LED, LOW);
      digitalWrite(GREEN_LED, LOW);
      digitalWrite(BLUE_LED, LOW);
    }
    digitalWrite(FAN_PIN, LOW);
    digitalWrite(HEATER_PIN, LOW);
    fanState = false;
    heaterState = false;
  }

  // =========================
  // EMERGENCY MODE
  // =========================
  else if (mode == EMERGENCY) {
    // Red LED always blinks in emergency
    digitalWrite(RED_LED, blinkState);

    if (temp < targetTemp - deadband) {
      // Too cold - heat
      heaterState = true;
      fanState = false;
      digitalWrite(YELLOW_LED, blinkState);
      digitalWrite(BLUE_LED, LOW);
      digitalWrite(GREEN_LED, LOW);
    }
    else if (temp > targetTemp + deadband) {
      // Too hot - cool
      heaterState = false;
      fanState = true;
      digitalWrite(BLUE_LED, blinkState);
      digitalWrite(YELLOW_LED, LOW);
      digitalWrite(GREEN_LED, LOW);
    }
    else {
      // Stable
      heaterState = false;
      fanState = false;
      digitalWrite(GREEN_LED, blinkState);
      digitalWrite(YELLOW_LED, LOW);
      digitalWrite(BLUE_LED, LOW);
    }

    digitalWrite(HEATER_PIN, heaterState);
    digitalWrite(FAN_PIN, fanState);
  }

  // =========================
  // COMFORT MODE (Auto + Manual buttons)
  // =========================
  else if (mode == COMFORT) {
    digitalWrite(RED_LED, LOW);

    if (waitingForInput) {
      // Waiting for target temp - green blinks
      digitalWrite(GREEN_LED, blinkState);
      digitalWrite(YELLOW_LED, LOW);
      digitalWrite(BLUE_LED, LOW);
    }
    else {
      // Auto temperature control
      if (temp < targetTemp - deadband) {
        heaterState = true;
        fanState = false;
        digitalWrite(YELLOW_LED, blinkState);
        digitalWrite(BLUE_LED, LOW);
        digitalWrite(GREEN_LED, LOW);
      }
      else if (temp > targetTemp + deadband) {
        heaterState = false;
        fanState = true;
        digitalWrite(BLUE_LED, blinkState);
        digitalWrite(YELLOW_LED, LOW);
        digitalWrite(GREEN_LED, LOW);
      }
      else {
        heaterState = false;
        fanState = false;
        digitalWrite(GREEN_LED, blinkState);
        digitalWrite(YELLOW_LED, LOW);
        digitalWrite(BLUE_LED, LOW);
      }
    }

    digitalWrite(HEATER_PIN, heaterState);
    digitalWrite(FAN_PIN, fanState);
  }

  // =========================
  // MANUAL MODE (Physical buttons work here)
  // Also works on first boot
  // =========================
  else if (mode == MANUAL) {
    // On first boot, keep all LEDs ON until button pressed
    if (firstBoot) {
      digitalWrite(RED_LED, HIGH);
      digitalWrite(YELLOW_LED, HIGH);
      digitalWrite(GREEN_LED, HIGH);
      digitalWrite(BLUE_LED, HIGH);
    } else {
      digitalWrite(RED_LED, LOW);
      digitalWrite(GREEN_LED, LOW);
      // Yellow and Blue controlled by state below
    }

    // RED BUTTON = Toggle Heater
    if (pressedEdge(RED_BUTTON, lastRedRead)) {
      firstBoot = false;  // User interacted
      heaterState = !heaterState;
      if (heaterState) fanState = false;  // Turn off fan when heater on
      // Turn off all LEDs first, then set based on state
      digitalWrite(RED_LED, LOW);
      digitalWrite(GREEN_LED, LOW);
      Serial.print("{\"event\":\"MANUAL_CONTROL\",\"device\":\"HEATER\",\"state\":\"");
      Serial.print(heaterState ? "ON" : "OFF");
      Serial.println("\"}");
    }

    // WHITE BUTTON = Toggle Fan
    if (pressedEdge(WHITE_BUTTON, lastWhiteRead)) {
      firstBoot = false;  // User interacted
      fanState = !fanState;
      if (fanState) heaterState = false;  // Turn off heater when fan on
      // Turn off all LEDs first, then set based on state
      digitalWrite(RED_LED, LOW);
      digitalWrite(GREEN_LED, LOW);
      Serial.print("{\"event\":\"MANUAL_CONTROL\",\"device\":\"FAN\",\"state\":\"");
      Serial.print(fanState ? "ON" : "OFF");
      Serial.println("\"}");
    }

    // Update LEDs based on state (only after first interaction)
    if (!firstBoot) {
      digitalWrite(YELLOW_LED, heaterState ? blinkState : LOW);
      digitalWrite(BLUE_LED, fanState ? blinkState : LOW);
    }

    // Apply outputs
    digitalWrite(HEATER_PIN, heaterState);
    digitalWrite(FAN_PIN, fanState);
  }

  // =========================
  // SERIAL OUTPUT (JSON)
  // =========================
  if (millis() - lastPrint >= printInterval) {
    lastPrint = millis();
    sendJsonData(temp, hum);
  }
}

void handleSerial() {
  while (Serial.available() > 0) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') {
      if (serialBuffer.length() > 0) {
        processCommand(serialBuffer);
        serialBuffer = "";
      }
    } else {
      serialBuffer += c;
    }
  }
}

void processCommand(String cmd) {
  cmd.trim();
  cmd.toUpperCase();

  if (cmd == "EMERGENCY") {
    mode = EMERGENCY;
    targetTemp = 23.0;
    heaterState = false;
    fanState = false;
    waitingForInput = false;
    systemStopped = false;
    firstBoot = false;
    Serial.println("{\"event\":\"MODE_CHANGE\",\"mode\":\"EMERGENCY\",\"target\":23}");
  }
  else if (cmd == "COMFORT") {
    mode = COMFORT;
    heaterState = false;
    fanState = false;
    waitingForInput = true;
    systemStopped = false;
    firstBoot = false;
    digitalWrite(FAN_PIN, LOW);
    digitalWrite(HEATER_PIN, LOW);
    Serial.println("{\"event\":\"MODE_CHANGE\",\"mode\":\"COMFORT\",\"message\":\"Enter target 18-30\"}");
  }
  else if (cmd == "STOP" || cmd == "IDLE") {
    mode = IDLE;
    heaterState = false;
    fanState = false;
    waitingForInput = false;
    systemStopped = true;
    firstBoot = false;
    digitalWrite(FAN_PIN, LOW);
    digitalWrite(HEATER_PIN, LOW);
    Serial.println("{\"event\":\"MODE_CHANGE\",\"mode\":\"IDLE\",\"message\":\"Stopped\"}");
  }
  else if (cmd == "MANUAL") {
    mode = MANUAL;
    waitingForInput = false;
    systemStopped = false;
    firstBoot = false;
    Serial.println("{\"event\":\"MODE_CHANGE\",\"mode\":\"MANUAL\"}");
  }
  else if (cmd == "TOGGLE_FAN" || cmd == "FAN_TOGGLE") {
    mode = MANUAL;
    firstBoot = false;
    fanState = !fanState;
    if (fanState) heaterState = false;
    digitalWrite(FAN_PIN, fanState);
    digitalWrite(HEATER_PIN, heaterState);
    Serial.print("{\"event\":\"MANUAL_CONTROL\",\"device\":\"FAN\",\"state\":\"");
    Serial.print(fanState ? "ON" : "OFF");
    Serial.println("\"}");
  }
  else if (cmd == "TOGGLE_HEATER" || cmd == "HEATER_TOGGLE") {
    mode = MANUAL;
    firstBoot = false;
    heaterState = !heaterState;
    if (heaterState) fanState = false;
    digitalWrite(HEATER_PIN, heaterState);
    digitalWrite(FAN_PIN, fanState);
    Serial.print("{\"event\":\"MANUAL_CONTROL\",\"device\":\"HEATER\",\"state\":\"");
    Serial.print(heaterState ? "ON" : "OFF");
    Serial.println("\"}");
  }
  else if (cmd == "FAN_ON") {
    mode = MANUAL;
    firstBoot = false;
    fanState = true;
    heaterState = false;
    digitalWrite(FAN_PIN, HIGH);
    digitalWrite(HEATER_PIN, LOW);
    Serial.println("{\"event\":\"MANUAL_CONTROL\",\"device\":\"FAN\",\"state\":\"ON\"}");
  }
  else if (cmd == "FAN_OFF") {
    mode = MANUAL;
    firstBoot = false;
    fanState = false;
    digitalWrite(FAN_PIN, LOW);
    Serial.println("{\"event\":\"MANUAL_CONTROL\",\"device\":\"FAN\",\"state\":\"OFF\"}");
  }
  else if (cmd == "HEATER_ON") {
    mode = MANUAL;
    firstBoot = false;
    heaterState = true;
    fanState = false;
    digitalWrite(HEATER_PIN, HIGH);
    digitalWrite(FAN_PIN, LOW);
    Serial.println("{\"event\":\"MANUAL_CONTROL\",\"device\":\"HEATER\",\"state\":\"ON\"}");
  }
  else if (cmd == "HEATER_OFF") {
    mode = MANUAL;
    firstBoot = false;
    heaterState = false;
    digitalWrite(HEATER_PIN, LOW);
    Serial.println("{\"event\":\"MANUAL_CONTROL\",\"device\":\"HEATER\",\"state\":\"OFF\"}");
  }
  else if (cmd.startsWith("T=")) {
    float t = cmd.substring(2).toFloat();
    if (t >= 18 && t <= 30) {
      targetTemp = t;
      waitingForInput = false;
      Serial.print("{\"event\":\"TARGET_SET\",\"target\":");
      Serial.print(targetTemp);
      Serial.println("}");
    }
  }
  else {
    // Try parsing as temperature number
    float t = cmd.toFloat();
    if (t >= 18 && t <= 30 && waitingForInput) {
      targetTemp = t;
      waitingForInput = false;
      Serial.print("{\"event\":\"TARGET_SET\",\"target\":");
      Serial.print(targetTemp);
      Serial.println("}");
    }
  }
}

void sendJsonData(float temp, float hum) {
  bool stable = (mode == COMFORT || mode == EMERGENCY) 
                && !waitingForInput 
                && abs(temp - targetTemp) <= deadband;

  Serial.print("{\"temp\":");
  Serial.print(temp, 1);
  Serial.print(",\"humidity\":");
  Serial.print(hum, 1);
  Serial.print(",\"target\":");
  Serial.print(targetTemp, 1);
  Serial.print(",\"mode\":\"");
  
  switch (mode) {
    case IDLE: Serial.print("IDLE"); break;
    case EMERGENCY: Serial.print("EMERGENCY"); break;
    case COMFORT: Serial.print("COMFORT"); break;
    case MANUAL: Serial.print("MANUAL"); break;
  }
  
  Serial.print("\",\"fan\":");
  Serial.print(fanState ? "true" : "false");
  Serial.print(",\"heater\":");
  Serial.print(heaterState ? "true" : "false");
  Serial.print(",\"stable\":");
  Serial.print(stable ? "true" : "false");
  
  // LED states: 0=off, 1=on, 2=blink
  int redState = 0, yellowState = 0, greenState = 0, blueState = 0;
  
  if (mode == EMERGENCY) redState = 2;
  else if (mode == IDLE && systemStopped) redState = 1;
  
  if (heaterState) yellowState = 2;
  if (fanState) blueState = 2;
  if (stable || waitingForInput) greenState = 2;
  
  Serial.print(",\"leds\":{\"red\":");
  Serial.print(redState);
  Serial.print(",\"yellow\":");
  Serial.print(yellowState);
  Serial.print(",\"green\":");
  Serial.print(greenState);
  Serial.print(",\"blue\":");
  Serial.print(blueState);
  Serial.print("},\"error\":false,\"waiting\":");
  Serial.print(waitingForInput ? "true" : "false");
  Serial.println("}");
}
