/*
  SmartHome Auto Light — Sketch
  เพิ่มห้องนอน 2:
  - PIR = A0
  - Relay = A1
  เปลี่ยน A0/A1 ให้ตรงกับการต่อวงจรจริงก่อนอัปโหลด
*/

struct Room {
  const char* id;
  const char* nameTh;
  uint8_t pirPin;
  uint8_t relayPin;
  bool autoMode;
  bool lightOn;
  unsigned long lastMotionMs;
};

Room rooms[] = {
  { "kitchen",      "ห้องครัว",       2,  8,  true, false, 0 },
  { "bedroom",      "ห้องนอน",        3,  9,  true, false, 0 },
  { "bedroom2",     "ห้องนอน 2",     A0, A1,  true, false, 0 },
  { "bathroom",     "ห้องน้ำ",        4, 10,  true, false, 0 },
  { "living_room",  "ห้องนั่งเล่น",   5, 11,  true, false, 0 },
  { "storage",      "ห้องเก็บของ",   6, 12,  true, false, 0 },
  { "garage",       "ห้องจอดรถ",     7, 13,  true, false, 0 },
};

const uint8_t ROOM_COUNT = sizeof(rooms) / sizeof(rooms[0]);
const unsigned long HOLD_MS = 15000;

void setup() {
  Serial.begin(115200);

  for (uint8_t i = 0; i < ROOM_COUNT; i++) {
    pinMode(rooms[i].pirPin, INPUT);
    pinMode(rooms[i].relayPin, OUTPUT);
    digitalWrite(rooms[i].relayPin, LOW);
  }

  // BRIDGE: register getStatesRPC / setLightRPC / setModeRPC
  // ตามไวยากรณ์ Bridge ของ Arduino App Lab เวอร์ชันที่ใช้งาน
}

void loop() {
  unsigned long now = millis();

  for (uint8_t i = 0; i < ROOM_COUNT; i++) {
    if (rooms[i].autoMode) {
      bool motion = digitalRead(rooms[i].pirPin) == HIGH;

      if (motion) {
        rooms[i].lastMotionMs = now;
        setRoomLight(i, true);
      } else if (rooms[i].lightOn &&
                 (now - rooms[i].lastMotionMs > HOLD_MS)) {
        setRoomLight(i, false);
      }
    }
  }

  delay(100);
}

void setRoomLight(uint8_t idx, bool on) {
  if (rooms[idx].lightOn == on) return;

  rooms[idx].lightOn = on;
  digitalWrite(rooms[idx].relayPin, on ? HIGH : LOW);

  Serial.print(rooms[idx].nameTh);
  Serial.println(on ? " เปิดไฟ" : " ปิดไฟ");
}

String getStatesRPC() {
  String out = "";

  for (uint8_t i = 0; i < ROOM_COUNT; i++) {
    out += rooms[i].id;
    out += ":";
    out += rooms[i].lightOn ? "1" : "0";
    out += ":";
    out += rooms[i].autoMode ? "1" : "0";

    if (i < ROOM_COUNT - 1) out += ",";
  }

  return out;
}

void setLightRPC(String roomId, bool on) {
  for (uint8_t i = 0; i < ROOM_COUNT; i++) {
    if (roomId == rooms[i].id) {
      rooms[i].autoMode = false;
      setRoomLight(i, on);
      return;
    }
  }
}

void setModeRPC(String roomId, bool autoMode) {
  for (uint8_t i = 0; i < ROOM_COUNT; i++) {
    if (roomId == rooms[i].id) {
      rooms[i].autoMode = autoMode;
      return;
    }
  }
}
