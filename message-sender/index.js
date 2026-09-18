require('dotenv').config();
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const chalk = require('chalk');
const cliProgress = require('cli-progress');
const fs = require('fs');
const path = require('path');

// ─── Config ──────────────────────────────────────────────────────────────────
const CONTACTS_FILE   = process.env.CONTACTS_FILE  || './contacts.json';
const MESSAGE_FILE    = process.env.MESSAGE_FILE   || './message.txt';
const IMAGE_PATH      = process.env.IMAGE_PATH     || null;   // e.g. './image.jpg'
const IMAGE_CAPTION   = process.env.IMAGE_CAPTION  || 'Check this out! 📸';
const DELAY_MS        = parseInt(process.env.DELAY_MS) || 6000; // ms between sends
const FILTER_GROUP    = process.env.FILTER_GROUP   || null;   // send only to this group

// ─── Load files ──────────────────────────────────────────────────────────────
function loadContacts() {
  if (!fs.existsSync(CONTACTS_FILE)) {
    console.error(chalk.red(`✘ contacts file not found: ${CONTACTS_FILE}`));
    process.exit(1);
  }
  let contacts = JSON.parse(fs.readFileSync(CONTACTS_FILE, 'utf-8'));
  if (FILTER_GROUP) {
    contacts = contacts.filter(c => c.group === FILTER_GROUP);
    console.log(chalk.cyan(`ℹ Filtering contacts by group: "${FILTER_GROUP}" → ${contacts.length} contacts`));
  }
  return contacts;
}

function loadMessage() {
  if (!fs.existsSync(MESSAGE_FILE)) {
    console.error(chalk.red(`✘ message file not found: ${MESSAGE_FILE}`));
    process.exit(1);
  }
  return fs.readFileSync(MESSAGE_FILE, 'utf-8').trim();
}

function loadMedia() {
  if (!IMAGE_PATH) return null;
  const resolved = path.resolve(IMAGE_PATH);
  if (!fs.existsSync(resolved)) {
    console.warn(chalk.yellow(`⚠ Image not found at ${resolved} — skipping image send.`));
    return null;
  }
  return MessageMedia.fromFilePath(resolved);
}

function personalise(template, contact) {
  return template
    .replace(/{{name}}/g,  contact.name  || '')
    .replace(/{{phone}}/g, contact.phone || '')
    .replace(/{{group}}/g, contact.group || '');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Report ──────────────────────────────────────────────────────────────────
const report = { sent: [], failed: [] };

function printReport() {
  console.log('\n' + chalk.bold('─── Final Report ───────────────────────────────────'));
  console.log(chalk.green(`✔ Sent successfully : ${report.sent.length}`));
  if (report.sent.length) {
    report.sent.forEach(c => console.log(chalk.green(`   • ${c.name} (${c.phone})`)));
  }
  console.log(chalk.red(`✘ Failed            : ${report.failed.length}`));
  if (report.failed.length) {
    report.failed.forEach(c => console.log(chalk.red(`   • ${c.name} (${c.phone}) — ${c.reason}`)));
  }
  console.log(chalk.bold('────────────────────────────────────────────────────\n'));

  // Save report to file
  const reportData = {
    timestamp: new Date().toISOString(),
    totalContacts: report.sent.length + report.failed.length,
    sent: report.sent,
    failed: report.failed,
  };
  fs.writeFileSync('./report.json', JSON.stringify(reportData, null, 2));
  console.log(chalk.cyan('ℹ Report saved to report.json'));
}

// ─── Main sender ─────────────────────────────────────────────────────────────
async function sendBulkMessages(client) {
  const contacts     = loadContacts();
  const msgTemplate  = loadMessage();
  const media        = loadMedia();

  if (contacts.length === 0) {
    console.log(chalk.yellow('⚠ No contacts found. Exiting.'));
    await client.destroy();
    return;
  }

  console.log(chalk.bold(`\n📤 Starting bulk send to ${contacts.length} contact(s)...\n`));

  const bar = new cliProgress.SingleBar({
    format: chalk.cyan('{bar}') + ' {percentage}% | {value}/{total} contacts | ETA: {eta}s',
    barCompleteChar: '█',
    barIncompleteChar: '░',
    hideCursor: true,
  });
  bar.start(contacts.length, 0);

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    const message = personalise(msgTemplate, contact);

    try {
      // Check if number is registered on WhatsApp (works for unsaved numbers too)
      const numberId = await client.getNumberId(contact.phone);

      if (!numberId) {
        console.log(chalk.yellow(`\n⚠ ${contact.phone} is not on WhatsApp — skipping.`));
        report.failed.push({ name: contact.name, phone: contact.phone, reason: 'Not registered on WhatsApp' });
        bar.update(i + 1);
        continue;
      }

      const chatId = numberId._serialized; // guaranteed valid chat ID

      // Send image with caption only (no separate text message)
      if (media) {
        await client.sendMessage(chatId, media, { caption: IMAGE_CAPTION });
      } else {
        await client.sendMessage(chatId, message);
      }

      report.sent.push({ name: contact.name, phone: contact.phone });
    } catch (err) {
      report.failed.push({ name: contact.name, phone: contact.phone, reason: err.message });
    }

    bar.update(i + 1);

    // Delay between contacts (skip after last one)
    if (i < contacts.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  bar.stop();
  printReport();
  await client.destroy();
}

// ─── Global unhandled rejection guard ───────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  if (reason && reason.toString().includes('auth timeout')) {
    console.error(chalk.red('\n✘ QR code was not scanned in time. Please run again and scan quickly.\n'));
  } else {
    console.error(chalk.red('\n✘ Unhandled error:'), reason);
  }
  process.exit(1);
});

// ─── WhatsApp client setup ───────────────────────────────────────────────────
const WIN_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'bulk-sender' }),
  authTimeoutMs: 120000,
  userAgent: WIN_USER_AGENT,
  puppeteer: {
    headless: true,
    protocolTimeout: 120000,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-sync',
      '--metrics-recording-only',
      '--no-default-browser-check',
      `--user-agent=${WIN_USER_AGENT}`,
    ],
  },
});

client.on('qr', (qr) => {
  console.clear();
  console.log(chalk.bold.green('╔══════════════════════════════════════╗'));
  console.log(chalk.bold.green('║   WhatsApp Bulk Sender — Login       ║'));
  console.log(chalk.bold.green('╚══════════════════════════════════════╝'));
  console.log(chalk.yellow('\n📱 Scan the QR code below with WhatsApp:\n'));
  qrcode.generate(qr, { small: true });
  console.log(chalk.grey('\nOpen WhatsApp → More Options (⋮) → Linked Devices → Link a Device\n'));
});

client.on('authenticated', () => {
  console.log(chalk.green('\n✔ Authenticated! Loading chats...'));
});

client.on('auth_failure', (msg) => {
  if (msg && msg.toString().includes('timeout')) {
    console.error(chalk.red('\n✘ QR code scan timed out. Please run again and scan the QR within 2 minutes.\n'));
  } else {
    console.error(chalk.red('\n✘ Authentication failed:', msg));
  }
  process.exit(1);
});

client.on('ready', async () => {
  console.log(chalk.bold.green('\n✅ WhatsApp client is ready!\n'));
  await sendBulkMessages(client);
});

client.on('disconnected', (reason) => {
  console.log(chalk.yellow(`\n⚠ Client disconnected: ${reason}`));
});

// ─── Boot ────────────────────────────────────────────────────────────────────
console.log(chalk.bold('\n🚀 Initialising WhatsApp Bulk Sender...'));
console.log(chalk.grey('   Session is saved — no re-scan needed after first login.\n'));
client.initialize();
