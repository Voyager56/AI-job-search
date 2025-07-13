# Job Application Bot - Claude Configuration

## Project Overview

This is an automated job application system that:
1. Parses PDF resumes using Google Gemini AI
2. Scrapes job postings from Indeed, SimplyHired, and LinkedIn
3. Matches jobs to resume skills and generates relevance scores
4. Creates personalized cover letters using AI
5. Sends email applications with attachments

## Architecture

```
Client (Web UI) → Express API → Services Layer → External APIs/Database
                                      ↓
                               SQLite Database
```

## Core Services

1. **resume.service.js**: PDF parsing and resume data extraction
2. **gemini.service.js**: AI-powered text analysis and generation
3. **job.service.js**: Job search orchestration and matching
4. **scraper.service.js**: Web scraping implementation
5. **email.service.js**: Application email sending

## Key Design Decisions

1. **SQLite over MongoDB**: Simpler setup, no external dependencies
2. **Gemini over GPT/Claude API**: Free tier available
3. **Cheerio over Puppeteer**: Lightweight scraping, lower resource usage
4. **No Queue System**: Simplified architecture, synchronous processing

## Development Guidelines

### Code Style
- Use async/await for all asynchronous operations
- Handle errors at service boundaries
- Return consistent response formats
- No console.log in production code paths
- ONLY add comments when ABSOLUTELY necessary (complex algorithms, critical workarounds, non-obvious business logic)
- NEVER add comments that explain what code does - code should be self-documenting
- NEVER add section headers or organizational comments
- NEVER add TODO comments - use external tracking instead

### API Patterns
```javascript
// Success response
{ success: true, data: {...} }

// Error response
{ success: false, error: "message" }
```

### Database Conventions
- Use snake_case for column names
- Always include created_at/updated_at timestamps
- Use JSON columns for flexible data storage
- Maintain referential integrity with foreign keys

### Error Handling
```javascript
try {
  const result = await someOperation();
  return { success: true, data: result };
} catch (error) {
  console.error('Operation failed:', error);
  return { success: false, error: error.message };
}
```

## Environment Variables

Required:
- `GEMINI_API_KEY`: Google AI API key
- `GMAIL_USER`: Gmail address for sending
- `GMAIL_APP_PASSWORD`: Gmail app-specific password

Optional:
- `PORT`: Server port (default: 3000)
- `DATABASE_PATH`: SQLite file location (default: ./data/jobs.db)
- `NODE_ENV`: Environment (development/production)
- `MAX_APPLICATIONS_PER_DAY`: Rate limiting (default: 10)
- `APPLICATION_DELAY_MS`: Delay between applications (default: 10000)

## Testing Checklist

Before making changes:
1. Test resume upload with various PDF formats
2. Verify job scraping returns results
3. Check AI cover letter generation
4. Confirm email sending (use test email)
5. Validate database operations

## Common Issues & Solutions

1. **Scraping returns no results**
   - Job sites may have changed HTML structure
   - Check for IP blocking/rate limiting
   - Verify user-agent rotation is working

2. **Gemini API errors**
   - Check API key validity
   - Monitor rate limits (60 req/min)
   - Ensure prompt length < 8k tokens
   - Model name: Use 'gemini-1.5-flash' (not 'gemini-pro')

3. **Email sending failures**
   - Verify Gmail app password
   - Check 2FA is enabled
   - Monitor Gmail sending limits

4. **Build/Dependency Issues**
   - axios-retry: Use `const { default: axiosRetry } = require('axios-retry')`
   - Knex deprecation: Use `hasTable()` + `createTable()` instead of `createTableIfNotExists()`
   - Redis required for queues: Install with `sudo apt-get install redis-server`

5. **Queue System Not Working**
   - Ensure Redis is running: `redis-cli ping` should return PONG
   - Start workers separately: `npm run workers`
   - Check dashboard at /admin/queues for job status

## Performance Considerations

1. **Scraping**: Add delays between requests to avoid blocking
2. **Database**: Index frequently queried columns (relevance_score)
3. **File Storage**: Clean up old resume files periodically
4. **API Calls**: Cache Gemini responses when possible

## Security Best Practices

1. Never commit .env file
2. Sanitize user inputs before database queries
3. Validate file uploads (PDF only, size limits)
4. Use prepared statements for SQL queries
5. Implement rate limiting for public endpoints

## LinkedIn Scraper

The project includes two LinkedIn scraping options:

1. **Basic Scraper** (Default): Uses Cheerio, lightweight but limited results
2. **Advanced Scraper**: Uses linkedin-jobs-scraper package with Puppeteer
   - Enable with checkbox in UI or `USE_ADVANCED_LINKEDIN_SCRAPER=true` in .env
   - Requires Chromium/Chrome installed
   - More resource intensive but better results
   - May trigger LinkedIn rate limits
   - **Note**: LinkedIn requires authentication for best results
   - May encounter errors due to LinkedIn's anti-scraping measures

## Future Enhancements

Priority improvements:
1. ~~Add job application queue with BullMQ~~ ✓ Implemented
2. Implement proper logging with Winston
3. Add unit tests for critical services
4. Create Docker deployment setup
5. ~~Add more job board integrations~~ ✓ Added jobs.ge
6. Implement resume template variations
7. Add application tracking dashboard

## Debugging Commands

```bash
# Check database
sqlite3 data/jobs.db ".tables"
sqlite3 data/jobs.db "SELECT * FROM jobs LIMIT 5;"

# Test Gemini connection
curl -X POST https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=$GEMINI_API_KEY

# Monitor scraping
tail -f logs/scraper.log

# Test email config
node -e "require('./src/services/email.service').testConnection()"
```

## Maintenance Tasks

Weekly:
- Clear old resume files > 30 days
- Check scraper effectiveness
- Monitor API usage/costs

Monthly:
- Update user-agent list
- Review and optimize database
- Check for dependency updates

## Contact & Support

For issues:
1. Check logs in console output
2. Verify environment variables
3. Test individual services in isolation
4. Review this documentation

Remember: This project balances functionality with simplicity. Not every edge case needs handling if it complicates the core flow.