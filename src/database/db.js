const knex = require('knex');
const path = require('path');

const db = knex({
  client: 'better-sqlite3',
  connection: {
    filename: process.env.DATABASE_PATH || './data/jobs.db'
  },
  useNullAsDefault: true
});

async function initDatabase() {
  if (!(await db.schema.hasTable('resumes'))) {
    await db.schema.createTable('resumes', (table) => {
      table.increments('id').primary();
      table.string('filename');
      table.text('content');
      table.json('parsed_data');
      table.string('content_hash').index();
      table.timestamps(true, true);
    });
  }

  if (!(await db.schema.hasTable('jobs'))) {
    await db.schema.createTable('jobs', (table) => {
      table.increments('id').primary();
      table.string('title');
      table.string('company');
      table.string('location');
      table.text('description');
      table.string('url');
      table.string('source');
      table.integer('relevance_score');
      table.timestamps(true, true);
    });
  }

  if (!(await db.schema.hasTable('applications'))) {
    await db.schema.createTable('applications', (table) => {
      table.increments('id').primary();
      table.integer('resume_id').references('id').inTable('resumes');
      table.integer('job_id').references('id').inTable('jobs');
      table.text('cover_letter');
      table.string('status').defaultTo('pending');
      table.string('email_to');
      table.timestamp('sent_at');
      table.text('error_message');
      table.timestamps(true, true);
    });
  }

  const hasContentHash = await db.schema.hasColumn('resumes', 'content_hash');
  if (!hasContentHash) {
    await db.schema.alterTable('resumes', (table) => {
      table.string('content_hash').index();
    });
    console.log('Added content_hash column to resumes table');
  }

  const hasPdfContent = await db.schema.hasColumn('resumes', 'pdf_content');
  if (!hasPdfContent) {
    await db.schema.alterTable('resumes', (table) => {
      table.binary('pdf_content');
    });
    console.log('Added pdf_content column to resumes table');
  }

  console.log('Database initialized');
}

module.exports = { db, initDatabase };