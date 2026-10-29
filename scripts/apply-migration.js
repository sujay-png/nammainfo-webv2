const fs = require('fs');
const { Client } = require('pg');

async function run() {
  const sql = fs.readFileSync('d:/projects/nammainfo-webv2/supabase/migrations/20261029_free_trial_and_milestones.sql', 'utf8');
  const client = new Client({
    host: 'db.gbvdkzgthqmfoajfpwxq.supabase.co',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'raees1122m12',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log('Connected to DB, executing migration...');
  await client.query(sql);
  console.log('Migration executed successfully!');
  const res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'profiles' AND column_name LIKE 'trial_%';");
  console.log('Verified trial columns:', res.rows);
  await client.end();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

