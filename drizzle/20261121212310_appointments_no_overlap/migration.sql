-- Double-booking guard: two active appointments for the same pro can never overlap in time.
-- btree_gist lets one rule compare the pro (equal) and the time range (overlapping) together.
-- Cancelled appointments and no-shows don't block the time slot.
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_no_overlap"
  EXCLUDE USING gist ("pro_id" WITH =, tstzrange("starts_at", "ends_at") WITH &&)
  WHERE ("status" NOT IN ('cancelled', 'no_show'));
