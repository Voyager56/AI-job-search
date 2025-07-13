# Queue Learning Guide - Everything About Job Queues

## What Are Queues?

Think of a queue like a todo list that multiple people can work on at the same time. Instead of processing everything immediately when a user clicks a button, you add tasks to a queue and workers process them in the background.

## Why Use Queues?

### Without Queues (Synchronous):
```
User uploads resume → Server processes (30 seconds) → User waits → Response
```
Problems:
- User waits 30 seconds staring at loading spinner
- If server crashes, everything is lost
- Can't handle many users at once
- One slow task blocks everything

### With Queues (Asynchronous):
```
User uploads resume → Add to queue (instant) → "Processing started!" → User continues
                            ↓
                    Background worker processes when ready
```
Benefits:
- Instant response to user
- Can handle thousands of requests
- Automatic retries on failure
- Better resource usage

## Queue Concepts Explained

### 1. **Jobs**
A job is a single task to be done:
```javascript
{
  id: "job-123",
  data: {
    resumeId: 456,
    filePath: "/uploads/resume.pdf"
  },
  attempts: 0,
  priority: 1
}
```

### 2. **Queues**
A queue is a list of jobs waiting to be processed:
```
Resume Queue: [job-1, job-2, job-3] → Worker takes job-1 → Processes → Done
Email Queue:  [email-1, email-2]    → Worker takes email-1 → Sends → Done
```

### 3. **Workers**
Workers are processes that take jobs from queues and execute them:
```javascript
// Worker says: "Give me a job from the resume queue"
// Queue says: "Here's job-1"  
// Worker processes job-1
// Worker says: "Done! Give me another"
```

### 4. **Redis**
Redis is the database that stores all queues and jobs. Think of it as a super-fast notepad that all your workers share.

## Our Queue Implementation

### Queue Types We Use:

1. **resume-parsing**: Processes PDF resumes
2. **job-scraping**: Scrapes job boards
3. **cover-letter-generation**: Creates AI cover letters
4. **email-sending**: Sends application emails
5. **application-pipeline**: Orchestrates the full flow

### Real Example Flow:

```javascript
// 1. User uploads resume
app.post('/api/resume/upload', async (req, res) => {
  // Instead of processing now, add to queue
  const job = await queueService.addResumeParsingJob({
    filePath: req.file.path
  });
  
  res.json({ message: "Processing started!", jobId: job.id });
});

// 2. Worker processes it (running separately)
const resumeWorker = new Worker('resume-parsing', async (job) => {
  const { filePath } = job.data;
  
  // Update progress so user can track
  await job.updateProgress(10);
  
  // Do the actual work
  const text = await parsePDF(filePath);
  await job.updateProgress(50);
  
  const data = await extractWithAI(text);
  await job.updateProgress(100);
  
  return { success: true, data };
});
```

## Queue Features We Use

### 1. **Retries**
If a job fails, it automatically retries:
```javascript
{
  attempts: 3,              // Try 3 times
  backoff: {
    type: 'exponential',    // Wait 2s, 4s, 8s between retries
    delay: 2000
  }
}
```

### 2. **Priority**
Important jobs go first:
```javascript
// CEO's application - Priority 10
await queueService.addEmailJob(data, 10);

// Regular application - Priority 0  
await queueService.addEmailJob(data, 0);
```

### 3. **Rate Limiting**
Don't overwhelm external services:
```javascript
limiter: {
  max: 10,
  duration: 60000  // Max 10 jobs per minute
}
```

### 4. **Scheduled Jobs**
Run jobs on a schedule:
```javascript
{
  repeat: {
    pattern: '0 * * * *'  // Every hour
  }
}
```

### 5. **Progress Tracking**
Users can see progress:
```javascript
await job.updateProgress(50); // 50% done
```

## Monitoring & Dashboard

Visit http://localhost:3000/admin/queues to see:
- Jobs waiting, active, completed, failed
- Processing speed
- Error details
- Manual retry options

## Common Patterns

### 1. **Fire and Forget**
```javascript
// Add job and don't wait
await queue.add('send-email', data);
res.json({ status: 'queued' });
```

### 2. **Wait for Result**
```javascript
// Add job and wait for completion
const job = await queue.add('process', data);
const result = await job.waitUntilFinished(queueEvents);
res.json(result);
```

### 3. **Batch Processing**
```javascript
// Add multiple jobs at once
const jobs = items.map(item => ({
  name: 'process-item',
  data: item
}));
await queue.addBulk(jobs);
```

### 4. **Pipeline Pattern**
```javascript
// Chain multiple queues
parseResume → findJobs → generateCoverLetters → sendEmails
```

## Debugging Queues

### Check Queue Status:
```javascript
const stats = await queue.getJobCounts();
console.log(stats);
// { active: 2, waiting: 10, completed: 50, failed: 3 }
```

### Find Stuck Jobs:
```javascript
const stalled = await queue.getStalled();
```

### Retry Failed Jobs:
```javascript
const failed = await queue.getFailed();
for (const job of failed) {
  await job.retry();
}
```

## Best Practices

1. **Keep Jobs Small**: Don't put huge data in jobs
   ```javascript
   // Bad: Entire file in job
   queue.add('process', { fileContent: hugeString });
   
   // Good: Just the reference
   queue.add('process', { filePath: '/uploads/file.pdf' });
   ```

2. **Idempotent Jobs**: Jobs should be safe to retry
   ```javascript
   // Check if already processed
   const existing = await db.query('SELECT * FROM processed WHERE id = ?', [id]);
   if (existing) return { skipped: true };
   ```

3. **Handle Errors Gracefully**:
   ```javascript
   try {
     await riskyOperation();
   } catch (error) {
     if (error.code === 'RATE_LIMIT') {
       // Delay retry
       await job.moveToDelayed(Date.now() + 3600000);
     }
     throw error; // Let queue retry
   }
   ```

4. **Clean Up Old Jobs**:
   ```javascript
   queue.clean(1000, 'completed'); // Remove completed jobs older than 1 second
   queue.clean(3600000, 'failed');  // Remove failed jobs older than 1 hour
   ```

## Testing Your Queue Implementation

1. **Start Redis**:
   ```bash
   # Install Redis if needed
   sudo apt-get install redis-server
   # Or Docker
   docker run -p 6379:6379 redis
   ```

2. **Start the app**:
   ```bash
   npm run dev
   ```

3. **Start workers** (separate terminal):
   ```bash
   npm run workers
   ```

4. **Upload a resume** and watch:
   - Instant response in browser
   - Progress in terminal
   - Dashboard at /admin/queues

## Queue vs Direct Processing

| Scenario | Direct | Queue |
|----------|--------|--------|
| Send welcome email | ❌ User waits | ✅ Instant response |
| Process payment | ✅ User needs confirmation | ❌ Too critical |
| Generate report | ❌ Might timeout | ✅ Process in background |
| Update search index | ❌ Slows down save | ✅ Eventually consistent |

## Advanced Queue Concepts

### Dead Letter Queue
Jobs that fail too many times go here for manual review:
```javascript
const deadLetterQueue = new Queue('dead-letter');
// Failed jobs automatically moved here
```

### Queue Events
Listen to what's happening:
```javascript
queue.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed with result:`, result);
});

queue.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err.message);
  // Send alert to admin
});
```

### Distributed Processing
Run workers on multiple machines:
```
Machine 1: Resume Worker x2
Machine 2: Email Worker x3  
Machine 3: Scraping Worker x1
All connecting to same Redis
```

## Summary

Queues transform your application from:
- Synchronous → Asynchronous
- Fragile → Resilient  
- Limited → Scalable
- Blocking → Non-blocking

Start simple with one queue, then expand as needed. The infrastructure we've built can handle millions of jobs with proper scaling!