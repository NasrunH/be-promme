const supabase = require('./src/config/supabase');

async function checkData() {
  const tables = ['users', 'creators', 'brands', 'campaigns', 'submissions', 'wallets', 'audit_logs'];
  
  console.log('--- Database Stats ---');
  for (const table of tables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`${table}: Error fetching count`);
    } else {
      console.log(`${table}: ${count} rows`);
    }
  }
}

checkData();
