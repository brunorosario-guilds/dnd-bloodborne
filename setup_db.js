const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:ppHoVkKjlaPToBtc@db.roiqfjrkzajstnmwqrlq.supabase.co:5432/postgres'
});

async function setupDb() {
  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL via Pooler!');

    const sql = `
      -- Create the main table
      CREATE TABLE IF NOT EXISTS character_sheets (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
          data JSONB NOT NULL DEFAULT '{}'::jsonb,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Força adicionar a restrição UNIQUE se ela não existir (para o upsert funcionar)
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM pg_constraint WHERE conname = 'character_sheets_user_id_key'
          ) THEN
              ALTER TABLE character_sheets ADD CONSTRAINT character_sheets_user_id_key UNIQUE (user_id);
          END IF;
      END $$;

      -- Enable Row Level Security (RLS)
      ALTER TABLE character_sheets ENABLE ROW LEVEL SECURITY;

      -- Drop existing policies if they exist (for idempotency)
      DROP POLICY IF EXISTS "Users can view own sheet" ON character_sheets;
      DROP POLICY IF EXISTS "Users can insert own sheet" ON character_sheets;
      DROP POLICY IF EXISTS "Users can update own sheet" ON character_sheets;

      -- Create precise policies
      CREATE POLICY "Users can view own sheet" ON character_sheets FOR SELECT USING (auth.uid() = user_id);
      CREATE POLICY "Users can insert own sheet" ON character_sheets FOR INSERT WITH CHECK (auth.uid() = user_id);
      CREATE POLICY "Users can update own sheet" ON character_sheets FOR UPDATE USING (auth.uid() = user_id);

      -- DM policies
      DROP POLICY IF EXISTS "DM can view all sheets" ON character_sheets;
      DROP POLICY IF EXISTS "DM can update all sheets" ON character_sheets;
      CREATE POLICY "DM can view all sheets" ON character_sheets FOR SELECT USING (
        auth.jwt() ->> 'email' = 'deltamike@bloodborne.com'
      );
      CREATE POLICY "DM can update all sheets" ON character_sheets FOR UPDATE USING (
        auth.jwt() ->> 'email' = 'deltamike@bloodborne.com'
      );
    `;

    await client.query(sql);
    console.log('Database migrated successfully!');
  } catch (err) {
    console.error('Error migrating DB:', err);
  } finally {
    await client.end();
  }
}

setupDb();
