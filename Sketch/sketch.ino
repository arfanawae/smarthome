/*
  SmartHome Auto Light — Sketch (ฝั่ง MCU / STM32U585)
  ------------------------------------------------------
  หน้าที่ของไฟล์นี้:
    1) อ่านค่าจากเซนเซอร์ PIR ของแต่ละห้อง
    2) สั่งเปิด/ปิดรีเลย์ไฟของห้องนั้นตามผล PIR (โหมด AUTO)
       หรือตามคำสั่งจาก dashboard (โหมด MANUAL)
    3) รายงานสถานะไฟ + โหมด ให้ฝั่ง Python (Linux/MPU) ผ่าน Bridge/RPC

  หมายเหตุสำคัญ:
    Arduino UNO Q สื่อสารระหว่าง MCU <-> MPU ผ่าน "Router/Bridge" (MessagePack RPC)
    ไวยากรณ์การ register ฟังก์ชันให้ Python เรียก อาจเปลี่ยนตามเวอร์ชัน App Lab
    ให้เปิดโปรเจ็คนี้ใน Arduino App Lab แล้วดู built-in example "Blink"
    (Python เรียกฟังก์ชันบน MCU ผ่าน bridge) เพื่อ copy ไวยากรณ์ Bridge ล่าสุดมาแทน
    ส่วนที่คอมเมนต์ว่า "BRIDGE:" ด้านล่าง — ตรรกะเปิด/ปิดไฟทำงานได้ถูกต้อง
    โดยไม่ต้องพึ่ง Bridge เลย (ใช้ทดสอบไฟจริงได้ก่อน แล้วค่อยต่อ Bridge ทีหลัง)

  อ้างอิง: https://docs.arduino.cc/tutorials/uno-q/user-manual/
*/

// ---------- ตั้งค่าห้องแต่ละห้อง ----------
// ปรับขา (pin) ให้ตรงกับการต่อวงจรจริงของคุณ
struct Room {
  const char* id;      // ใช้อ้างอิงกับฝั่ง Python/Dashboard
  const char* nameTh;  // ชื่อห้องภาษาไทย (แสดงผลใน serial debug)
  uint8_t pirPin;       // ขา digital input ต่อกับโมดูล PIR
  uint8_t relayPin;      // ขา digital output ต่อกับโมดูลรีเลย์
  bool autoMode;         // true = ใช้ PIR อัตโนมัติ, false = manual จาก dashboard
  bool lightOn;           // สถานะไฟปัจจุบัน
  unsigned long lastMotionMs; // เวลาที่ตรวจจับความเคลื่อนไหวล่าสุด
};

// จำนวนห้อง 6 ห้องตามที่ระบุ: ครัว, นอน, น้ำ, นั่งเล่น, เก็บของ, จอดรถ
Room rooms[] = {
  { "kitchen",      "ห้องครัว",      2, 8,  true, false, 0 },
  { "bedroom",      "ห้องนอน",       3, 9,  true, false, 0 },
  { "bathroom",     "ห้องน้ำ",       4, 10, true, false, 0 },
  { "living_room",  "ห้องนั่งเล่น",  5, 11, true, false, 0 },
  { "storage",      "ห้องเก็บของ",  6, 12, true, false, 0 },
  { "garage",       "ห้องจอดรถ",    7, 13, true, false, 0 },
};
const uint8_t ROOM_COUNT = sizeof(rooms) / sizeof(rooms[0]);

// ไฟจะติดค้างไว้กี่มิลลิวินาทีหลังจากไม่เจอความเคลื่อนไหว (กันไฟกะพริบ)
const unsigned long HOLD_MS = 15000; // 15 วินาที ปรับได้ตามการใช้งานจริง

void setup() {
  Serial.begin(115200);
  for (uint8_t i = 0; i < ROOM_COUNT; i++) {
    pinMode(rooms[i].pirPin, INPUT);
    pinMode(rooms[i].relayPin, OUTPUT);
    digitalWrite(rooms[i].relayPin, LOW);
  }

  // BRIDGE: register ฟังก์ชันให้ Python เรียกใช้ตรงนี้ เช่น
  //   Bridge.provide("get_states", getStatesRPC);
  //   Bridge.provide("set_light", setLightRPC);
  //   Bridge.provide("set_mode", setModeRPC);
  // ให้แทนที่ด้วยไวยากรณ์จริงจาก App Lab เมื่อสร้างโปรเจ็คในนั้น
}

void loop() {
  unsigned long now = millis();

  for (uint8_t i = 0; i < ROOM_COUNT; i++) {
    if (rooms[i].autoMode) {
      bool motion = digitalRead(rooms[i].pirPin) == HIGH;
      if (motion) {
        rooms[i].lastMotionMs = now;
        setRoomLight(i, true);
      } else if (rooms[i].lightOn && (now - rooms[i].lastMotionMs > HOLD_MS)) {
        setRoomLight(i, false);
      }
    }
    // โหมด manual: ไม่ต้องทำอะไรใน loop เพราะสถานะถูกตั้งค่าจาก setLightRPC แล้ว
  }

  delay(100); // debounce เบา ๆ ระหว่างรอบอ่านค่า
}

void setRoomLight(uint8_t idx, bool on) {
  if (rooms[idx].lightOn == on) return;
  rooms[idx].lightOn = on;
  digitalWrite(rooms[idx].relayPin, on ? HIGH : LOW);
  Serial.print(rooms[idx].nameTh);
  Serial.println(on ? " เปิดไฟ" : " ปิดไฟ");
}

// ---------- ฟังก์ชันที่ฝั่ง Python เรียกผ่าน Bridge ----------

// คืนสถานะทุกห้อง เช่น "kitchen:1:1,bedroom:0:1,..." (id:lightOn:autoMode)
// (Bridge RPC ปกติจะ serialize เป็น struct/array ให้อัตโนมัติ — รูปแบบ string
//  นี้เป็นทางเลือกสำรองง่าย ๆ เผื่อยังไม่ได้ต่อ Bridge)
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

// dashboard สั่งเปิด/ปิดไฟเอง (จะสลับห้องนั้นเป็น manual mode ให้อัตโนมัติ)
void setLightRPC(String roomId, bool on) {
  for (uint8_t i = 0; i < ROOM_COUNT; i++) {
    if (roomId == rooms[i].id) {
      rooms[i].autoMode = false;
      setRoomLight(i, on);
      return;
    }
  }
}

// dashboard สลับห้องกลับเป็นโหมดอัตโนมัติ (ใช้ PIR ต่อ)
void setModeRPC(String roomId, bool autoMode) {
  for (uint8_t i = 0; i < ROOM_COUNT; i++) {
    if (roomId == rooms[i].id) {
      rooms[i].autoMode = autoMode;
      return;
    }
  }
}
