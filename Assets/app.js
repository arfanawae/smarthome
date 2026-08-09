const roomsListEl = document.getElementById("roomsList");
const connStatusEl = document.getElementById("connStatus");
const houseViewEl = document.getElementById("houseView");

let rooms = [];

const badgeMap = {
  living_room: ".badge-living",
  kitchen: ".badge-kitchen",
  bathroom: ".badge-bathroom",
  storage: ".badge-storage",
  bedroom: ".badge-bedroom",
  bedroom2: ".badge-bedroom2",
  garage: ".badge-garage",
};

function render(newRooms) {
  rooms = newRooms;

  rooms.forEach((room) => {
    const zone = houseViewEl.querySelector(`.room-zone[data-room="${room.id}"]`);
    const badge = houseViewEl.querySelector(badgeMap[room.id]);

    if (zone) zone.classList.toggle("on", !!room.light_on);
    if (badge) badge.classList.toggle("on", !!room.light_on);

    const lightLayer = houseViewEl.querySelector(
      `.room-light[data-light-room="${room.id}"]`
    );
    if (lightLayer) lightLayer.classList.toggle("on", !!room.light_on);
  });

  roomsListEl.innerHTML = "";

  rooms.forEach((room) => {
    const card = document.createElement("div");
    card.className = "room-card";
    card.innerHTML = `
      <div>
        <div class="room-card__name">${room.name}</div>
        <div class="room-card__meta">
          ${room.light_on ? "ไฟเปิดอยู่" : "ไฟปิดอยู่"} ·
          ${room.auto_mode ? "อัตโนมัติ (PIR)" : "ควบคุมเอง"}
        </div>
      </div>
      <div class="room-card__controls">
        <button class="mode-btn ${room.auto_mode ? "auto" : ""}"
                data-action="mode" data-room="${room.id}">
          ${room.auto_mode ? "AUTO" : "MANUAL"}
        </button>
        <div class="toggle ${room.light_on ? "on" : ""}"
             data-action="toggle" data-room="${room.id}">
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

  try {
    await fetch(`/api/rooms/${roomId}/light`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ on: nextOn }),
    });
  } catch (err) {
    console.error("toggleLight failed:", err);
  }
}

async function toggleMode(roomId) {
  const room = rooms.find((r) => r.id === roomId);
  const nextAuto = !(room && room.auto_mode);

  try {
    await fetch(`/api/rooms/${roomId}/mode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auto: nextAuto }),
    });
  } catch (err) {
    console.error("toggleMode failed:", err);
  }
}

// คลิกพื้นที่ห้องบนภาพ = สลับไฟ
houseViewEl.addEventListener("click", (e) => {
  const zone = e.target.closest(".room-zone");
  if (zone) toggleLight(zone.dataset.room);
});

// คลิกการ์ดควบคุม
roomsListEl.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;

  if (el.dataset.action === "toggle") toggleLight(el.dataset.room);
  if (el.dataset.action === "mode") toggleMode(el.dataset.room);
});

// โหลดสถานะเริ่มต้น
fetch("/api/rooms")
  .then((r) => r.json())
  .then(render)
  .catch((err) => console.error("initial room load failed:", err));

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
