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
   UK Lotto draws
========================= */
export const uk_lotto_draws = pgTable(
  'uk_lotto_draws',
  {
    id: serial('id').primaryKey(),
    draw_date: date('draw_date').notNull(),

    n1: smallint('n1').notNull(),
    n2: smallint('n2').notNull(),
    n3: smallint('n3').notNull(),
    n4: smallint('n4').notNull(),
    n5: smallint('n5').notNull(),
    n6: smallint('n6').notNull(),

    bonus_ball: smallint('bonus_ball').notNull(),

    created_at: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    uk_lotto_draw_date_unique: uniqueIndex(
      'uk_lotto_draws_draw_date_unique',
    ).on(t.draw_date),
  }),
);

/* =========================
   Set For Life draws
========================= */
export const set_for_life_draws = pgTable(
  'set_for_life_draws',
  {
    id: serial('id').primaryKey(),
    draw_date: date('draw_date').notNull(),

    n1: smallint('n1').notNull(),
    n2: smallint('n2').notNull(),
    n3: smallint('n3').notNull(),
    n4: smallint('n4').notNull(),
    n5: smallint('n5').notNull(),

    life_ball: smallint('life_ball').notNull(),

    created_at: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    set_for_life_draw_date_unique: uniqueIndex(
      'set_for_life_draws_draw_date_unique',
    ).on(t.draw_date),
  }),
);

/* =========================
   Predictions
========================= */
export const predictions = pgTable('predictions', {
  id: serial('id').primaryKey(),
  lottery: varchar('lottery', { length: 32 }).default('euromillions').notNull(),
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
   Played predictions
========================= */
export const played_predictions = pgTable(
  'played_predictions',
  {
    id: serial('id').primaryKey(),
    lottery: varchar('lottery', { length: 40 }).notNull(),
    draw_date: date('draw_date').notNull(),
    prediction_id: integer('prediction_id')
      .notNull()
      .references(() => predictions.id, { onDelete: 'cascade' }),
    played_at: timestamp('played_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    notes: text('notes'),
  },
  (t) => ({
    played_predictions_lottery_draw_prediction_unique: uniqueIndex(
      'played_predictions_lottery_draw_prediction_unique',
    ).on(t.lottery, t.draw_date, t.prediction_id),
  }),
);
