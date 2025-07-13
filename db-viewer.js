require('dotenv').config();
const { db } = require('./src/database/db');
const express = require('express');

const app = express();
const PORT = 3001;

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Job Bot Database Viewer</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .json { font-size: 12px; max-width: 300px; overflow: auto; }
        h2 { color: #333; }
        .stats { background: #e8f4f8; padding: 15px; border-radius: 5px; margin: 20px 0; }
        a { color: #2196F3; text-decoration: none; padding: 5px 10px; }
        a:hover { background: #e3f2fd; }
        nav { margin: 20px 0; }
      </style>
    </head>
    <body>
      <h1>Job Application Bot - Database Viewer</h1>
      
      <nav>
        <a href="/stats">📊 Statistics</a>
        <a href="/resumes">📄 Resumes</a>
        <a href="/jobs">💼 Jobs</a>
        <a href="/applications">📮 Applications</a>
        <a href="/high-score-jobs">⭐ High Score Jobs</a>
      </nav>
      
      <div class="stats">
        <h2>Quick Stats</h2>
        <div id="stats">Loading...</div>
      </div>
      
      <script>
        fetch('/stats')
          .then(r => r.json())
          .then(data => {
            document.getElementById('stats').innerHTML = \`
              <p>📄 Total Resumes: \${data.resumes}</p>
              <p>💼 Total Jobs: \${data.jobs}</p>
              <p>📮 Total Applications: \${data.applications}</p>
              <p>✅ Sent Applications: \${data.sent}</p>
              <p>⏳ Pending Applications: \${data.pending}</p>
            \`;
          });
      </script>
    </body>
    </html>
  `);
});

app.get('/stats', async (req, res) => {
  try {
    const stats = {
      resumes: await db('resumes').count('* as count').first().then(r => r.count),
      jobs: await db('jobs').count('* as count').first().then(r => r.count),
      applications: await db('applications').count('* as count').first().then(r => r.count),
      sent: await db('applications').where('status', 'sent').count('* as count').first().then(r => r.count),
      pending: await db('applications').where('status', 'pending').count('* as count').first().then(r => r.count),
    };
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/resumes', async (req, res) => {
  try {
    const resumes = await db('resumes')
      .select('id', 'filename', 'created_at', 'parsed_data')
      .orderBy('created_at', 'desc');
    
    const html = `
      <h2><a href="/">← Back</a> Resumes (${resumes.length})</h2>
      <table>
        <tr>
          <th>ID</th>
          <th>Filename</th>
          <th>Name</th>
          <th>Email</th>
          <th>Skills</th>
          <th>Created</th>
        </tr>
        ${resumes.map(r => {
          const parsed = JSON.parse(r.parsed_data || '{}');
          return `<tr>
            <td>${r.id}</td>
            <td>${r.filename}</td>
            <td>${parsed.name || 'N/A'}</td>
            <td>${parsed.email || 'N/A'}</td>
            <td class="json">${(parsed.skills || []).join(', ')}</td>
            <td>${new Date(r.created_at).toLocaleString()}</td>
          </tr>`;
        }).join('')}
      </table>
    `;
    res.send(wrapHtml(html));
  } catch (error) {
    res.status(500).send(`Error: ${error.message}`);
  }
});

app.get('/jobs', async (req, res) => {
  try {
    const jobs = await db('jobs')
      .select('*')
      .orderBy('created_at', 'desc')
      .limit(100);
    
    const html = `
      <h2><a href="/">← Back</a> Jobs (showing last 100)</h2>
      <table>
        <tr>
          <th>ID</th>
          <th>Title</th>
          <th>Company</th>
          <th>Location</th>
          <th>Score</th>
          <th>Source</th>
          <th>HR Email</th>
          <th>Created</th>
          <th>Actions</th>
        </tr>
        ${jobs.map(j => `<tr>
          <td>${j.id}</td>
          <td>${j.title}</td>
          <td>${j.company}</td>
          <td>${j.location}</td>
          <td style="background: ${getScoreColor(j.relevance_score)}">${j.relevance_score}%</td>
          <td>${j.source}</td>
          <td>${j.hr_email || 'N/A'}</td>
          <td>${new Date(j.created_at).toLocaleDateString()}</td>
          <td><a href="${j.url}" target="_blank">View</a></td>
        </tr>`).join('')}
      </table>
    `;
    res.send(wrapHtml(html));
  } catch (error) {
    res.status(500).send(`Error: ${error.message}`);
  }
});

app.get('/high-score-jobs', async (req, res) => {
  try {
    const jobs = await db('jobs')
      .where('relevance_score', '>=', 70)
      .orderBy('relevance_score', 'desc');
    
    const html = `
      <h2><a href="/">← Back</a> High Score Jobs (70%+) - ${jobs.length} jobs</h2>
      <table>
        <tr>
          <th>Score</th>
          <th>Title</th>
          <th>Company</th>
          <th>Location</th>
          <th>Source</th>
          <th>URL</th>
        </tr>
        ${jobs.map(j => `<tr>
          <td style="background: ${getScoreColor(j.relevance_score)}; font-weight: bold;">${j.relevance_score}%</td>
          <td>${j.title}</td>
          <td>${j.company}</td>
          <td>${j.location}</td>
          <td>${j.source}</td>
          <td><a href="${j.url}" target="_blank">Apply</a></td>
        </tr>`).join('')}
      </table>
    `;
    res.send(wrapHtml(html));
  } catch (error) {
    res.status(500).send(`Error: ${error.message}`);
  }
});

app.get('/applications', async (req, res) => {
  try {
    const applications = await db('applications')
      .join('resumes', 'applications.resume_id', 'resumes.id')
      .join('jobs', 'applications.job_id', 'jobs.id')
      .select(
        'applications.*',
        'resumes.filename as resume_filename',
        'jobs.title as job_title',
        'jobs.company as job_company'
      )
      .orderBy('applications.created_at', 'desc');
    
    const html = `
      <h2><a href="/">← Back</a> Applications (${applications.length})</h2>
      <table>
        <tr>
          <th>ID</th>
          <th>Resume</th>
          <th>Job</th>
          <th>Company</th>
          <th>Status</th>
          <th>Email To</th>
          <th>Sent At</th>
        </tr>
        ${applications.map(a => `<tr>
          <td>${a.id}</td>
          <td>${a.resume_filename}</td>
          <td>${a.job_title}</td>
          <td>${a.job_company}</td>
          <td style="color: ${a.status === 'sent' ? 'green' : a.status === 'failed' ? 'red' : 'orange'}">${a.status}</td>
          <td>${a.email_to}</td>
          <td>${a.sent_at ? new Date(a.sent_at).toLocaleString() : 'N/A'}</td>
        </tr>`).join('')}
      </table>
    `;
    res.send(wrapHtml(html));
  } catch (error) {
    res.status(500).send(`Error: ${error.message}`);
  }
});

function wrapHtml(content) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Database Viewer</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .json { font-size: 12px; }
        a { color: #2196F3; text-decoration: none; }
        a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>${content}</body>
    </html>
  `;
}

function getScoreColor(score) {
  if (score >= 80) return '#4CAF50';
  if (score >= 70) return '#8BC34A';
  if (score >= 60) return '#FFC107';
  if (score >= 50) return '#FF9800';
  return '#f44336';
}

app.listen(PORT, () => {
  console.log(`
  📊 Database Viewer running at http://localhost:${PORT}
  
  Available views:
  - http://localhost:${PORT}/           - Dashboard
  - http://localhost:${PORT}/resumes    - View all resumes
  - http://localhost:${PORT}/jobs       - View all jobs
  - http://localhost:${PORT}/applications - View applications
  - http://localhost:${PORT}/high-score-jobs - Jobs with 70%+ match
  
  Press Ctrl+C to stop
  `);
});