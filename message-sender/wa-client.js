'use strict';

/**
 * WhatsApp transport built on Baileys.
 *
 * Baileys speaks the WhatsApp multi-device protocol directly instead of driving
 * a headless browser, so it does not break when WhatsApp Web ships a new build
 * — which is what stopped the previous whatsapp-web.js sender from delivering.
 */

const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const pino = require('pino');
const {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  DisconnectReason,
  Browsers,
} = require('@whiskeysockets/baileys');

const AUTH_DIR = path.join(__dirname, '.baileys_auth');
const MAX_RECONNECT_DELAY_MS = 30000;

class WhatsAppClient {
  constructor({ log } = {}) {
    this.log = log || (() => {});
    this.logger = pino({ level: 'silent' });

    this.sock = null;
    this.connected = false;
    this.qrDataUrl = null;
    this.initializing = false;
    this.lastError = null;

    this.onUpdate = () => {};
    this.startPromise = null;
    this.reconnectAttempts = 0;
    this.stopped = false;
  }

  status() {
    let message;
    if (this.connected) {
      message = 'WhatsApp Connected ✅';
    } else if (this.qrDataUrl) {
      message = 'Scan QR code with WhatsApp';
    } else if (this.lastError) {
      message = this.lastError;
    } else if (this.initializing) {
      message = 'Connecting to WhatsApp…';
    } else {
      message = 'Initializing WhatsApp client...';
    }
    return {
      connected: this.connected,
      qr: this.qrDataUrl,
      initializing: this.initializing,
      error: this.lastError,
      message,
    };
  }

  isReady() {
    return this.connected && !!this.sock;
  }

  emit() {
    try {
      this.onUpdate(this.status());
    } catch (err) {
      this.log(`status listener error: ${err.message || err}`);
    }
  }

  start({ resetAuth = false } = {}) {
    if (this.startPromise) return this.startPromise;
    this.stopped = false;
    this.startPromise = this._start({ resetAuth })
      .catch((err) => {
        this.lastError = err && err.message ? err.message : String(err);
        this.initializing = false;
        this.log(`start failed: ${this.lastError}`);
        this.emit();
      })
      .finally(() => {
        this.startPromise = null;
      });
    return this.startPromise;
  }

  async _start({ resetAuth }) {
    this.initializing = true;
    this.lastError = null;
    this.emit();

    await this._closeSocket();
    if (resetAuth) this._wipeAuth();

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();
    this.log(`starting Baileys against WhatsApp protocol v${version.join('.')}`);

    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, this.logger),
      },
      logger: this.logger,
      browser: Browsers.ubuntu('Chrome'),
      syncFullHistory: false,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
    });

    this.sock = sock;
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (update) => {
      void this._onConnectionUpdate(update);
    });
  }

  async _onConnectionUpdate({ connection, lastDisconnect, qr }) {
    if (qr) {
      try {
        this.qrDataUrl = await QRCode.toDataURL(qr);
      } catch (err) {
        this.lastError = `QR render failed: ${err.message}`;
      }
      this.connected = false;
      this.initializing = false;
      this.log('QR code generated — scan it to link the device');
      this.emit();
    }

    if (connection === 'open') {
      this.connected = true;
      this.initializing = false;
      this.qrDataUrl = null;
      this.lastError = null;
      this.reconnectAttempts = 0;
      this.log(`WhatsApp connected as ${(this.sock && this.sock.user && this.sock.user.id) || 'unknown'}`);
      this.emit();
    }

    if (connection === 'close') {
      this.connected = false;
      const statusCode = lastDisconnect
        && lastDisconnect.error
        && lastDisconnect.error.output
        && lastDisconnect.error.output.statusCode;
      this.log(`connection closed (code ${statusCode === undefined ? 'none' : statusCode})`);

      if (this.stopped) return;

      if (statusCode === DisconnectReason.loggedOut) {
        // The session is dead; only a fresh QR scan can restore it.
        this.lastError = 'WhatsApp session was logged out. Scan the QR code again.';
        this.qrDataUrl = null;
        this.emit();
        await this.start({ resetAuth: true });
        return;
      }

      const delay = Math.min(
        MAX_RECONNECT_DELAY_MS,
        2000 * 2 ** this.reconnectAttempts,
      );
      this.reconnectAttempts += 1;
      this.initializing = true;
      this.emit();
      setTimeout(() => {
        if (!this.stopped) void this.start();
      }, delay);
    }
  }

  async _closeSocket() {
    if (!this.sock) return;
    const sock = this.sock;
    this.sock = null;
    try {
      sock.ev.removeAllListeners('connection.update');
      sock.ev.removeAllListeners('creds.update');
      sock.end(undefined);
    } catch (err) {
      this.log(`socket close warning: ${err.message || err}`);
    }
  }

  _wipeAuth() {
    try {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      this.log('cleared stored credentials — a new QR scan is required');
    } catch (err) {
      this.log(`could not clear credentials: ${err.message || err}`);
    }
  }

  _assertReady() {
    if (!this.isReady()) {
      const err = new Error('WhatsApp is not connected');
      err.code = 'NOT_CONNECTED';
      throw err;
    }
  }

  /** Resolve a phone number to the JID WhatsApp will accept, or null. */
  async resolveJid(phone) {
    this._assertReady();
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return null;

    const results = await this.sock.onWhatsApp(digits);
    const hit = Array.isArray(results) ? results[0] : null;
    if (!hit || hit.exists === false) return null;
    return hit.jid || `${digits}@s.whatsapp.net`;
  }

  async _send(jid, content) {
    const sent = await this.sock.sendMessage(jid, content);
    if (!sent || !sent.key || !sent.key.id) {
      throw new Error('WhatsApp did not acknowledge the message');
    }
    return { jid, messageId: sent.key.id };
  }

  async sendDocument(phone, filePath, caption) {
    this._assertReady();
    const jid = await this.resolveJid(phone);
    if (!jid) {
      const err = new Error('Number not on WhatsApp');
      err.code = 'NOT_ON_WHATSAPP';
      throw err;
    }
    return this._send(jid, {
      document: fs.readFileSync(filePath),
      mimetype: 'application/pdf',
      fileName: path.basename(filePath),
      caption: caption || undefined,
    });
  }

  /** Log out of WhatsApp and come back up on a fresh QR. */
  async logout() {
    try {
      if (this.sock) await this.sock.logout();
    } catch (err) {
      this.log(`logout warning: ${err.message || err}`);
    }
    await this._closeSocket();
    this._wipeAuth();
    this.connected = false;
    this.qrDataUrl = null;
    this.lastError = null;
    this.emit();
    await this.start();
  }
}

module.exports = { WhatsAppClient, AUTH_DIR };
