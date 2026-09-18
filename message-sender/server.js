require('dotenv').config();
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const multer     = require('multer');
const path       = require('path');
const fs         = require('fs');
const axios      = require('axios');
const XLSX       = require('xlsx');
const { execSync } = require('child_process');

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  path: '/whatsapp/socket.io',
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());
app.use('/whatsapp', express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.redirect('/whatsapp/');
});

// ─── Upload dirs ──────────────────────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
const EXCEL_DIR  = path.join(__dirname, 'uploads');
[UPLOAD_DIR, EXCEL_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// ─── Multer: images ──────────────────────────────────────────────────────────
const imgStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename:    (req, file, cb) => cb(null, 'campaign_' + Date.now() + path.extname(file.originalname)),
});
const uploadImg = multer({ storage: imgStorage });

// ─── Multer: Excel ───────────────────────────────────────────────────────────
const xlStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, EXCEL_DIR),
  filename:    (req, file, cb) => cb(null, 'contacts_' + Date.now() + path.extname(file.originalname)),
});
const uploadXL = multer({ storage: xlStorage });

// ─── WhatsApp Client ──────────────────────────────────────────────────────────
const WIN_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const SESSION_DIR = path.join(__dirname, '.wwebjs_auth', 'session-bulk-sender');
const LOG_FILE = path.join(__dirname, 'whatsapp-sender.log');

let waClient = null;
let isReady = false;
let qrDataUrl = null;
let isInitializing = false;
let lastError = null;
let initPromise = null;

function logLine(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch (_) {}
}

function clearSessionLocks() {
  const lockNames = ['SingletonLock', 'SingletonSocket', 'SingletonCookie', 'lockfile'];
  const dirs = [SESSION_DIR, path.join(SESSION_DIR, 'Default')];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const name of lockNames) {
      try { fs.unlinkSync(path.join(dir, name)); } catch (_) {}
    }
  }
}

function killSessionChromeProcesses() {
  const marker = 'session-bulk-sender';
  try {
    if (process.platform === 'win32') {
      const cmd =
        "Get-CimInstance Win32_Process -Filter \"name = 'chrome.exe'\" | " +
        `Where-Object { $_.CommandLine -like '*${marker}*' } | ` +
        'ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }';
      execSync(`powershell -NoProfile -Command "${cmd}"`, { stdio: 'ignore', timeout: 15000 });
    } else {
      execSync(`pkill -f "${marker}" || true`, { stdio: 'ignore' });
    }
  } catch (err) {
    logLine(`kill chrome warning: ${err.message || err}`);
  }
}

function emitStatus(extra = {}) {
  const payload = {
    connected: isReady,
    qr: qrDataUrl,
    initializing: isInitializing,
    error: lastError,
    message: isReady
      ? 'WhatsApp Connected ✅'
      : (lastError
        ? lastError
        : (qrDataUrl ? 'Scan QR code with WhatsApp' : (isInitializing ? 'Starting WhatsApp browser…' : 'Initializing WhatsApp client...'))),
    ...extra,
  };
  io.emit('status', payload);
  if (qrDataUrl) io.emit('qr', qrDataUrl);
  io.emit('ready', isReady);
}

async function destroyWhatsAppClient() {
  if (waClient) {
    try {
      await waClient.destroy();
    } catch (err) {
      logLine(`destroy warning: ${err.message || err}`);
    }
    waClient = null;
  }
  isReady = false;
  qrDataUrl = null;
  killSessionChromeProcesses();
  clearSessionLocks();
}

async function initWhatsAppClient(force = false) {
  if (initPromise && !force) return initPromise;

  initPromise = (async () => {
    isInitializing = true;
    lastError = null;
    emitStatus();

    try {
      await destroyWhatsAppClient();
      if (force) {
        await new Promise((r) => setTimeout(r, 1500));
        clearSessionLocks();
      }

      const client = new Client({
        authStrategy: new LocalAuth({ clientId: 'bulk-sender', dataPath: path.join(__dirname, '.wwebjs_auth') }),
        authTimeoutMs: 120000,
        userAgent: WIN_UA,
        puppeteer: {
          headless: true,
          protocolTimeout: 300000,
          executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--disable-extensions',
            `--user-agent=${WIN_UA}`,
          ],
        },
      });

      client.on('qr', (qr) => {
        const QRCode = require('qrcode');
        lastError = null;
        QRCode.toDataURL(qr, (err, url) => {
          if (!err) {
            qrDataUrl = url;
            emitStatus();
          } else {
            lastError = `QR render failed: ${err.message}`;
            emitStatus();
          }
        });
        logLine('QR code generated');
      });

      client.on('authenticated', () => {
        lastError = null;
        emitStatus({ message: 'Authenticated! Loading...' });
      });

      client.on('ready', () => {
        isReady = true;
        isInitializing = false;
        lastError = null;
        qrDataUrl = null;
        logLine('WhatsApp ready');
        emitStatus();
      });

      client.on('disconnected', (reason) => {
        isReady = false;
        isInitializing = false;
        logLine(`disconnected: ${reason || 'unknown'}`);
        emitStatus({ message: 'Disconnected. Use Restart to reconnect.' });
      });

      client.on('auth_failure', (msg) => {
        isReady = false;
        isInitializing = false;
        lastError = `Auth failed: ${msg || 'please restart'}`;
        emitStatus();
      });

      waClient = client;
      await client.initialize();
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      lastError = msg;
      isInitializing = false;
      logLine(`init failed: ${msg}`);

      if (/already running/i.test(msg)) {
        killSessionChromeProcesses();
        clearSessionLocks();
        lastError = 'Browser session was stuck. Click Restart WhatsApp sender.';
      }
      emitStatus();
    } finally {
      if (!isReady && !qrDataUrl && !lastError) {
        isInitializing = false;
      }
      initPromise = null;
    }
  })();

  return initPromise;
}

process.on('unhandledRejection', (reason) => {
  const msg = reason && reason.message ? reason.message : String(reason);
  lastError = msg;
  isInitializing = false;
  logLine(`unhandled: ${msg}`);
  emitStatus();
});

// ─── Socket.io ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  socket.emit('status', {
    connected: isReady,
    qr: qrDataUrl,
    initializing: isInitializing,
    error: lastError,
    message: isReady
      ? 'WhatsApp Connected ✅'
      : (lastError || (qrDataUrl ? 'Scan QR code with WhatsApp' : 'Waiting for QR scan...')),
  });
  if (qrDataUrl) socket.emit('qr', qrDataUrl);
  socket.emit('ready', isReady);
});

// ─── Helper: download image from URL → MessageMedia ─────────────────────────
async function mediaFromUrl(url) {
  const res  = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'image/*,*/*',
    },
  });

  const contentType = res.headers['content-type'] || '';

  // Must be an image
  if (!contentType.includes('image')) {
    throw new Error(`URL did not return an image (got: ${contentType}). Use a direct image link.`);
  }

  const mime     = contentType.split(';')[0].trim();
  const ext      = mime.split('/')[1] || 'jpg';
  const b64      = Buffer.from(res.data).toString('base64');
  return new MessageMedia(mime, b64, 'image.' + ext);
}

// ─── API Router ──────────────────────────────────────────────────────────
const apiRouter = express.Router();
app.use('/whatsapp/api', apiRouter);
app.use('/api', apiRouter);

// ─── API: Upload image ────────────────────────────────────────────────────────
apiRouter.post('/upload', uploadImg.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ path: '/whatsapp/uploads/' + req.file.filename });
});

// ─── API: Parse Excel ─────────────────────────────────────────────────────────
apiRouter.post('/parse-excel', uploadXL.single('excel'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const wb      = XLSX.readFile(req.file.path);
    const ws      = wb.Sheets[wb.SheetNames[0]];
    const rows    = XLSX.utils.sheet_to_json(ws, { header: 1 });

    // First row = header, skip it
    const contacts = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const name     = String(row[0] || '').trim();
      const phone    = String(row[1] || '').trim().replace(/\D/g, '');
      const imageUrl = String(row[2] || '').trim();
      const caption  = String(row[3] || '').trim();
      if (phone) contacts.push({ name: name || 'Contact', phone, imageUrl, caption });
    }
    fs.unlinkSync(req.file.path); // cleanup
    res.json({ contacts });
  } catch (e) {
    res.status(500).json({ error: 'Failed to parse Excel: ' + e.message });
  }
});

// ─── API: Send messages ───────────────────────────────────────────────────────
apiRouter.post('/send', async (req, res) => {
  if (!isReady) return res.status(400).json({ error: 'WhatsApp not connected' });

  const { contacts, caption: globalCaption, imagePath: globalImagePath } = req.body;
  if (!contacts || contacts.length === 0)
    return res.status(400).json({ error: 'No contacts provided' });

  res.json({ started: true });

  (async () => {
    const report = { sent: [], failed: [] };

    // Pre-load global image if set
    let globalMedia = null;
    if (globalImagePath) {
      const full = path.join(__dirname, 'public', globalImagePath.replace('/whatsapp/uploads/', 'uploads/').replace('/uploads/', 'uploads/'));
      if (fs.existsSync(full)) globalMedia = MessageMedia.fromFilePath(full);
    }

    io.emit('send_start', { total: contacts.length });

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      io.emit('send_progress', { current: i + 1, total: contacts.length, name: contact.name, phone: contact.phone });

      try {
        const numberId = await waClient.getNumberId(contact.phone);
        if (!numberId) {
          report.failed.push({ ...contact, reason: 'Not on WhatsApp' });
          io.emit('send_item', { success: false, ...contact, reason: 'Not on WhatsApp' });
          continue;
        }
        const chatId = numberId._serialized;

        // Per-contact image URL overrides global image
        let media   = globalMedia;
        let caption = contact.caption || globalCaption || '';

        if (contact.imageUrl) {
          try {
            io.emit('send_item_log', { phone: contact.phone, msg: `⬇ Downloading: ${contact.imageUrl}` });
            media = await mediaFromUrl(contact.imageUrl);
            io.emit('send_item_log', { phone: contact.phone, msg: '✔ Image downloaded successfully' });
          } catch (e) {
            io.emit('send_item_log', { phone: contact.phone, msg: `⚠ Image failed: ${e.message}` });
            media = null;
          }
        }

        let sentMsg = null;
        if (media) {
          sentMsg = await waClient.sendMessage(chatId, media, { caption });
        } else if (caption) {
          sentMsg = await waClient.sendMessage(chatId, caption);
        } else {
          throw new Error('Nothing to send — no image and no caption');
        }

        // Confirm message was actually queued by WhatsApp
        if (!sentMsg || !sentMsg.id) {
          throw new Error('WhatsApp did not confirm the message — check your session');
        }

        io.emit('send_item_log', { phone: contact.phone, msg: `✔ WhatsApp confirmed send (id: ${sentMsg.id.id?.slice(-8)})` });
        report.sent.push(contact);
        io.emit('send_item', { success: true, ...contact });
      } catch (err) {
        report.failed.push({ ...contact, reason: err.message });
        io.emit('send_item', { success: false, ...contact, reason: err.message });
      }

      if (i < contacts.length - 1) await new Promise(r => setTimeout(r, 2000));
    }

    io.emit('send_done', report);
    fs.writeFileSync(
      path.join(__dirname, 'report.json'),
      JSON.stringify({ timestamp: new Date().toISOString(), ...report }, null, 2)
    );
  })();
});

// ─── API: WhatsApp Connection & PDF Send ───────────────────────────────────────
apiRouter.get('/status', (req, res) => {
  res.json({
    connected: isReady,
    qr: qrDataUrl,
    initializing: isInitializing,
    error: lastError,
    message: isReady
      ? 'WhatsApp Connected ✅'
      : (lastError
        ? lastError
        : (qrDataUrl ? 'Scan QR code with WhatsApp' : (isInitializing ? 'Starting WhatsApp browser…' : 'Initializing WhatsApp client...'))),
  });
});

apiRouter.post('/restart', async (req, res) => {
  try {
    await initWhatsAppClient(true);
    res.json({ success: true, message: 'WhatsApp client restarted' });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

apiRouter.post('/disconnect', async (req, res) => {
  try {
    if (waClient) {
      try {
        await waClient.logout();
      } catch (err) {
        logLine(`logout warning: ${err.message || err}`);
      }
    }
    await destroyWhatsAppClient();
    await initWhatsAppClient(true);
    res.json({ success: true, message: 'Disconnected and re-initialized client' });
  } catch (e) {
    logLine(`disconnect error: ${e.message || e}`);
    await destroyWhatsAppClient();
    await initWhatsAppClient(true);
    res.status(500).json({ error: 'Failed to disconnect: ' + e.message });
  }
});

apiRouter.post('/send-pdf', async (req, res) => {
  if (!isReady) {
    return res.status(400).json({ error: 'WhatsApp not connected' });
  }
  const { phone, pdfPath, caption } = req.body;
  if (!phone || !pdfPath) {
    return res.status(400).json({ error: 'Phone and pdfPath are required' });
  }
  try {
    const numberId = await waClient.getNumberId(phone);
    if (!numberId) {
      return res.status(400).json({ error: 'Number not on WhatsApp' });
    }
    const chatId = numberId._serialized;
    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({ error: 'PDF file not found at path: ' + pdfPath });
    }
    const media = MessageMedia.fromFilePath(pdfPath);
    await waClient.sendMessage(chatId, media, { caption });
    res.json({ success: true });
  } catch (e) {
    console.error('Send PDF error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ─── API: Contacts ────────────────────────────────────────────────────────────
apiRouter.get('/contacts', (req, res) => {
  const file = path.join(__dirname, 'contacts.json');
  res.json(fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : []);
});

apiRouter.post('/contacts', (req, res) => {
  fs.writeFileSync(path.join(__dirname, 'contacts.json'), JSON.stringify(req.body, null, 2));
  res.json({ saved: true });
});

// ─── API: Report ──────────────────────────────────────────────────────────────
apiRouter.get('/report', (req, res) => {
  const file = path.join(__dirname, 'report.json');
  res.json(fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : null);
});

// ─── API: Download template ───────────────────────────────────────────────────
apiRouter.get('/template', (req, res) => {
  res.download(path.join(__dirname, 'template.xlsx'), 'WA_Bulk_Template.xlsx');
});

// ─── Start ────────────────────────────────────────────────────────────────────
const HOST = process.env.WHATSAPP_INTERNAL_HOST || '127.0.0.1';
const PORT = Number(process.env.WHATSAPP_INTERNAL_PORT || 8787);
server.listen(PORT, HOST, () => {
  logLine(`WhatsApp sender listening on http://${HOST}:${PORT}`);
  void initWhatsAppClient();
});
