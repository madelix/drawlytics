import 'dotenv/config';

const API_BASE = process.env.CRON_API_BASE;
const ADMIN_KEY = process.env.ADMIN_KEY;

if (!API_BASE) {
  console.error('CRON_API_BASE is not set');
  process.exit(1);
}

if (!ADMIN_KEY) {
  console.error('ADMIN_KEY is not set');
  process.exit(1);
}

async function run() {
  try {
    const response = await fetch(
      `${API_BASE.replace(/\/$/, '')}/api/cron/euromillions/sync`,
      {
        method: 'POST',
        headers: {
          'x-admin-key': ADMIN_KEY,
        },
      },
    );

    const text = await response.text();

    if (!response.ok) {
      console.error('Cron sync failed:', response.status, text);
      process.exit(1);
    }

    console.log('Cron sync success:', text);
    process.exit(0);
  } catch (err) {
    console.error('Cron sync error:', err);
    process.exit(1);
  }
}

run();
