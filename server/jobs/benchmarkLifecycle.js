import { pool } from '../db.js';
import { runBenchmarkForDraw } from '../services/benchmarkRunner.js';
import { checkPredictions } from '../services/checkPredictions.js';

const LOTTERIES = ['euromillions', 'uk_lotto', 'set_for_life'];

async function run() {
  console.log(`[benchmark-lifecycle] started ${new Date().toISOString()}`);

  /*
   * First check existing canonical benchmark predictions.
   *
   * Predictions without an available official result remain pending,
   * so subsequent scheduled runs can safely retry them.
   */
  for (const lottery of LOTTERIES) {
    try {
      const checkResult = await checkPredictions({
        lottery,
        limit: 500,
        onlyUnchecked: true,
        scope: 'benchmark',
      });

      console.log(`[benchmark-lifecycle] check ${lottery}`, checkResult);
    } catch (error) {
      console.error(`[benchmark-lifecycle] check failed for ${lottery}`, error);
    }
  }

  /*
   * Then ensure the next canonical benchmark exists.
   *
   * runBenchmarkForDraw() is idempotent, so existing benchmark
   * predictions are skipped instead of duplicated.
   */
  for (const lottery of LOTTERIES) {
    try {
      const generationResult = await runBenchmarkForDraw({
        lottery,
        dryRun: false,
      });

      console.log(`[benchmark-lifecycle] generate ${lottery}`, {
        ok: generationResult.ok,
        draw_date: generationResult.draw_date,
        generated_count: generationResult.generated_count,
        skipped_count: generationResult.skipped_count,
      });
    } catch (error) {
      console.error(
        `[benchmark-lifecycle] generation failed for ${lottery}`,
        error,
      );
    }
  }

  console.log(`[benchmark-lifecycle] finished ${new Date().toISOString()}`);
}

try {
  await run();
} catch (error) {
  console.error('[benchmark-lifecycle] fatal error', error);

  process.exitCode = 1;
} finally {
  await pool.end();
}
