const { db } = require('../app/lib/database');

async function removeKeyAliasColumn() {
  console.log('Starting migration: Drop key_alias column');
  try {
    // Check if the column exists
    const columns = await db.query(`
      SELECT * 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'api_keys' 
      AND COLUMN_NAME = 'key_alias'
    `);

    if (columns.length > 0) {
      console.log('key_alias column found. Dropping it...');
      await db.query('ALTER TABLE api_keys DROP COLUMN key_alias');
      console.log('✅ Column key_alias dropped successfully.');
    } else {
      console.log('key_alias column does not exist. No action needed.');
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1); // Exit with error
  } finally {
    // Close the database connection if the db object has a close method
    if (db && typeof db.close === 'function') {
      await db.close();
    }
    process.exit(0); // Ensure the script exits
  }
}

removeKeyAliasColumn();
