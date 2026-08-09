"""
SmartHome Auto Light — ฝั่ง Python (Linux/MPU)

รัน:
    pip install -r requirements.txt
    python main.py

แล้วเปิด http://<uno-q-ip>:5000 จากมือถือหรือคอมพิวเตอร์เครื่องไหนก็ได้
ในวง WiFi เดียวกัน (ไม่ต้องติดตั้งแอพเพิ่ม เพราะเป็นเว็บแอพ responsive)
"""
import threading
import time

from flask import Flask, jsonify, request, send_from_directory
from flask_socketio import SocketIO

from rooms_config import ROOMS
from mcu_bridge import MCUBridge

app = Flask(__name__, static_folder="../Assets", static_url_path="")
socketio = SocketIO(app, cors_allowed_origins="*")
bridge = MCUBridge()

ROOM_NAMES = {r["id"]: r["name"] for r in ROOMS}


def current_snapshot():
    states = bridge.get_states()
    return [
        {
            "id": room_id,
            "name": ROOM_NAMES.get(room_id, room_id),
            "light_on": s["light_on"],
            "auto_mode": s["auto_mode"],
        }
        for room_id, s in states.items()
    ]


@app.route("/")
def dashboard():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/api/rooms", methods=["GET"])
def api_get_rooms():
    return jsonify(current_snapshot())


@app.route("/api/rooms/<room_id>/light", methods=["POST"])
def api_set_light(room_id):
    on = bool(request.json.get("on"))
    bridge.set_light(room_id, on)
    socketio.emit("rooms_update", current_snapshot())
    return jsonify({"ok": True})


@app.route("/api/rooms/<room_id>/mode", methods=["POST"])
def api_set_mode(room_id):
    auto_mode = bool(request.json.get("auto"))
    bridge.set_mode(room_id, auto_mode)
    socketio.emit("rooms_update", current_snapshot())
    return jsonify({"ok": True})


def poll_loop():
    """อ่านสถานะจาก MCU เป็นระยะ แล้ว broadcast ไปทุก dashboard ที่เปิดอยู่"""
    last_snapshot = None
    while True:
        bridge.simulate_tick()  # no-op เมื่อรันจริงบน UNO Q
        snapshot = current_snapshot()
        if snapshot != last_snapshot:
            socketio.emit("rooms_update", snapshot)
            last_snapshot = snapshot
        time.sleep(0.5)


if __name__ == "__main__":
    threading.Thread(target=poll_loop, daemon=True).start()
    socketio.run(app, host="0.0.0.0", port=5000, allow_unsafe_werkzeug=True)
