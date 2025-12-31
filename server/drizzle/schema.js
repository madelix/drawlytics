// server/drizzle/schema.js
import {
  pgTable,
  serial,
  integer,
  smallint,
  date,
  timestamp,
  varchar,
  numeric,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/* =========================
   EuroMillions draws
========================= */
export const euromillions_draws = pgTable('euromillions_draws', {
  id: serial('id').primaryKey(),
  draw_date: date('draw_date').notNull(),

  n1: smallint('n1').notNull(),
  n2: smallint('n2').notNull(),
  n3: smallint('n3').notNull(),
  n4: smallint('n4').notNull(),
  n5: smallint('n5').notNull(),

  s1: smallint('s1').notNull(),
  s2: smallint('s2').notNull(),

  created_at: timestamp('created_at').defaultNow().notNull(),
});

/* =========================
   Predictions (generated lines)
========================= */
export const predictions = pgTable('predictions', {
  id: serial('id').primaryKey(),

  lottery: varchar('lottery', { length: 40 }).notNull(),

  draw_date: date('draw_date').notNull(),
  model_name: varchar('model_name', { length: 120 }).notNull(),

  main_numbers: smallint('main_numbers').array().notNull(),
  star_numbers: smallint('star_numbers').array().notNull(),

  confidence: numeric('confidence', { precision: 5, scale: 2 }).notNull(),

  status: varchar('status', { length: 24 }).default('pending').notNull(),

  matched_main: smallint('matched_main'),
  matched_stars: smallint('matched_stars'),
  result_label: varchar('result_label', { length: 24 }),

  created_at: timestamp('created_at').defaultNow().notNull(),
});

/* =========================
   Played prediction lines (what you actually played)
========================= */
export const played_predictions = pgTable(
  'played_predictions',
  {
    id: serial('id').primaryKey(),

    // Keep these for fast filtering without needing a join
    lottery: varchar('lottery', { length: 40 }).notNull(),
    draw_date: date('draw_date').notNull(),

    // snapshot of model name at time played (useful if model naming changes later)
    model_name: varchar('model_name', { length: 120 }).notNull(),

    // ✅ integer FK (NOT serial)
    prediction_id: integer('prediction_id')
      .notNull()
      .references(() => predictions.id, { onDelete: 'cascade' }),

    played_at: timestamp('played_at', { withTimezone: true })
      .defaultNow()
      .notNull(),

    notes: text('notes'),
  },
  (t) => ({
    one_per_prediction: uniqueIndex(
      'played_predictions_lottery_draw_prediction_unique',
    ).on(t.lottery, t.draw_date, t.prediction_id),
  }),
);
