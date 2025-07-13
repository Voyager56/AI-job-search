# Job Application Bot

Automated job application system that parses resumes, finds matching jobs, generates AI cover letters, and sends applications.

## Quick Start

1. **Setup**
   ```bash
   npm install
   cp .env.example .env
   # Add your Gemini API key and Gmail credentials to .env
   npm run dev
   ```

2. **Get API Keys**
   - Gemini API: https://aistudio.google.com/app/apikey (free)
   - Gmail: Enable 2FA → Create App Password

3. **Use**
   - Visit http://localhost:3000
   - Upload PDF resume
   - Click "Find Matching Jobs"
   - Apply with one click

## Features

- ✅ AI resume parsing (Google Gemini)
- ✅ Multi-site job scraping (Indeed, SimplyHired, LinkedIn)
- ✅ Smart job matching with relevance scores
- ✅ Personalized AI cover letters
- ✅ Automated email applications
- ✅ SQLite database (no setup needed)

## Documentation

- **Development Guide**: See [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md)
- **Project Scope**: See [PROJECT_SCOPE.md](PROJECT_SCOPE.md)
- **Claude Config**: See [CLAUDE.md](CLAUDE.md)

## Scripts

```bash
npm run dev    # Development with auto-reload
npm start      # Production mode
```

## Limitations

- Free tier: 60 Gemini requests/min, 500 Gmail emails/day
- Web scraping may be blocked by some sites
- Single user system (no auth)

## License

ISC