const bcrypt = require('bcrypt');
const db = require('../config/db');

async function seedAdmin() {
  try {
    const adminEmail = 'admin@taskmanager.com';
    const adminPassword = 'Admin123!';
    
    const userExists = await db.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    
    if (userExists.rows.length > 0) {
      console.log('Admin user already exists.');
      process.exit(0);
    }

    const saltRounds = 10;
    const password = await bcrypt.hash(adminPassword, saltRounds);

    await db.query(
      'INSERT INTO users (name, email, password, role, is_first_login) VALUES ($1, $2, $3, $4, $5)',
      ['System Admin', adminEmail, password, 'admin', false]
    );

    console.log('Admin user successfully seeded!');
    console.log(`Email: ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed admin:', error);
    process.exit(1);
  }
}

seedAdmin();
