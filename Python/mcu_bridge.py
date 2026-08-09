"""
เลเยอร์เชื่อมต่อกับฝั่ง MCU (Sketch)

โหมดทำงาน 2 แบบ:
  - โหมดจริง (on_uno_q=True): เรียกผ่าน Arduino Bridge/Router RPC
    ให้แก้ใน _connect_real()/_call_real() ตามไวยากรณ์จริงที่ App Lab
    generate ให้ (เอกสาร: https://docs.arduino.cc/tutorials/uno-q/user-manual/)
  - โหมดจำลอง (ค่าเริ่มต้น): สุ่มสถานะ PIR ให้ dashboard ทดสอบ/เดโมได้
    บนคอมพิวเตอร์ทั่วไป โดยไม่ต้องมีบอร์ดจริง — เหมาะกับตอนเดโม/ส่งงาน
    ก่อนเชื่อมฮาร์ดแวร์จริง
"""
import os
import random
import time
import threading

from rooms_config import ROOMS

ON_UNO_Q = os.environ.get("SMARTHOME_ON_UNO_Q", "0") == "1"


class MCUBridge:
    def __init__(self):
        self._lock = threading.Lock()
        self._states = {
            r["id"]: {"light_on": False, "auto_mode": True}
            for r in ROOMS
        }
        self._real_bridge = None
        if ON_UNO_Q:
            self._connect_real()

    # ---------------- โหมดจริง (Arduino UNO Q) ----------------
    def _connect_real(self):
        # TODO: แทนที่ด้วย import/connect จริงตาม Bridge library ของ App Lab เช่น
        #   from arduino.app_bridge import Bridge
        #   self._real_bridge = Bridge()
        raise NotImplementedError(
            "เติมโค้ดเชื่อมต่อ Bridge จริงตรงนี้ตามตัวอย่างใน Arduino App Lab"
        )

    def _call_real(self, fn_name, *args):
        # TODO: self._real_bridge.call(fn_name, *args)
        raise NotImplementedError

    # ---------------- interface กลางที่ main.py เรียกใช้ ----------------
    def get_states(self):
        with self._lock:
            if ON_UNO_Q:
                raw = self._call_real("get_states")  # ปรับ parse ตามรูปแบบจริง
                return raw
            return {k: dict(v) for k, v in self._states.items()}

    def set_light(self, room_id, on: bool):
        with self._lock:
            if ON_UNO_Q:
                self._call_real("set_light", room_id, on)
            if room_id in self._states:
                self._states[room_id]["auto_mode"] = False
                self._states[room_id]["light_on"] = on

    def set_mode(self, room_id, auto_mode: bool):
        with self._lock:
            if ON_UNO_Q:
                self._call_real("set_mode", room_id, auto_mode)
            if room_id in self._states:
                self._states[room_id]["auto_mode"] = auto_mode

    def simulate_tick(self):
        """เรียกเป็นระยะในโหมดจำลอง เพื่อสุ่มการตรวจจับ PIR"""
        if ON_UNO_Q:
            return
        with self._lock:
            for room_id, state in self._states.items():
                if not state["auto_mode"]:
                    continue
                if random.random() < 0.05:  # ~5% โอกาสมีคนเดินผ่านต่อ tick
                    state["light_on"] = True
                elif random.random() < 0.03:
                    state["light_on"] = False
