const roomsListEl = document.getElementById("roomsList");
const connStatusEl = document.getElementById("connStatus");
const svg = document.getElementById("houseSvg");

let rooms = [];

function render(newRooms) {
  rooms = newRooms;

  // อัพเดตผังบ้าน (SVG)
  rooms.forEach((room) => {
    const g = svg.querySelector(`.room[data-room="${room.id}"]`);
    if (g) g.classList.toggle("on", room.light_on);
  });

  // อัพเดตการ์ดควบคุม
  roomsListEl.innerHTML = "";
  rooms.forEach((room) => {
    const card = document.createElement("div");
    card.className = "room-card";
    card.innerHTML = `
      <div>
        <div class="room-card__name">${room.name}</div>
        <div class="room-card__meta">${room.light_on ? "ไฟเปิดอยู่" : "ไฟปิดอยู่"} · ${room.auto_mode ? "อัตโนมัติ (PIR)" : "ควบคุมเอง"}</div>
      </div>
      <div class="room-card__controls">
        <button class="mode-btn ${room.auto_mode ? "auto" : ""}" data-action="mode" data-room="${room.id}">
          ${room.auto_mode ? "AUTO" : "MANUAL"}
        </button>
        <div class="toggle ${room.light_on ? "on" : ""}" data-action="toggle" data-room="${room.id}">
          <div class="toggle__knob"></div>
        </div>
      </div>
    `;
    roomsListEl.appendChild(card);
  });
}

async function toggleLight(roomId) {
  const room = rooms.find((r) => r.id === roomId);
  const nextOn = !(room && room.light_on);
  await fetch(`/api/rooms/${roomId}/light`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ on: nextOn }),
  });
}

async function toggleMode(roomId) {
  const room = rooms.find((r) => r.id === roomId);
  const nextAuto = !(room && room.auto_mode);
  await fetch(`/api/rooms/${roomId}/mode`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ auto: nextAuto }),
  });
}

// คลิกที่ห้องในผังบ้าน = สลับไฟ (manual override)
svg.addEventListener("click", (e) => {
  const g = e.target.closest(".room");
  if (g) toggleLight(g.dataset.room);
});

// คลิกที่การ์ดควบคุม
roomsListEl.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  if (el.dataset.action === "toggle") toggleLight(el.dataset.room);
  if (el.dataset.action === "mode") toggleMode(el.dataset.room);
});

// โหลดสถานะเริ่มต้น
fetch("/api/rooms")
  .then((r) => r.json())
  .then(render);

// เชื่อมต่อ realtime
const socket = io();
socket.on("connect", () => {
  connStatusEl.classList.add("online");
  connStatusEl.innerHTML = `<span class="dot"></span> เชื่อมต่อสำเร็จ`;
});
socket.on("disconnect", () => {
  connStatusEl.classList.remove("online");
  connStatusEl.innerHTML = `<span class="dot"></span> ขาดการเชื่อมต่อ`;
});
socket.on("rooms_update", render);
