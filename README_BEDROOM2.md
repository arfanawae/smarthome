# SmartHome — Bedroom 2 update

เพิ่มห้อง `bedroom2` / `ห้องนอน 2` ครบทั้ง Dashboard, Python config และ Arduino.

## ไฟล์ที่แก้
- `Assets/index.html` — เพิ่มจุดคลิก, badge และ light layer
- `Assets/style.css` — เพิ่มตำแหน่งห้องนอน 2 (ห้องด้านขวาบนของภาพ)
- `Assets/app.js` — เพิ่ม badge mapping
- `Python/rooms_config.py` — เพิ่มห้องนอน 2
- `Sketch/sketch.ino` — เพิ่ม PIR + Relay ของห้องนอน 2

## Pin ห้องนอน 2
ตัวอย่างที่ตั้งไว้:
- PIR = A0
- Relay = A1

**ต้องตรวจสอบและเปลี่ยน A0/A1 ให้ตรงกับสายที่ต่อจริงก่อนอัปโหลด**

ระบบ Dashboard ใช้ `bedroom2` เป็น ID เดียวกันทุกส่วน
