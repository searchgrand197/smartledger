require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');

const { WhatsAppClient } = require('./wa-client');

const app = express();
const server = http.createServer(app);

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

const LOG_FILE = path.join(__dirname, 'whatsapp-sender.log');

function logLine(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch (_) {}
}

const whatsapp = new WhatsAppClient({ log: logLine });

const apiRouter = express.Router();
// Ledger talks to /api/* locally. Docker compose still uses /whatsapp/api/*.
app.use('/whatsapp/api', apiRouter);
app.use('/api', apiRouter);

apiRouter.get('/status', (req, res) => {
  res.json(whatsapp.status());
});

apiRouter.post('/restart', async (req, res) => {
  try {
    await whatsapp.start({ resetAuth: false });
    res.json({ success: true, message: 'WhatsApp client restarted' });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

apiRouter.post('/disconnect', async (req, res) => {
  try {
    await whatsapp.logout();
    res.json({ success: true, message: 'Disconnected and re-initialized client' });
  } catch (e) {
    logLine(`disconnect error: ${e.message || e}`);
    res.status(500).json({ error: 'Failed to disconnect: ' + e.message });
  }
});

apiRouter.post('/send-pdf', async (req, res) => {
  if (!whatsapp.isReady()) {
    return res.status(503).json({ error: 'WhatsApp not connected' });
  }
  const { phone, pdfPath, caption } = req.body;
  if (!phone || !pdfPath) {
    return res.status(400).json({ error: 'Phone and pdfPath are required' });
  }
  if (!fs.existsSync(pdfPath)) {
    return res.status(404).json({ error: 'PDF file not found at path: ' + pdfPath });
  }

  try {
    const sent = await whatsapp.sendDocument(phone, pdfPath, caption);
    logLine(`send-pdf: delivered to ${sent.jid} (id: ${sent.messageId})`);
    return res.json({ success: true, chatId: sent.jid, messageId: sent.messageId });
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    logLine(`send-pdf failed for ${phone}: ${msg}`);
    const code = e.code === 'NOT_ON_WHATSAPP' ? 400 : 500;
    res.status(code).json({ error: msg });
  }
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
    logLine(`Port ${PORT} already in use — another sender is running. Exiting.`);
    process.exit(0);
  }
  logLine(`server error: ${(err && err.message) || err}`);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  releaseSpawnLock();
  logLine(`WhatsApp sender listening on http://${HOST}:${PORT}`);
  void whatsapp.start();
});

process.on('unhandledRejection', (reason) => {
  logLine(`unhandled: ${(reason && reason.message) || String(reason)}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    releaseSpawnLock();
    process.exit(0);
  });
}
