-- Live status: "on_break" is replaced by "unavailable".
-- Drop the old rule, move anyone still marked on_break to unavailable, then add the new rule.
ALTER TABLE "pro_profiles" DROP CONSTRAINT "pro_profiles_live_status_check";--> statement-breakpoint
UPDATE "pro_profiles" SET "live_status" = 'unavailable' WHERE "live_status" = 'on_break';--> statement-breakpoint
ALTER TABLE "pro_profiles" ADD CONSTRAINT "pro_profiles_live_status_check" CHECK ("live_status" in ('available', 'with_client', 'unavailable'));
