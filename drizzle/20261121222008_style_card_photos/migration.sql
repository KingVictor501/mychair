CREATE TABLE "style_card_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"style_card_id" uuid NOT NULL,
	"shop_id" uuid NOT NULL,
	"pro_id" uuid NOT NULL,
	"pathname" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"caption" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "style_card_photos_type_check" CHECK ("content_type" in ('image/jpeg', 'image/png', 'image/webp')),
	CONSTRAINT "style_card_photos_size_check" CHECK ("size_bytes" > 0 and "size_bytes" <= 4194304)
);
--> statement-breakpoint
CREATE INDEX "style_card_photos_card_idx" ON "style_card_photos" ("style_card_id");--> statement-breakpoint
ALTER TABLE "style_card_photos" ADD CONSTRAINT "style_card_photos_style_card_id_style_cards_id_fkey" FOREIGN KEY ("style_card_id") REFERENCES "style_cards"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "style_card_photos" ADD CONSTRAINT "style_card_photos_shop_id_shops_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "style_card_photos" ADD CONSTRAINT "style_card_photos_pro_id_users_id_fkey" FOREIGN KEY ("pro_id") REFERENCES "users"("id") ON DELETE CASCADE;