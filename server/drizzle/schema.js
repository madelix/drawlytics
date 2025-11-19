import {
  pgTable,
  serial,
  smallint,
  date,
  timestamp,
} from 'drizzle-orm/pg-core';

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
