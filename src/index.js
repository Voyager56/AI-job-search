require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const cookieParser = require('cookie-parser');
const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter } = require('@bull-board/express');

const { db, initDatabase } = require('./database/db');
const resumeService = require('./services/resume.service');
const jobService = require('./services/job.service');
const emailService = require('./services/email.service');
const geminiService = require('./services/gemini.service');
const queueService = require('./services/queue.service');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const { requireAuth, optionalAuth } = require('./middleware/auth.middleware');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public', { extensions: ['html'] }));

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);

initDatabase().catch(console.error);

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

const { addQueue, removeQueue, setQueues, replaceQueues } = createBullBoard({
  queues: [
    new BullMQAdapter(queueService.queues.resumeParsing),
    new BullMQAdapter(queueService.queues.jobScraping),
    new BullMQAdapter(queueService.queues.coverLetterGeneration),
    new BullMQAdapter(queueService.queues.emailSending),
    new BullMQAdapter(queueService.queues.applicationPipeline)
  ],
  serverAdapter: serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());

app.get('/', optionalAuth, (req, res) => {
  if (req.user) {
    res.sendFile(path.join(__dirname, '../public/dashboard.html'));
  } else {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  }
});

app.post('/api/resume/upload', requireAuth, upload.single('resume'), async (req, res) => {
  try {
    console.log('Upload endpoint hit');
    console.log('File received:', req.file ? req.file.originalname : 'No file');
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: 'No file uploaded' 
      });
    }
    
    const useQueue = req.query.queue !== 'false';
    console.log('Use queue:', useQueue);
    
    if (useQueue) {
      console.log('Processing resume...');
      const result = await resumeService.uploadResume(
        req.file.path,
        req.file.originalname,
        req.user.id
      );
      
      console.log('Resume processed, result:', result);
      
      const job = await queueService.addResumeParsingJob({
        id: result.id,
        filePath: req.file.path,
        fileName: req.file.originalname
      });
      
      res.json({
        success: true,
        message: 'Resume processed successfully',
        resumeId: result.id,
        data: result,
        jobId: job.id,
        queue: 'resume-parsing'
      });
    } else {
      console.log('Processing resume immediately...');
      const result = await resumeService.uploadResume(
        req.file.path,
        req.file.originalname,
        req.user.id
      );
      
      console.log('Resume processed, result:', result);
      
      res.json({
        success: true,
        message: 'Resume processed successfully',
        resumeId: result.id,
        data: result
      });
    }
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

app.delete('/api/resume/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await db('resumes')
      .where({ id, user_id: req.user.id })
      .delete();
    
    if (deleted) {
      res.json({ success: true, message: 'Resume deleted' });
    } else {
      res.status(404).json({ success: false, error: 'Resume not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/resumes', requireAuth, async (req, res) => {
  try {
    const unique = req.query.unique === 'true';
    const resumes = unique ? 
      await resumeService.getUniqueResumes(req.user.id) : 
      await resumeService.getAllResumes(req.user.id);
    res.json(resumes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/jobs/search', requireAuth, async (req, res) => {
  try {
    const { keywords, location } = req.body;
    const jobs = await jobService.searchJobs(keywords, location);
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/jobs/search/georgia', requireAuth, async (req, res) => {
  try {
    const { keywords, location = 'Tbilisi' } = req.body;
    const jobsGeScraper = require('./services/jobsge.scraper');
    const jobs = await jobsGeScraper.scrapeJobs(keywords, location);
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/jobs/match', requireAuth, async (req, res) => {
  try {
    const { resumeId, useAdvancedLinkedin } = req.body;
    const jobs = await jobService.matchJobsToResume(resumeId, {
      useAdvancedLinkedIn: useAdvancedLinkedin || false
    });
    res.json({ 
      success: true, 
      jobs: jobs 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

app.post('/api/jobs/match/:resumeId', requireAuth, async (req, res) => {
  try {
    const { useAdvancedLinkedIn } = req.body || {};
    const jobs = await jobService.matchJobsToResume(req.params.resumeId, {
      useAdvancedLinkedIn: useAdvancedLinkedIn || false
    });
    res.json({ 
      success: true, 
      jobs: jobs 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

app.post('/api/apply', requireAuth, async (req, res) => {
  try {
    const { resumeId, jobId, emailTo } = req.body;
    
    const job = await queueService.addEmailJob({
      resumeId,
      jobId,
      emailTo: emailTo || 'default@example.com',
      userId: req.user.id
    }, 1);
    
    res.json({ 
      success: true,
      message: 'Application queued for sending',
      jobId: job.id,
      queue: 'email-sending'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

app.post('/api/applications/apply', requireAuth, async (req, res) => {
  try {
    const { resumeId, jobId } = req.body;
    
    console.log('Application request:', { resumeId, jobId });
    
    const job = await queueService.addEmailJob({
      resumeId,
      jobId,
      emailTo: null,
      userId: req.user.id
    }, 1);
    
    res.json({ 
      success: true,
      message: 'Application queued for sending',
      jobId: job.id,
      queue: 'email-sending'
    });
  } catch (error) {
    console.error('Apply error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

app.post('/api/apply/bulk', requireAuth, async (req, res) => {
  try {
    const { resumeId, jobIds } = req.body;
    
    const job = await queueService.createApplicationPipeline(resumeId, jobIds, req.user.id);
    
    res.json({
      success: true,
      message: `Application pipeline started for ${jobIds.length} jobs`,
      pipelineId: job.id,
      queue: 'application-pipeline'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/queues/stats', async (req, res) => {
  try {
    const stats = {};
    for (const [name, queue] of Object.entries(queueService.queues)) {
      stats[name] = await queueService.getQueueStats(name);
    }
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/queues/:name/pause', async (req, res) => {
  try {
    await queueService.pauseQueue(req.params.name);
    res.json({ success: true, message: `Queue ${req.params.name} paused` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/queues/:name/resume', async (req, res) => {
  try {
    await queueService.resumeQueue(req.params.name);
    res.json({ success: true, message: `Queue ${req.params.name} resumed` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/queues/:name/clean', async (req, res) => {
  try {
    await queueService.cleanQueue(req.params.name);
    res.json({ success: true, message: `Queue ${req.params.name} cleaned` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/queues/:name/job/:jobId', async (req, res) => {
  try {
    const job = await queueService.getJob(req.params.name, req.params.jobId);
    if (job) {
      res.json(job);
    } else {
      res.status(404).json({ error: 'Job not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/applications', requireAuth, async (req, res) => {
  try {
    const applications = await emailService.getApplicationHistory(req.user.id);
    res.json(applications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/jobs/:jobId', requireAuth, async (req, res) => {
  try {
    const job = await db('jobs')
      .where({ id: req.params.jobId, user_id: req.user.id })
      .first();
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json(job);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/jobs/:jobId/redirect', requireAuth, async (req, res) => {
  try {
    const job = await db('jobs')
      .where({ id: req.params.jobId, user_id: req.user.id })
      .first();
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    res.redirect(job.url);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  const dateUtils = require('./utils/dateUtils');
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: dateUtils.formatDateTime(new Date()),
    redis: 'Check queue dashboard for Redis status'
  });
});

app.get('/api/linkedin-scraper/status', async (req, res) => {
  try {
    const puppeteer = require('puppeteer');
    const browserPath = puppeteer.executablePath();
    
    res.json({
      available: true,
      browserPath: browserPath,
      message: 'Advanced LinkedIn scraper is available'
    });
  } catch (error) {
    res.json({
      available: false,
      message: 'Advanced LinkedIn scraper not available. Puppeteer/Chromium may need to be installed.',
      error: error.message
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
🚀 Server running on http://localhost:${PORT}
📊 Queue Dashboard: http://localhost:${PORT}/admin/queues

To start workers in a separate terminal:
  npm run workers
  
Or start everything together:
  npm run dev:all
  `);
});