require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');

const orgSessions = require('./orgSessions');

const app = express();
const server = http.createServer(app);

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Organization-Id');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '2mb' }));

function resolveOrgId(req) {
  return orgSessions.normalizeOrgId(
    (req.query && req.query.organizationId) ||
    (req.body && req.body.organizationId) ||
    (req.headers && req.headers['x-organization-id'])
  );
}

function requireOrgId(req, res) {
  const orgId = resolveOrgId(req);
  if (!orgId) {
    res.status(400).json({ error: 'organizationId is required' });
    return null;
  }
  return orgId;
}

const apiRouter = express.Router();
app.use('/whatsapp/api', apiRouter);
app.use('/api', apiRouter);

apiRouter.get('/status', (req, res) => {
  const orgId = requireOrgId(req, res);
  if (!orgId) return;
  res.json(orgSessions.getStatus(orgId));
});

apiRouter.post('/restart', async (req, res) => {
  const orgId = requireOrgId(req, res);
  if (!orgId) return;
  try {
    await orgSessions.restartSession(orgId);
    res.json({ success: true, message: 'WhatsApp client restarted', organizationId: orgId });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

apiRouter.post('/disconnect', async (req, res) => {
  const orgId = requireOrgId(req, res);
  if (!orgId) return;
  try {
    await orgSessions.disconnectSession(orgId);
    res.json({ success: true, message: 'Disconnected and re-initialized client', organizationId: orgId });
  } catch (e) {
    orgSessions.logLine(`disconnect error org=${orgId}: ${e.message || e}`);
    res.status(500).json({ error: 'Failed to disconnect: ' + e.message });
  }
});

apiRouter.post('/send-pdf', async (req, res) => {
  const orgId = requireOrgId(req, res);
  if (!orgId) return;
  orgSessions.ensureStarted(orgId);
  if (!orgSessions.isReady(orgId)) {
    return res.status(503).json({ error: 'WhatsApp not connected for this shop' });
  }
  const { phone, pdfPath, caption } = req.body || {};
  if (!phone || !pdfPath) {
    return res.status(400).json({ error: 'Phone and pdfPath are required' });
  }
  const resolvedPath = path.resolve(pdfPath);
  if (!fs.existsSync(resolvedPath)) {
    return res.status(404).json({ error: 'PDF file not found at path: ' + resolvedPath });
  }

  try {
    const client = orgSessions.getClient(orgId);
    orgSessions.logLine(`send-pdf org=${orgId} phone=${String(phone).replace(/\D/g, '')}`);
    const sent = await client.sendDocument(phone, resolvedPath, caption);
    orgSessions.logLine(`send-pdf: delivered org=${orgId} to ${sent.jid} (id: ${sent.messageId})`);
    return res.json({ success: true, organizationId: orgId, chatId: sent.jid, messageId: sent.messageId });
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    orgSessions.logLine(`send-pdf failed org=${orgId} for ${phone}: ${msg}`);
    const code = e.code === 'NOT_ON_WHATSAPP' ? 400 : 500;
    res.status(code).json({ error: msg });
  }
});

apiRouter.post('/send', async (req, res) => {
  const orgId = requireOrgId(req, res);
  if (!orgId) return;
  orgSessions.ensureStarted(orgId);
  if (!orgSessions.isReady(orgId)) {
    return res.status(400).json({ error: 'WhatsApp not connected for this shop' });
  }
  const contacts = (req.body && req.body.contacts) || [];
  if (!contacts.length) {
    return res.status(400).json({ error: 'No contacts provided' });
  }

  const client = orgSessions.getClient(orgId);
  const report = { sent: [], failed: [] };
  for (const contact of contacts) {
    try {
      const caption = contact.caption || (req.body && req.body.caption) || '';
      await client.sendText(contact.phone, caption);
      report.sent.push(contact);
    } catch (err) {
      report.failed.push({ ...contact, reason: err.message });
    }
  }
  res.json({ success: report.failed.length === 0, organizationId: orgId, ...report });
});

const HOST = process.env.WHATSAPP_INTERNAL_HOST || process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.WHATSAPP_INTERNAL_PORT || process.env.PORT || 8787);
const SPAWN_LOCK = path.join(__dirname, '.gateway-spawn.lock');

function releaseSpawnLock() {
  try {
    if (fs.existsSync(SPAWN_LOCK)) fs.unlinkSync(SPAWN_LOCK);
  } catch (err) {
    /* nothing useful to do if the lock cannot be removed */
  }
}

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    orgSessions.logLine(`Port ${PORT} already in use — another sender is running. Exiting.`);
    process.exit(0);
  }
  orgSessions.logLine(`server error: ${(err && err.message) || err}`);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  releaseSpawnLock();
  orgSessions.logLine(`WhatsApp sender listening on http://${HOST}:${PORT} (per-org Baileys sessions)`);
  orgSessions.restoreSavedSessions();
});

process.on('unhandledRejection', (reason) => {
  orgSessions.logLine(`unhandled: ${(reason && reason.message) || String(reason)}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    releaseSpawnLock();
    process.exit(0);
  });
}
