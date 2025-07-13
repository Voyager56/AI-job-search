# SQLite Database Management Guide

## Database Location
The database file is located at: `./data/jobs.db`

## Method 1: Command Line (sqlite3)

### Install sqlite3 (if not already installed)
```bash
sudo apt-get install sqlite3  # Ubuntu/Debian
brew install sqlite            # macOS
```

### Basic Commands

```bash
# Open the database
sqlite3 data/jobs.db

# Once inside sqlite3 prompt:
.tables                    # List all tables
.schema                    # Show all table schemas
.schema resumes           # Show specific table schema
.quit                     # Exit sqlite3

# View data
SELECT * FROM resumes LIMIT 5;
SELECT * FROM jobs WHERE relevance_score > 70;
SELECT * FROM applications;

# Pretty output
.mode column
.headers on
SELECT id, title, company, relevance_score FROM jobs LIMIT 10;

# Export to CSV
.mode csv
.output jobs.csv
SELECT * FROM jobs;
.output stdout
```

### Quick One-liners
```bash
# View all tables
sqlite3 data/jobs.db ".tables"

# Count records
sqlite3 data/jobs.db "SELECT COUNT(*) FROM jobs;"

# View recent jobs
sqlite3 data/jobs.db "SELECT id, title, company, created_at FROM jobs ORDER BY created_at DESC LIMIT 10;"
```

## Method 2: GUI Tools

### 1. **DB Browser for SQLite** (Recommended)
Free, cross-platform SQLite database browser

```bash
# Install on Ubuntu/Debian
sudo apt-get install sqlitebrowser

# Install on macOS
brew install --cask db-browser-for-sqlite

# Or download from: https://sqlitebrowser.org/
```

### 2. **TablePlus**
Modern database GUI (free tier available)
- Download: https://tableplus.com/
- Supports SQLite, MySQL, PostgreSQL, etc.

### 3. **DBeaver**
Free, open-source universal database tool
- Download: https://dbeaver.io/
- Supports many database types

### 4. **VS Code Extensions**
- **SQLite Viewer**: View SQLite files directly in VS Code
- **SQLite**: Full SQLite support with query execution

## Method 3: Web-based Viewer

### Create a simple web viewer
```javascript
// db-viewer.js
const express = require('express');
const { db } = require('./src/database/db');

const app = express();

app.get('/db/:table', async (req, res) => {
  try {
    const data = await db(req.params.table).select('*');
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/db', async (req, res) => {
  const tables = await db.raw(`
    SELECT name FROM sqlite_master 
    WHERE type='table' 
    ORDER BY name;
  `);
  res.json(tables);
});

app.listen(3001, () => {
  console.log('DB Viewer running on http://localhost:3001');
});
```

## Method 4: Using Node.js Scripts

### Query script
```javascript
// query-db.js
require('dotenv').config();
const { db } = require('./src/database/db');

async function query() {
  // Get all resumes
  const resumes = await db('resumes').select('*');
  console.log('Resumes:', resumes);

  // Get high-scoring jobs
  const jobs = await db('jobs')
    .where('relevance_score', '>', 70)
    .orderBy('relevance_score', 'desc');
  console.log('High-scoring jobs:', jobs);

  // Get applications
  const applications = await db('applications')
    .join('resumes', 'applications.resume_id', 'resumes.id')
    .join('jobs', 'applications.job_id', 'jobs.id')
    .select(
      'applications.*',
      'resumes.filename as resume_name',
      'jobs.title as job_title'
    );
  console.log('Applications:', applications);

  process.exit(0);
}

query();
```

## Database Schema

### resumes
- id (integer, primary key)
- filename (varchar)
- content (text) - PDF content
- parsed_data (json) - Extracted data
- content_hash (varchar) - For deduplication
- created_at, updated_at (datetime)

### jobs
- id (integer, primary key)
- title (varchar)
- company (varchar)
- location (varchar)
- description (text)
- url (varchar)
- source (varchar) - Indeed, LinkedIn, etc.
- relevance_score (integer)
- hr_email (varchar)
- created_at, updated_at (datetime)

### applications
- id (integer, primary key)
- resume_id (integer, foreign key)
- job_id (integer, foreign key)
- cover_letter (text)
- status (varchar) - pending, sent, failed
- email_to (varchar)
- sent_at (datetime)
- error_message (text)
- created_at, updated_at (datetime)

## Useful Queries

### View Resume Analysis
```sql
SELECT 
  id,
  filename,
  json_extract(parsed_data, '$.name') as name,
  json_extract(parsed_data, '$.email') as email,
  created_at
FROM resumes;
```

### Find Duplicate Jobs
```sql
SELECT title, company, COUNT(*) as count
FROM jobs
GROUP BY title, company
HAVING count > 1;
```

### Application Statistics
```sql
SELECT 
  status,
  COUNT(*) as count,
  DATE(created_at) as date
FROM applications
GROUP BY status, DATE(created_at)
ORDER BY date DESC;
```

### Jobs by Source
```sql
SELECT 
  source,
  COUNT(*) as total,
  AVG(relevance_score) as avg_score
FROM jobs
GROUP BY source;
```

### Clean Old Data
```sql
-- Delete jobs older than 30 days
DELETE FROM jobs 
WHERE created_at < datetime('now', '-30 days');

-- Delete failed applications
DELETE FROM applications 
WHERE status = 'failed' 
AND created_at < datetime('now', '-7 days');
```

## Backup and Restore

### Backup
```bash
# Simple copy
cp data/jobs.db data/jobs_backup_$(date +%Y%m%d).db

# SQL dump
sqlite3 data/jobs.db .dump > backup.sql

# Compressed backup
sqlite3 data/jobs.db .dump | gzip > backup_$(date +%Y%m%d).sql.gz
```

### Restore
```bash
# From SQL dump
sqlite3 data/jobs_new.db < backup.sql

# From compressed backup
gunzip -c backup_20240713.sql.gz | sqlite3 data/jobs_new.db
```

## Maintenance

### Optimize Database
```sql
-- In sqlite3
VACUUM;  -- Reclaim space
ANALYZE; -- Update statistics
```

### Check Integrity
```sql
PRAGMA integrity_check;
```

### Database Size
```bash
# File size
ls -lh data/jobs.db

# Table sizes
sqlite3 data/jobs.db "
SELECT 
  name,
  SUM(pgsize) as size
FROM dbstat
GROUP BY name
ORDER BY size DESC;"
```

## Quick Admin Panel

For a quick admin view, you can use the existing Bull Board at:
http://localhost:3000/admin/queues

Or create a simple admin route in your app to view database stats.