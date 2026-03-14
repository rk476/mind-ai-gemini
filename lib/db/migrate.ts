import 'dotenv/config';
import { migrate } from './db';

async function main() {
  console.log('Ensuring database indexes...');
  await migrate();
  console.log('Indexes ready.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Index creation failed:', err);
  process.exit(1);
});
