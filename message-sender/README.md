# WhatsApp Bulk Sender

A WhatsApp Web automation tool to send bulk text messages and images to multiple contacts using [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js).

---

## Features

- Send bulk text messages with personalised name/group placeholders
- Send images with captions to all contacts
- Filter contacts by group (e.g. "vip", "customers")
- Configurable delay between messages to avoid bans
- Progress bar in terminal
- Auto-saves session (no QR re-scan after first login)
- Generates a `report.json` after every run

---

## Requirements

- [Node.js](https://nodejs.org/) v16 or higher
- A WhatsApp account on your phone

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Edit your contacts

Open `contacts.json` and add your recipients:

```json
[
  { "name": "Alice", "phone": "919876543210", "group": "customers" },
  { "name": "Bob",   "phone": "918765432109", "group": "vip" }
]
```

> Phone numbers must be in **international format without `+`**
> Example: India (+91) → `91` + 10-digit number = `919876543210`

### 3. Write your message

Edit `message.txt`. You can use these placeholders:

| Placeholder | Replaced with        |
|-------------|----------------------|
| `{{name}}`  | Contact's name       |
| `{{phone}}` | Contact's phone      |
| `{{group}}` | Contact's group      |

### 4. Add an image (optional)

Place your image file (jpg/png/gif/webp) in the project folder and set the path in `.env`:

```
IMAGE_PATH=./image.jpg
IMAGE_CAPTION=Check this out! 📸
```

### 5. Configure settings

Edit `.env` to adjust behaviour:

```env
DELAY_MS=6000        # ms between messages (recommended 5000-10000)
FILTER_GROUP=vip     # send only to contacts in "vip" group (leave empty for all)
```

---

## Run

```bash
npm start
```

On **first run** a QR code will appear in the terminal.

1. Open WhatsApp on your phone
2. Go to **More Options (⋮) → Linked Devices → Link a Device**
3. Scan the QR code

Your session is saved in `.wwebjs_auth/` — no need to scan again on future runs.

---

## Output

After sending, a `report.json` file is generated:

```json
{
  "timestamp": "2026-03-09T10:00:00.000Z",
  "totalContacts": 5,
  "sent": [
    { "name": "Alice", "phone": "919876543210" }
  ],
  "failed": [
    { "name": "Bob", "phone": "918765432109", "reason": "..." }
  ]
}
```

---

## Project Structure

```
whatsapp-bulk-sender/
├── index.js          ← Main automation script
├── contacts.json     ← List of recipients
├── message.txt       ← Message template
├── .env              ← Configuration
├── package.json
├── report.json       ← Generated after each run
└── .wwebjs_auth/     ← Saved WhatsApp session (auto-created)
```

---

## Important Notes

- **Do not spam** — Always respect WhatsApp's Terms of Service.
- Use a **minimum 5–6 second delay** between messages to avoid account bans.
- Only message people who have **consented** to receive your messages.
- For large-scale business messaging, use the official [WhatsApp Business API](https://business.whatsapp.com/products/business-platform).
