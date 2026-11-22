CREATE TABLE "appointment_services" (
	"appointment_id" uuid,
	"position" integer,
	"service_id" uuid NOT NULL,
	"price_cents" integer NOT NULL,
	"duration_min" integer NOT NULL,
	CONSTRAINT "appointment_services_pkey" PRIMARY KEY("appointment_id","position")
);
--> statement-breakpoint
ALTER TABLE "appointment_services" ADD CONSTRAINT "appointment_services_appointment_id_appointments_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "appointment_services" ADD CONSTRAINT "appointment_services_service_id_services_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE;