# Development Guide & Best Practices

## Project Structure

```
job-application-bot/
├── src/
│   ├── index.js          # Entry point & API routes
│   ├── database/
│   │   └── db.js         # Database configuration
│   └── services/         # Business logic layer
│       ├── gemini.service.js    # AI operations
│       ├── resume.service.js    # Resume handling
│       ├── job.service.js       # Job coordination
│       ├── scraper.service.js   # Web scraping
│       └── email.service.js     # Email sending
├── public/               # Frontend files
├── uploads/              # Temporary file storage
└── data/                 # SQLite database
```

## Development Workflow

### 1. Setting Up Development Environment

```bash
# Clone and setup
git clone <repo>
cd job-application-bot
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Start development server
npm run dev
```

### 2. Making Changes

Before coding:
1. Read `CLAUDE.md` for project context
2. Check `PROJECT_SCOPE.md` for feature boundaries
3. Test existing functionality first

Code flow:
```
HTTP Request → Route Handler → Service Layer → External API/Database
                                     ↓
                              Business Logic
                                     ↓
                              Error Handling
                                     ↓
                              Response Format
```

### 3. Adding New Features

```javascript
// 1. Create service method
class NewService {
  async performAction(params) {
    try {
      // Validate inputs
      if (!params.required) {
        throw new Error('Missing required parameter');
      }
      
      // Business logic
      const result = await this.processData(params);
      
      // Return consistent format
      return { success: true, data: result };
    } catch (error) {
      console.error('NewService.performAction error:', error);
      throw error;
    }
  }
}

// 2. Add route handler
app.post('/api/new-feature', async (req, res) => {
  try {
    const result = await newService.performAction(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});
```

## Best Practices

### 1. Error Handling

```javascript
// Service layer - throw errors
async function serviceMethod() {
  if (errorCondition) {
    throw new Error('Descriptive error message');
  }
}

// Route layer - catch and format
app.post('/api/endpoint', async (req, res) => {
  try {
    const result = await serviceMethod();
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Endpoint error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});
```

### 2. Database Operations

```javascript
// Use transactions for multiple operations
async function complexOperation() {
  const trx = await db.transaction();
  try {
    await trx('table1').insert(data1);
    await trx('table2').update(data2);
    await trx.commit();
  } catch (error) {
    await trx.rollback();
    throw error;
  }
}

// Use parameterized queries
const results = await db('jobs')
  .where('title', 'like', `%${searchTerm}%`)
  .andWhere('location', location)
  .limit(10);
```

### 3. API Integration

```javascript
// Centralize API configuration
class ExternalAPI {
  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.example.com',
      timeout: 10000,
      headers: {
        'Authorization': `Bearer ${process.env.API_KEY}`
      }
    });
  }
  
  async makeRequest(endpoint, data) {
    try {
      const response = await this.client.post(endpoint, data);
      return response.data;
    } catch (error) {
      // Log full error, return user-friendly message
      console.error('API request failed:', error.response?.data);
      throw new Error('External service unavailable');
    }
  }
}
```

### 4. Web Scraping Ethics

```javascript
// Respect rate limits
async function respectfulScrape(urls) {
  const results = [];
  for (const url of urls) {
    try {
      const data = await scrapeUrl(url);
      results.push(data);
      
      // Random delay between requests
      const delay = 2000 + Math.random() * 3000;
      await new Promise(resolve => setTimeout(resolve, delay));
    } catch (error) {
      console.error(`Failed to scrape ${url}:`, error.message);
    }
  }
  return results;
}

// Rotate user agents
function getHeaders() {
  return {
    'User-Agent': new UserAgent().toString(),
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache'
  };
}
```

### 5. Security Practices

```javascript
// Input validation
function validateResumeUpload(file) {
  const maxSize = 5 * 1024 * 1024; // 5MB
  const allowedTypes = ['application/pdf'];
  
  if (!file) throw new Error('No file uploaded');
  if (file.size > maxSize) throw new Error('File too large');
  if (!allowedTypes.includes(file.mimetype)) {
    throw new Error('Only PDF files allowed');
  }
}

// Sanitize user input
function sanitizeJobSearch(query) {
  return query
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML
    .substring(0, 100);   // Limit length
}

// Never expose sensitive data
function formatJobResponse(job) {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    // Don't include: internal_notes, scraping_metadata, etc.
  };
}
```

## Testing Strategy

### Manual Testing Checklist

1. **Resume Upload**
   - [ ] Valid PDF uploads successfully
   - [ ] Invalid files are rejected
   - [ ] Large files are handled gracefully
   - [ ] Parsing extracts correct information

2. **Job Search**
   - [ ] Search returns relevant results
   - [ ] Empty searches are handled
   - [ ] Location filtering works
   - [ ] Pagination functions correctly

3. **Application Flow**
   - [ ] Cover letters are personalized
   - [ ] Emails send successfully
   - [ ] Attachments are included
   - [ ] Database tracks applications

### Debugging Tips

```javascript
// Add debug logging
if (process.env.NODE_ENV === 'development') {
  console.log('Debug:', { 
    operation: 'job_search',
    params: { query, location },
    timestamp: new Date().toISOString()
  });
}

// Use descriptive error messages
throw new Error(`Resume parsing failed: ${specificReason}`);

// Add timing logs
console.time('scraping_indeed');
const results = await scrapeIndeed();
console.timeEnd('scraping_indeed');
```

## Performance Optimization

### 1. Database Queries

```javascript
// Index frequently queried columns
await db.schema.table('jobs', table => {
  table.index(['relevance_score', 'created_at']);
});

// Use select to limit data transfer
const jobs = await db('jobs')
  .select('id', 'title', 'company', 'relevance_score')
  .where('relevance_score', '>', 70)
  .limit(20);
```

### 2. Caching Strategy

```javascript
// Simple in-memory cache
const cache = new Map();

async function getCachedData(key, fetchFunction) {
  if (cache.has(key)) {
    const { data, timestamp } = cache.get(key);
    const age = Date.now() - timestamp;
    if (age < 3600000) { // 1 hour
      return data;
    }
  }
  
  const data = await fetchFunction();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
}
```

### 3. Async Operations

```javascript
// Parallel processing where possible
const [resume, jobs] = await Promise.all([
  resumeService.getResume(resumeId),
  jobService.searchJobs(keywords)
]);

// But serialize when order matters
const resume = await resumeService.parseUpload(file);
const keywords = await geminiService.extractKeywords(resume);
const jobs = await jobService.searchJobs(keywords);
```

## Deployment Considerations

### Local Development
```bash
npm run dev  # Uses nodemon for auto-restart
```

### Production Setup
```bash
# Set production environment
NODE_ENV=production npm start

# Use PM2 for process management
npm install -g pm2
pm2 start src/index.js --name job-bot
pm2 save
pm2 startup
```

### Monitoring
```javascript
// Add health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Log important events
console.log(`[${new Date().toISOString()}] Application sent:`, {
  jobId,
  resumeId,
  email: maskEmail(email)
});
```

## Common Patterns

### Service Response Format
```javascript
// Success
{
  success: true,
  data: { /* actual data */ }
}

// Error
{
  success: false,
  error: "Human readable error message"
}
```

### Async Error Boundaries
```javascript
// Wrap all async routes
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

app.post('/api/endpoint', asyncHandler(async (req, res) => {
  const result = await someAsyncOperation();
  res.json(result);
}));
```

### Configuration Management
```javascript
// Centralize config with defaults
const config = {
  port: process.env.PORT || 3000,
  database: process.env.DATABASE_PATH || './data/jobs.db',
  maxApplicationsPerDay: parseInt(process.env.MAX_APPLICATIONS_PER_DAY) || 10,
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-pro'
  }
};

// Validate required config
if (!config.gemini.apiKey) {
  throw new Error('GEMINI_API_KEY is required');
}
```

Remember: Keep it simple, handle errors gracefully, and always consider the user experience.