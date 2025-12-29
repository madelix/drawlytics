// server/scripts/guardProd.js
const url = process.env.DATABASE_URL || '';

const looksLikeRailwayProxy =
  url.includes('.proxy.rlwy.net') || url.includes('railway.app');

const isProd =
  process.env.NODE_ENV === 'production' ||
  process.env.RAILWAY_ENVIRONMENT === 'production' ||
  looksLikeRailwayProxy;

// If it's prod-ish, require an explicit confirmation flag
if (isProd && process.env.CONFIRM_PROD !== 'YES') {
  console.error(
    '\n❌ Refusing to run migrations against a production-like database.\n',
  );
  console.error(
    'DATABASE_URL:',
    url ? url.replace(/:\/\/.*@/, '://***@') : '(missing)',
  );
  console.error('\nIf you REALLY mean it, run:\n');
  console.error('  CONFIRM_PROD=YES pnpm migrate:prod\n');
  process.exit(1);
}

console.log('✅ Migration guard passed.');
