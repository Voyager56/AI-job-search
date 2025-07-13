# Gmail Setup Guide for Job Application Bot

## Option 1: Gmail App Password (Recommended - Easiest)

### Prerequisites:
1. You MUST have 2-Factor Authentication (2FA) enabled on your Google account
2. If you don't have 2FA enabled, you cannot use app passwords

### Steps to Enable 2FA and Generate App Password:

1. **Enable 2-Factor Authentication:**
   - Go to https://myaccount.google.com/security
   - Click on "2-Step Verification" 
   - Follow the setup process (add phone number, etc.)

2. **Generate App Password:**
   - After 2FA is enabled, go to https://myaccount.google.com/apppasswords
   - Or go to Google Account → Security → 2-Step Verification → App passwords (at the bottom)
   - Select app: "Mail"
   - Select device: "Other (Custom name)" → Type "Job Application Bot"
   - Click "Generate"
   - Copy the 16-character password (looks like: "abcd efgh ijkl mnop")

3. **Update .env file:**
   ```
   GMAIL_USER=your-email@gmail.com
   GMAIL_APP_PASSWORD=abcdefghijklmnop  # Remove spaces from the app password
   ```

## Option 2: OAuth2 with Gmail API (More Complex but More Secure)

If you can't use app passwords, we can implement OAuth2:

### Steps:

1. **Create a Google Cloud Project:**
   - Go to https://console.cloud.google.com/
   - Create a new project or select existing
   - Enable Gmail API for the project

2. **Create OAuth2 Credentials:**
   - Go to APIs & Services → Credentials
   - Create Credentials → OAuth client ID
   - Application type: "Desktop app"
   - Download the credentials JSON

3. **Install additional dependencies:**
   ```bash
   npm install @google-cloud/local-auth googleapis
   ```

4. **Update email service to use OAuth2** (see implementation below)

## Option 3: Use a Different Email Service

### SendGrid (Free tier: 100 emails/day)
```bash
npm install @sendgrid/mail
```

### Mailgun (Free tier: 5,000 emails/month)
```bash
npm install mailgun-js
```

### Local SMTP (For Testing Only)
```bash
npm install -g maildev
maildev  # Runs on http://localhost:1080
```

## OAuth2 Implementation for Gmail API

If you need OAuth2, here's the implementation:

```javascript
// src/services/gmail-oauth.service.js
const { google } = require('googleapis');
const { authenticate } = require('@google-cloud/local-auth');
const path = require('path');
const fs = require('fs').promises;

class GmailOAuthService {
  constructor() {
    this.SCOPES = ['https://www.googleapis.com/auth/gmail.send'];
    this.TOKEN_PATH = path.join(process.cwd(), 'token.json');
    this.CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');
  }

  async loadSavedCredentialsIfExist() {
    try {
      const content = await fs.readFile(this.TOKEN_PATH);
      const credentials = JSON.parse(content);
      return google.auth.fromJSON(credentials);
    } catch (err) {
      return null;
    }
  }

  async saveCredentials(client) {
    const content = await fs.readFile(this.CREDENTIALS_PATH);
    const keys = JSON.parse(content);
    const key = keys.installed || keys.web;
    const payload = JSON.stringify({
      type: 'authorized_user',
      client_id: key.client_id,
      client_secret: key.client_secret,
      refresh_token: client.credentials.refresh_token,
    });
    await fs.writeFile(this.TOKEN_PATH, payload);
  }

  async authorize() {
    let client = await this.loadSavedCredentialsIfExist();
    if (client) {
      return client;
    }
    client = await authenticate({
      scopes: this.SCOPES,
      keyfilePath: this.CREDENTIALS_PATH,
    });
    if (client.credentials) {
      await this.saveCredentials(client);
    }
    return client;
  }

  async sendEmail(auth, emailData) {
    const gmail = google.gmail({ version: 'v1', auth });
    
    const message = [
      `To: ${emailData.to}`,
      `Subject: ${emailData.subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="boundary"`,
      ``,
      `--boundary`,
      `Content-Type: text/html; charset="UTF-8"`,
      ``,
      emailData.html,
      ``,
      `--boundary`,
      `Content-Type: application/pdf`,
      `Content-Disposition: attachment; filename="${emailData.attachmentName}"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      emailData.attachmentBase64,
      `--boundary--`
    ].join('\n');

    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });
    
    return res.data;
  }
}
```

## Troubleshooting

### "Less secure app access" is no longer available
Google disabled this option in May 2022. You MUST use either:
- App passwords (with 2FA enabled)
- OAuth2
- A different email service

### "Invalid credentials" error
- Make sure you're using the app password, NOT your regular Gmail password
- Remove any spaces from the app password
- Check that 2FA is enabled

### Rate limiting
Gmail has sending limits:
- 500 emails per day for regular Gmail
- 2000 emails per day for Google Workspace

### Alternative: Use Test Mode
For development, update .env:
```
EMAIL_TEST_MODE=true
```

Then modify email.service.js to log emails instead of sending them.

## Quick Test

To test if your email configuration works:

```javascript
// test-email.js
require('dotenv').config();
const nodemailer = require('nodemailer');

async function testEmail() {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });

  try {
    await transporter.verify();
    console.log('✅ Email configuration is valid!');
    
    // Send test email
    const info = await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: process.env.GMAIL_USER,
      subject: 'Test Email - Job Application Bot',
      text: 'If you see this, your email configuration works!'
    });
    
    console.log('✅ Test email sent:', info.messageId);
  } catch (error) {
    console.error('❌ Email configuration error:', error.message);
  }
}

testEmail();
```

Run with: `node test-email.js`