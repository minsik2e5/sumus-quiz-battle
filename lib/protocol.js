'use strict';

const TEACHER_TYPES = new Set([
  'SERVER_REGISTER_BATTLE', 'SERVER_SAVE_TEACHER_STATE', 'BATTLE_STATE', 'BATTLE_NOT_FOUND',
  'PLAYER_JOIN_ACCEPTED', 'PLAYER_JOIN_REJECTED', 'PLAYER_CONNECTED', 'PLAYER_READY',
  'TRANSPORT_PONG', 'GAME_START', 'GAME_PAUSE', 'GAME_RESUME',
  'RAID_TIMING',
  'QUESTION_ASSIGN', 'ANSWER_RESULT', 'ANSWER_REJECTED', 'PLAYER_PROGRESS',
  'PLAYER_FINISHED', 'GAME_FINISH', 'PLAYER_KICKED', 'RETURN_TO_LOBBY',
  'SESSION_INVALID'
]);

const STUDENT_TYPES = new Set([
  'BATTLE_LOOKUP', 'PLAYER_JOIN_REQUEST', 'PLAYER_CHARACTER', 'PLAYER_READY',
  'ANSWER_SUBMIT', 'QUESTION_SHOWN', 'PLAYER_DISCONNECTED', 'TRANSPORT_PING',
  'PLAYER_RETURN_LOBBY', 'STUDENT_CLIENT_ACTION', 'RAID_LISTEN_READY'
]);

const CACHEABLE_TYPES = new Set([
  'BATTLE_STATE', 'GAME_START', 'GAME_PAUSE', 'GAME_RESUME',
  'PLAYER_PROGRESS', 'PLAYER_FINISHED', 'GAME_FINISH', 'RETURN_TO_LOBBY'
]);

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function validateMessage(role, message) {
  if (!isPlainObject(message) || typeof message.type !== 'string') return { ok: false, reason: 'invalid_envelope' };
  if (!/^[A-Z][A-Z_]{2,48}$/.test(message.type)) return { ok: false, reason: 'invalid_type' };
  const allowed = role === 'teacher' ? TEACHER_TYPES : STUDENT_TYPES;
  if (!allowed.has(message.type)) return { ok: false, reason: 'type_not_allowed' };
  if (message.payload != null && !isPlainObject(message.payload)) return { ok: false, reason: 'invalid_payload' };
  return { ok: true, payload: message.payload || {} };
}

function normalizeCode(value) {
  const code = String(value || '').trim();
  return /^\d{5}$/.test(code) ? code : '';
}

function normalizeId(value, max = 128) {
  const id = String(value || '').trim();
  return id && id.length <= max && /^[A-Za-z0-9._:-]+$/.test(id) ? id : '';
}

module.exports = { TEACHER_TYPES, STUDENT_TYPES, CACHEABLE_TYPES, isPlainObject, validateMessage, normalizeCode, normalizeId };
