'use strict';

/**
 * Per-organization WhatsApp sessions (Baileys).
 * Each shop stores credentials in .baileys_auth/org-{id}/ and links its own number.
 */

const fs = require('fs');
const path = require('path');
const { WhatsAppClient } = require('./wa-client');

const AUTH_ROOT = path.join(__dirname, '.baileys_auth');
const LOG_FILE = path.join(__dirname, 'whatsapp-sender.log');

/** @type {Map<string, WhatsAppClient>} */
const sessions = new Map();

function logLine(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch (_) {}
}

function normalizeOrgId(organizationId) {
  if (organizationId == null || organizationId === '') return null;
  const id = String(organizationId).trim();
  if (!/^\d+$/.test(id)) return null;
  return id;
}

function authDirFor(orgId) {
  return path.join(AUTH_ROOT, `org-${orgId}`);
}

function getOrCreate(orgId) {
  if (!sessions.has(orgId)) {
    const client = new WhatsAppClient({
      orgId,
      authDir: authDirFor(orgId),
      log: (msg) => logLine(`org=${orgId} ${msg}`),
    });
    sessions.set(orgId, client);
  }
  return sessions.get(orgId);
}

function ensureStarted(orgId) {
  const client = getOrCreate(orgId);
  // A live socket or in-flight start already owns this shop. Do not call
  // start() again — the UI polls status every few seconds.
  if (!client.sock && !client.initializing && !client.startPromise) {
    void client.start();
  }
  return client;
}

function restoreSavedSessions() {
  if (!fs.existsSync(AUTH_ROOT)) return;
  for (const name of fs.readdirSync(AUTH_ROOT)) {
    const match = /^org-(\d+)$/.exec(name);
    if (!match) continue;
    logLine(`restoring saved WhatsApp session org=${match[1]}`);
    ensureStarted(match[1]);
  }
}

function getClient(orgId) {
  return sessions.get(orgId) || null;
}

function isReady(orgId) {
  const client = sessions.get(orgId);
  return !!(client && client.isReady());
}

function getStatus(orgId) {
  return ensureStarted(orgId).status();
}

async function restartSession(orgId) {
  const client = getOrCreate(orgId);
  await client.start({ resetAuth: false });
  return client.status();
}

async function disconnectSession(orgId) {
  const client = getOrCreate(orgId);
  await client.logout();
  return client.status();
}

module.exports = {
  AUTH_ROOT,
  normalizeOrgId,
  ensureStarted,
  restoreSavedSessions,
  getClient,
  isReady,
  getStatus,
  restartSession,
  disconnectSession,
  logLine,
};
