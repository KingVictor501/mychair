CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"shop_id" uuid NOT NULL,
	"pro_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"payment_status" text,
	"price_cents" integer NOT NULL,
	"checked_in_at" timestamp with time zone,
	"chair_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appointments_status_check" CHECK ("status" in ('waiting', 'in_chair', 'completed', 'no_show', 'cancelled')),
	CONSTRAINT "appointments_payment_check" CHECK ("payment_status" is null or "payment_status" in ('paid', 'deposit_held', 'cash')),
	CONSTRAINT "appointments_time_check" CHECK ("starts_at" < "ends_at")
);
--> statement-breakpoint
CREATE TABLE "availability_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"pro_id" uuid NOT NULL,
	"weekday" integer NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"kind" text DEFAULT 'work' NOT NULL,
	CONSTRAINT "availability_weekday_check" CHECK ("weekday" between 0 and 6),
	CONSTRAINT "availability_kind_check" CHECK ("kind" in ('work', 'break')),
	CONSTRAINT "availability_order_check" CHECK ("start_time" < "end_time")
);
--> statement-breakpoint
CREATE TABLE "client_profiles" (
	"user_id" uuid PRIMARY KEY,
	"no_show_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pro_profiles" (
	"user_id" uuid PRIMARY KEY,
	"title" text NOT NULL,
	"station_number" text,
	"pay_type" text,
	"pay_amount" integer,
	"live_status" text DEFAULT 'available' NOT NULL,
	"price_mode" text DEFAULT 'standard' NOT NULL,
	"bio" text,
	CONSTRAINT "pro_profiles_live_status_check" CHECK ("live_status" in ('available', 'with_client', 'on_break')),
	CONSTRAINT "pro_profiles_price_mode_check" CHECK ("price_mode" in ('standard', 'custom')),
	CONSTRAINT "pro_profiles_pay_type_check" CHECK ("pay_type" is null or "pay_type" in ('chair_rent', 'commission'))
);
--> statement-breakpoint
CREATE TABLE "pro_services" (
	"pro_id" uuid,
	"service_id" uuid,
	"custom_price_cents" integer,
	CONSTRAINT "pro_services_pkey" PRIMARY KEY("pro_id","service_id")
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"shop_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"duration_min" integer NOT NULL,
	"standard_price_cents" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "services_shop_name_unique" UNIQUE("shop_id","name"),
	CONSTRAINT "services_duration_check" CHECK ("duration_min" > 0),
	CONSTRAINT "services_price_check" CHECK ("standard_price_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "shops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"slug" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"business_type" text NOT NULL,
	"timezone" text NOT NULL,
	"booking_window_days" integer DEFAULT 5 NOT NULL,
	"cancellation_window_hours" integer DEFAULT 2 NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shops_business_type_check" CHECK ("business_type" in ('barbershop', 'nail_salon', 'lash_studio'))
);
--> statement-breakpoint
CREATE TABLE "style_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"shop_id" uuid NOT NULL,
	"pro_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"preferences" jsonb,
	"notes" text,
	"usual_service_id" uuid,
	"time_estimate_min" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "style_cards_pro_client_unique" UNIQUE("pro_id","client_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"shop_id" uuid,
	"role" text NOT NULL,
	"name" text NOT NULL,
	"email" text UNIQUE,
	"phone" text UNIQUE,
	"password_hash" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_role_check" CHECK ("role" in ('super_admin', 'owner', 'pro', 'client')),
	CONSTRAINT "users_shop_check" CHECK (("role" = 'super_admin') = ("shop_id" is null))
);
--> statement-breakpoint
CREATE INDEX "appointments_pro_time_idx" ON "appointments" ("pro_id","starts_at");--> statement-breakpoint
CREATE INDEX "appointments_shop_time_idx" ON "appointments" ("shop_id","starts_at");--> statement-breakpoint
CREATE INDEX "appointments_client_idx" ON "appointments" ("client_id");--> statement-breakpoint
CREATE INDEX "availability_pro_idx" ON "availability_rules" ("pro_id");--> statement-breakpoint
CREATE INDEX "users_shop_role_idx" ON "users" ("shop_id","role");--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_shop_id_shops_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_pro_id_users_id_fkey" FOREIGN KEY ("pro_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_client_id_users_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_services_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_pro_id_users_id_fkey" FOREIGN KEY ("pro_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "pro_profiles" ADD CONSTRAINT "pro_profiles_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "pro_services" ADD CONSTRAINT "pro_services_pro_id_users_id_fkey" FOREIGN KEY ("pro_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "pro_services" ADD CONSTRAINT "pro_services_service_id_services_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_shop_id_shops_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "style_cards" ADD CONSTRAINT "style_cards_shop_id_shops_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "style_cards" ADD CONSTRAINT "style_cards_pro_id_users_id_fkey" FOREIGN KEY ("pro_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "style_cards" ADD CONSTRAINT "style_cards_client_id_users_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "style_cards" ADD CONSTRAINT "style_cards_usual_service_id_services_id_fkey" FOREIGN KEY ("usual_service_id") REFERENCES "services"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_shop_id_shops_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE;