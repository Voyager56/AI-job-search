const resumeWorker = require('./resume.worker');
const emailWorker = require('./email.worker');
const pipelineWorker = require('./application-pipeline.worker');

console.log('Starting all workers...');

const workers = {
  resume: resumeWorker,
  email: emailWorker,
  pipeline: pipelineWorker
};

process.on('SIGTERM', async () => {
  console.log('Shutting down all workers...');
  
  for (const [name, worker] of Object.entries(workers)) {
    console.log(`Closing ${name} worker...`);
    await worker.close();
  }
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  
  for (const [name, worker] of Object.entries(workers)) {
    console.log(`Closing ${name} worker...`);
    await worker.close();
  }
  
  process.exit(0);
});

setInterval(() => {
  const dateUtils = require('../utils/dateUtils');
  console.log('Worker Status Check:', dateUtils.formatDateTime(new Date()));
  for (const [name, worker] of Object.entries(workers)) {
    console.log(`- ${name}: ${worker.isRunning() ? 'Running' : 'Stopped'}`);
  }
}, 60000);

console.log('All workers started successfully');

process.stdin.resume();