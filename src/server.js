import { config } from './config/env.js';
import { connectDB } from './config/db.js';
import { createApp } from './app.js';

async function main() {
  await connectDB();
  console.log(`[db] connected to MongoDB database "${config.mongoDb}"`);
  const app = createApp();
  app.listen(config.port, () => {
    console.log(`[http] Clinic QMS running at http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  console.error('[fatal] failed to start:', err.message);
  process.exit(1);
});
