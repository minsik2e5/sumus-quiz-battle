from __future__ import annotations

import io
import time
import asyncio
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.responses import RedirectResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
import qrcode

from pathlib import Path

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / "v072_public"

app = FastAPI(title="SUMUS QUIZ BATTLE V0.7.2 NETWORK HARDENING")

BUILD_ID = "V0.7.2.1-INTERNET"

@app.middleware("http")
async def force_no_cache(request, call_next):
    response = await call_next(request)
    response.headers["X-SUMUS-BUILD"] = BUILD_ID
    if request.url.path in {"/", "/index.html"} or request.url.path.endswith(".html"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

@app.get("/api/build")
async def build():
    return {"build": BUILD_ID, "ui": "CONFIRMED_INDIVIDUAL_RANGE_NUMBERS"}


class Hub:
    def __init__(self) -> None:
        self.sockets: dict[str, WebSocket] = {}
        self.meta: dict[str, dict[str, Any]] = {}

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()

    def code_conflict(self, client_id: str, role: str, battle_id: str, battle_code: str) -> bool:
        if role != "teacher" or not battle_code:
            return False
        for cid, meta in self.meta.items():
            if cid == client_id or meta.get("role") != "teacher":
                continue
            if meta.get("battleCode") == battle_code and meta.get("battleId") != battle_id:
                return True
        return False

    async def register(self, client_id: str, ws: WebSocket, payload: dict[str, Any]) -> dict[str, Any]:
        role = str(payload.get("role") or "unknown")
        battle_id = str(payload.get("battleId") or "")
        battle_code = str(payload.get("battleCode") or "")
        conflict = self.code_conflict(client_id, role, battle_id, battle_code)
        old = self.sockets.get(client_id)
        if old is not None and old is not ws:
            try:
                await old.close(code=4001)
            except Exception:
                pass
        self.sockets[client_id] = ws
        self.meta[client_id] = {
            "role": role,
            "battleId": battle_id,
            "battleCode": "" if conflict else battle_code,
            "playerId": payload.get("playerId") or "",
            "lastSeen": int(time.time() * 1000),
        }
        return {"codeConflict": conflict, "battleCode": battle_code}

    def update_from_message(self, client_id: str, message: dict[str, Any]) -> None:
        meta = self.meta.get(client_id)
        if not meta:
            return
        payload = message.get("payload") or {}
        battle_id = str(payload.get("battleId") or "")
        if battle_id and battle_id not in {"PRACTICE", "LAB"}:
            meta["battleId"] = battle_id
        if payload.get("playerId"):
            meta["playerId"] = payload.get("playerId")
        if payload.get("battleCode") and meta.get("role") == "teacher":
            code = str(payload.get("battleCode"))
            if not self.code_conflict(client_id, "teacher", meta.get("battleId") or "", code):
                meta["battleCode"] = code
        meta["lastSeen"] = int(time.time() * 1000)

    async def send(self, client_id: str, message: dict[str, Any]) -> bool:
        ws = self.sockets.get(client_id)
        if not ws:
            return False
        try:
            await ws.send_json(message)
            return True
        except Exception:
            await self.remove(client_id, ws)
            return False

    async def send_many(self, ids: list[str], message: dict[str, Any]) -> int:
        unique = list(dict.fromkeys(ids))
        if not unique:
            return 0
        results = await asyncio.gather(*(self.send(cid, message) for cid in unique), return_exceptions=True)
        return sum(r is True for r in results)

    async def remove(self, client_id: str, ws: WebSocket | None = None) -> bool:
        current = self.sockets.get(client_id)
        if ws is not None and current is not ws:
            return False
        self.sockets.pop(client_id, None)
        self.meta.pop(client_id, None)
        return True

    def teachers_for_code(self, code: str) -> list[str]:
        return [cid for cid, m in self.meta.items() if m.get("role") == "teacher" and m.get("battleCode") == code]

    def teachers_for_battle(self, battle_id: str) -> list[str]:
        return [cid for cid, m in self.meta.items() if m.get("role") == "teacher" and m.get("battleId") == battle_id]

    def students_for_battle(self, battle_id: str) -> list[str]:
        return [cid for cid, m in self.meta.items() if m.get("role") == "student" and m.get("battleId") == battle_id]

    def role_of(self, client_id: str) -> str:
        return str(self.meta.get(client_id, {}).get("role") or "unknown")

hub = Hub()

STUDENT_TO_TEACHER = {
    "PLAYER_JOIN_REQUEST", "PLAYER_CHARACTER", "PLAYER_READY", "ANSWER_SUBMIT",
    "QUESTION_SHOWN", "PLAYER_DISCONNECTED", "TRANSPORT_PING", "ANSWER_ACK",
}
TEACHER_TO_STUDENT = {
    "BATTLE_STATE", "PLAYER_JOIN_ACCEPTED", "PLAYER_JOIN_REJECTED", "PLAYER_CONNECTED",
    "TRANSPORT_PONG", "GAME_START", "QUESTION_ASSIGN", "ANSWER_RESULT", "PLAYER_PROGRESS",
    "PLAYER_FINISHED", "GAME_FINISH", "GAME_PAUSE", "GAME_RESUME", "REVIEW_DECISION", "BATTLE_NOT_FOUND",
}

@app.get("/")
async def root() -> RedirectResponse:
    return RedirectResponse("/index.html?build=V072")

@app.get("/api/health")
async def health() -> dict[str, Any]:
    return {
        "ok": True,
        "version": "0.7.2.1-internet",
        "connections": len(hub.sockets),
        "teachers": sum(1 for m in hub.meta.values() if m.get("role") == "teacher"),
        "students": sum(1 for m in hub.meta.values() if m.get("role") == "student"),
        "serverTime": int(time.time() * 1000),
    }

@app.get("/api/qr")
async def qr(data: str = Query(..., min_length=1, max_length=2048)) -> StreamingResponse:
    img = qrcode.make(data)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return StreamingResponse(buf, media_type="image/png", headers={"Cache-Control": "no-store"})

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    await hub.connect(ws)
    client_id = ""
    try:
        while True:
            message = await ws.receive_json()
            if not isinstance(message, dict):
                continue
            message_type = str(message.get("type") or "")
            if message_type == "SERVER_REGISTER":
                payload = message.get("payload") or {}
                client_id = str(payload.get("clientId") or message.get("senderId") or "")
                if not client_id:
                    await ws.send_json({"type": "SERVER_ERROR", "payload": {"message": "clientId required"}, "senderId": "server", "timestamp": int(time.time() * 1000)})
                    continue
                registration = await hub.register(client_id, ws, payload)
                if registration.get("codeConflict"):
                    await ws.send_json({"type": "SERVER_CODE_CONFLICT", "payload": {"code": registration.get("battleCode") or "", "serverTime": int(time.time() * 1000)}, "senderId": "server", "timestamp": int(time.time() * 1000)})
                else:
                    await ws.send_json({"type": "SERVER_STATUS", "payload": {"status": "live", "clientId": client_id, "serverTime": int(time.time() * 1000)}, "senderId": "server", "timestamp": int(time.time() * 1000)})
                continue

            if not client_id:
                client_id = str(message.get("senderId") or "")
                if client_id:
                    await hub.register(client_id, ws, {"role": "unknown"})
                else:
                    continue

            hub.update_from_message(client_id, message)
            payload = message.get("payload") or {}
            target = str(payload.get("targetClientId") or "")
            battle_id = str(payload.get("battleId") or hub.meta.get(client_id, {}).get("battleId") or "")

            if message_type == "BATTLE_LOOKUP":
                code = str(payload.get("code") or "")
                teachers = hub.teachers_for_code(code)
                if teachers:
                    await hub.send_many(teachers, message)
                else:
                    await hub.send(client_id, {"id": f"server-not-found-{int(time.time() * 1000)}", "type": "BATTLE_NOT_FOUND", "payload": {"code": code, "targetClientId": client_id, "timestamp": int(time.time() * 1000)}, "senderId": "server", "timestamp": int(time.time() * 1000)})
                continue

            sender_role = hub.role_of(client_id)
            if target:
                target_role = hub.role_of(target)
                allowed = ((sender_role == "teacher" and target_role == "student" and message_type in TEACHER_TO_STUDENT) or (sender_role == "student" and target_role == "teacher" and message_type in STUDENT_TO_TEACHER))
                if allowed:
                    await hub.send(target, message)
                continue
            if sender_role == "student":
                if message_type in STUDENT_TO_TEACHER:
                    await hub.send_many(hub.teachers_for_battle(battle_id), message)
                continue
            if sender_role == "teacher":
                if message_type in TEACHER_TO_STUDENT:
                    await hub.send_many(hub.students_for_battle(battle_id), message)
                continue

    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        if client_id:
            await hub.remove(client_id, ws)

app.mount("/", StaticFiles(directory=PUBLIC, html=True), name="public")
