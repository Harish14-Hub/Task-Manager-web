const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function initializeDatabase() {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    console.log('Running schema.sql to initialize/reset database tables...');
    
    // Execute the SQL schema
    await db.query(sql);
    
    console.log('Database schema successfully initialized!');
    process.exit(0);
  } catch (error) {
    console.error('Failed to initialize database schema:', error);
    process.exit(1);
  }
}

initializeDatabase();
