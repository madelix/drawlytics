import 'dotenv/config';

const API_BASE = process.env.CRON_API_BASE;
const ADMIN_KEY = process.env.ADMIN_KEY;

const lottery = process.argv[2];

if (!API_BASE) {
  console.error('CRON_API_BASE is not set');
  process.exit(1);
}

if (!ADMIN_KEY) {
  console.error('ADMIN_KEY is not set');
  process.exit(1);
}

if (!lottery) {
  console.error('Missing lottery argument');
  process.exit(1);
}

const endpointMap = {
  euromillions: '/api/cron/euromillions/sync',
  uk_lotto: '/api/cron/uk-lotto/sync',
  set_for_life: '/api/cron/set-for-life/sync',
};

const endpoint = endpointMap[lottery];

if (!endpoint) {
  console.error(`Unknown lottery: ${lottery}`);
  process.exit(1);
}

async function run() {
  try {
    const response = await fetch(`${API_BASE.replace(/\/$/, '')}${endpoint}`, {
      method: 'POST',
      headers: {
        'x-admin-key': ADMIN_KEY,
      },
    });

    const text = await response.text();

    if (!response.ok) {
      console.error('Cron sync failed:', response.status, text);
      process.exit(1);
    }

    console.log(`Cron sync success (${lottery}):`, text);
    process.exit(0);
  } catch (err) {
    console.error(`Cron sync error (${lottery}):`, err);
    process.exit(1);
  }
}

run();
