module.exports = {
  development: {
    client: 'better-sqlite3',
    connection: {
      filename: './data/jobs.db'
    },
    migrations: {
      directory: './src/database/migrations'
    },
    useNullAsDefault: true
  },
  production: {
    client: 'better-sqlite3',
    connection: {
      filename: process.env.DATABASE_PATH || './data/jobs.db'
    },
    migrations: {
      directory: './src/database/migrations'
    },
    useNullAsDefault: true
  }
};