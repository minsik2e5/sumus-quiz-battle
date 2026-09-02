'use strict';

class RoomRegistry {
  constructor({ ttlMs = 6 * 60 * 60 * 1000, now = () => Date.now() } = {}) {
    this.ttlMs = ttlMs;
    this.now = now;
    this.rooms = new Map();
    this.roomIdByCode = new Map();
  }

  prune() {
    const cutoff = this.now() - this.ttlMs;
    for (const room of this.rooms.values()) {
      if (room.updatedAt < cutoff) this.delete(room.battleId);
    }
  }

  register({ battleId, code, teacherSocket, build = '', commit = '' }) {
    this.prune();
    const occupiedId = this.roomIdByCode.get(code);
    if (occupiedId && occupiedId !== battleId) {
      const occupied = this.rooms.get(occupiedId);
      if (occupied && occupied.teacherSocket && !occupied.teacherSocket.destroyed) {
        return { ok: false, reason: 'code_conflict', occupiedBattleId: occupiedId };
      }
      this.delete(occupiedId);
    }
    let room = this.rooms.get(battleId);
    if (!room) room = { battleId, code, teacherSocket: null, snapshot: null, teacherState: null, lastEvent: null, build: '', commit: '', createdAt: this.now(), updatedAt: this.now() };
    if (room.code && room.code !== code) this.roomIdByCode.delete(room.code);
    Object.assign(room, { code, teacherSocket, build: build || room.build, commit: commit || room.commit, updatedAt: this.now() });
    this.rooms.set(battleId, room);
    this.roomIdByCode.set(code, battleId);
    return { ok: true, room };
  }

  cache(battleId, type, message) {
    const room = this.rooms.get(battleId);
    if (!room) return null;
    room.updatedAt = this.now();
    room.lastEvent = { type, at: room.updatedAt };
    if (type === 'BATTLE_STATE') room.snapshot = JSON.parse(JSON.stringify(message));
    return room;
  }

  cacheTeacherState(battleId, state) {
    const room = this.rooms.get(battleId);
    if (!room) return null;
    room.teacherState = JSON.parse(JSON.stringify(state));
    room.updatedAt = this.now();
    room.lastEvent = { type: 'SERVER_SAVE_TEACHER_STATE', at: room.updatedAt };
    return room;
  }

  byCode(code) {
    this.prune();
    return this.rooms.get(this.roomIdByCode.get(code)) || null;
  }

  byId(battleId) {
    this.prune();
    return this.rooms.get(battleId) || null;
  }

  detachTeacher(socket) {
    for (const room of this.rooms.values()) {
      if (room.teacherSocket === socket) {
        room.teacherSocket = null;
        room.updatedAt = this.now();
      }
    }
  }

  delete(battleId) {
    const room = this.rooms.get(battleId);
    if (!room) return false;
    this.rooms.delete(battleId);
    if (this.roomIdByCode.get(room.code) === battleId) this.roomIdByCode.delete(room.code);
    return true;
  }

  summary() {
    this.prune();
    return [...this.rooms.values()].map(room => ({ battleId: room.battleId, code: room.code, teacherLive: !!(room.teacherSocket && !room.teacherSocket.destroyed), hasSnapshot: !!room.snapshot, hasTeacherState: !!room.teacherState, updatedAt: room.updatedAt }));
  }
}

module.exports = { RoomRegistry };
