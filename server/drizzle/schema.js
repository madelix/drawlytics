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
export const uk_lotto_draws = pgTable('uk_lotto_draws', {
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
});
