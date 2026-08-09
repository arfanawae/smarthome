// ==========================================
// ส่วนที่ 1: ดึงอิลีเมนต์จากหน้าเว็บ (DOM) และประกาศตัวแปรหลัก
// ==========================================
const roomsListEl = document.getElementById("roomsList"); // พื้นที่สำหรับแสดงรายการการ์ดห้อง
const connStatusEl = document.getElementById("connStatus"); // สถานะการเชื่อมต่อ (Online/Offline)
const houseViewEl = document.getElementById("houseView"); // พื้นที่รูปภาพบ้านจำลอง

let rooms = []; // ตัวแปรอาร์เรย์สำหรับเก็บข้อมูลสถานะของทุกห้อง

// กำหนดคลาส CSS สำหรับป้ายกำกับ (Badge) ของแต่ละห้องในรูปภาพ
const badgeMap = {
  living_room: ".badge-living",
  kitchen: ".badge-kitchen",
  bathroom: ".badge-bathroom",
  storage: ".badge-storage",
  bedroom: ".badge-bedroom",
  bedroom2: ".badge-bedroom2",
  garage: ".badge-garage",
};

// ==========================================
// ส่วนที่ 2: ฟังก์ชันสำหรับสร้างและอัปเดตหน้าจอ (Render)
// ==========================================
function render(newRooms) {
  rooms = newRooms; // อัปเดตข้อมูลล่าสุด

  // 2.1 อัปเดตสถานะแสงไฟบน "รูปภาพบ้าน"
  rooms.forEach((room) => {
    // หาพื้นที่ของห้องนั้นในรูป
    const zone = houseViewEl.querySelector(`.room-zone[data-room="${room.id}"]`);
    const badge = houseViewEl.querySelector(badgeMap[room.id]);

    // ถ้าไฟเปิดอยู่ ให้เพิ่มคลาส 'on' เพื่อแสดงเอฟเฟกต์ไฟเปิดบนรูป
    if (zone) zone.classList.toggle("on", !!room.light_on);
    if (badge) badge.classList.toggle("on", !!room.light_on);

    const lightLayer = houseViewEl.querySelector(`.room-light[data-light-room="${room.id}"]`);
    if (lightLayer) lightLayer.classList.toggle("on", !!room.light_on);
  });

  // ล้างข้อมูลการ์ดเดิมออกก่อนเพื่อวาดใหม่
  roomsListEl.innerHTML = "";

  // 2.2 สร้าง "การ์ดควบคุม" ของแต่ละห้อง
  rooms.forEach((room) => {
    const card = document.createElement("div");
    card.className = "room-card";
    
    // โครงสร้าง HTML ของการ์ดแต่ละใบ
    card.innerHTML = `
      <div>
        <div class="room-card__name">${room.name}</div>
        <div class="room-card__meta">
          ${room.light_on ? "ไฟเปิดอยู่" : "ไฟปิดอยู่"} ·
          ${room.auto_mode ? "อัตโนมัติ (ตั้งเวลา/PIR)" : "ควบคุมเอง"}
        </div>
      </div>
      <div class="room-card__controls">
        
        <!-- [ส่วนที่เพิ่มใหม่] ช่องตั้งเวลา (จะแสดงชัดเจนเมื่อเปิดโหมด AUTO) -->
        <input type="time" 
               class="time-input" 
               style="${room.auto_mode ? '' : 'opacity: 0.3; pointer-events: none;'}" 
               value="${room.off_time || ''}"
               data-action="set-time" 
               data-room="${room.id}">

        <!-- ปุ่มสลับโหมด AUTO / MANUAL -->
        <button class="mode-btn ${room.auto_mode ? "auto" : ""}"
                data-action="mode" data-room="${room.id}">
          ${room.auto_mode ? "AUTO" : "MANUAL"}
        </button>

        <!-- สวิตช์เปิด-ปิดไฟ -->
        <div class="toggle ${room.light_on ? "on" : ""}"
             data-action="toggle" data-room="${room.id}">
          <div class="toggle__knob"></div>
        </div>
      </div>
    `;
    roomsListEl.appendChild(card); // นำการ์ดไปแปะในหน้าเว็บ
  });
}

// ==========================================
// ส่วนที่ 3: ฟังก์ชันสั่งงานไปยังเซิร์ฟเวอร์ (API Calls)
// ==========================================

// 3.1 ฟังก์ชันเปิด-ปิดไฟ
async function toggleLight(roomId) {
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return;

  // เปลี่ยนค่าชั่วคราวและอัปเดตหน้าจอก่อน เพื่อให้ UI ตอบสนองผู้ใช้ทันที (Optimistic UI)
  room.light_on = !room.light_on;
  render(rooms);

  try {
    // ส่งคำสั่งไปที่ Server
    await fetch(`/api/rooms/${roomId}/light`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ on: room.light_on }),
    });
  } catch (err) {
    console.error("toggleLight failed:", err);
    // ถ้าเน็ตหลุดหรือส่งข้อมูลไม่สำเร็จ ให้คืนค่ากลับเป็นแบบเดิม
    room.light_on = !room.light_on;
    render(rooms);
  }
}

// 3.2 ฟังก์ชันเปลี่ยนโหมด AUTO / MANUAL
async function toggleMode(roomId) {
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return;

  room.auto_mode = !room.auto_mode;
  render(rooms);

  try {
    await fetch(`/api/rooms/${roomId}/mode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auto: room.auto_mode }),
    });
  } catch (err) {
    console.error("toggleMode failed:", err);
    room.auto_mode = !room.auto_mode;
    render(rooms);
  }
}

// 3.3 [ส่วนที่เพิ่มใหม่] ฟังก์ชันส่งค่า "เวลาปิดไฟ" ไปที่ Server
async function setTime(roomId, timeValue) {
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return;

  room.off_time = timeValue; 
  // หมายเหตุ: เราไม่เรียก render(rooms) ตรงนี้ เพราะจะทำให้กล่องกรอกเวลากระพริบและเสียโฟกัส
  
  try {
    await fetch(`/api/rooms/${roomId}/time`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ off_time: timeValue }),
    });
  } catch (err) {
    console.error("setTime failed:", err);
  }
}

// ==========================================
// ส่วนที่ 4: การดักจับเหตุการณ์ (Event Listeners)
// ==========================================

// 4.1 ตรวจจับการคลิกบน "รูปบ้าน"
houseViewEl.addEventListener("click", (e) => {
  const zone = e.target.closest(".room-zone");
  // ถ้าคลิกโดนโซนห้อง ให้เรียกฟังก์ชันสลับไฟ
  if (zone) toggleLight(zone.dataset.room);
});

// 4.2 ตรวจจับการ "คลิก" บน "การ์ดควบคุม" (ปุ่มต่างๆ)
roomsListEl.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;

  // เช็คว่ากดปุ่มไหน แล้วเรียกฟังก์ชันให้ตรง
  if (el.dataset.action === "toggle") toggleLight(el.dataset.room);
  if (el.dataset.action === "mode") toggleMode(el.dataset.room);
});

// 4.3 [ส่วนที่เพิ่มใหม่] ตรวจจับการ "เปลี่ยนค่าเวลา" (เปลี่ยนค่าเสร็จแล้วคลิกที่อื่น)
roomsListEl.addEventListener("change", (e) => {
  const el = e.target.closest('[data-action="set-time"]');
  if (!el) return;

  // ดึงค่าเวลาใหม่จาก input แล้วส่งไปบันทึก
  setTime(el.dataset.room, el.value);
});

// ==========================================
// ส่วนที่ 5: การเริ่มต้นระบบ และเชื่อมต่อ Real-time
// ==========================================

// 5.1 โหลดข้อมูลครั้งแรกเมื่อเปิดหน้าเว็บ
fetch("/api/rooms")
  .then((r) => r.json())
  .then(render) // เอาข้อมูลที่ได้ไปวาดลงหน้าจอ
  .catch((err) => console.error("initial room load failed:", err));

// 5.2 ตั้งค่า WebSockets (Socket.io) เพื่อรับการอัปเดตแบบ Real-time
const socket = io();

// เมื่อเชื่อมต่อ Socket สำเร็จ
socket.on("connect", () => {
  connStatusEl.classList.add("online");
  connStatusEl.innerHTML = `<span class="dot"></span> เชื่อมต่อสำเร็จ`;
});

// เมื่อเน็ตหลุด หรือเชื่อมต่อ Socket ไม่ได้
socket.on("disconnect", () => {
  connStatusEl.classList.remove("online");
  connStatusEl.innerHTML = `<span class="dot"></span> ขาดการเชื่อมต่อ`;
});

// เมื่อ Server ส่งข้อมูลใหม่มา (เช่น มีคนอื่นกดปิดไฟ หรือถึงเวลาปิดอัตโนมัติ) ให้วาดหน้าจอใหม่
socket.on("rooms_update", render);