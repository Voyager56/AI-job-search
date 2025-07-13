#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🗑️  Resetting Job Application Bot Database...\n');

const dbPath = path.join(__dirname, 'data', 'jobs.db');

if (fs.existsSync(dbPath)) {
  const backupPath = path.join(__dirname, 'data', `jobs_backup_${Date.now()}.db`);
  fs.copyFileSync(dbPath, backupPath);
  console.log(`✅ Backup created: ${backupPath}`);
  
  fs.unlinkSync(dbPath);
  console.log('✅ Database deleted');
} else {
  console.log('ℹ️  Database file not found');
}

try {
  execSync('redis-cli FLUSHALL', { stdio: 'pipe' });
  console.log('✅ Redis queues cleared');
} catch (error) {
  console.log('⚠️  Could not clear Redis queues (Redis might not be running)');
}

const uploadsDir = path.join(__dirname, 'uploads');
if (fs.existsSync(uploadsDir)) {
  const files = fs.readdirSync(uploadsDir);
  files.forEach(file => {
    if (file !== '.gitkeep') {
      fs.unlinkSync(path.join(uploadsDir, file));
    }
  });
  console.log(`✅ Cleared ${files.length - 1} uploaded files`);
}

const testEmailsDir = path.join(__dirname, 'test-emails');
if (fs.existsSync(testEmailsDir)) {
  const files = fs.readdirSync(testEmailsDir);
  files.forEach(file => {
    fs.unlinkSync(path.join(testEmailsDir, file));
  });
  console.log(`✅ Cleared ${files.length} test emails`);
}

console.log('\n✨ Database reset complete!');
console.log('📝 Run "npm run dev" to start with a fresh database\n');