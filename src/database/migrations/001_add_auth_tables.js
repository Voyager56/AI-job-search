exports.up = async function(knex) {
  const hasUsersTable = await knex.schema.hasTable('users');
  if (!hasUsersTable) {
    await knex.schema.createTable('users', table => {
      table.increments('id').primary();
      table.string('email', 255).unique().notNullable();
      table.string('password_hash', 255).notNullable();
      table.string('name', 255);
      table.datetime('created_at').defaultTo(knex.fn.now());
      table.datetime('updated_at').defaultTo(knex.fn.now());
      table.boolean('email_verified').defaultTo(false);
      table.boolean('is_active').defaultTo(true);
    });
  }
  
  const hasSessionsTable = await knex.schema.hasTable('sessions');
  if (!hasSessionsTable) {
    await knex.schema.createTable('sessions', table => {
      table.string('id', 255).primary();
      table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.datetime('expires_at').notNullable();
      table.datetime('created_at').defaultTo(knex.fn.now());
      table.index(['user_id', 'expires_at']);
    });
  }
  
  const hasUserIdInResumes = await knex.schema.hasColumn('resumes', 'user_id');
  if (!hasUserIdInResumes) {
    await knex.schema.alterTable('resumes', table => {
      table.integer('user_id').references('id').inTable('users').onDelete('SET NULL');
    });
  }
  
  const hasUserIdInJobs = await knex.schema.hasColumn('jobs', 'user_id');
  if (!hasUserIdInJobs) {
    await knex.schema.alterTable('jobs', table => {
      table.integer('user_id').references('id').inTable('users').onDelete('SET NULL');
    });
  }
  
  const hasUserIdInApplications = await knex.schema.hasColumn('applications', 'user_id');
  if (!hasUserIdInApplications) {
    await knex.schema.alterTable('applications', table => {
      table.integer('user_id').references('id').inTable('users').onDelete('SET NULL');
    });
  }
};

exports.down = async function(knex) {
  const hasUserIdInApplications = await knex.schema.hasColumn('applications', 'user_id');
  if (hasUserIdInApplications) {
    await knex.schema.alterTable('applications', table => {
      table.dropColumn('user_id');
    });
  }
  
  const hasUserIdInJobs = await knex.schema.hasColumn('jobs', 'user_id');
  if (hasUserIdInJobs) {
    await knex.schema.alterTable('jobs', table => {
      table.dropColumn('user_id');
    });
  }
  
  const hasUserIdInResumes = await knex.schema.hasColumn('resumes', 'user_id');
  if (hasUserIdInResumes) {
    await knex.schema.alterTable('resumes', table => {
      table.dropColumn('user_id');
    });
  }
  
  await knex.schema.dropTableIfExists('sessions');
  await knex.schema.dropTableIfExists('users');
};