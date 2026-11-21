// lib/db/schema.ts
// WHAT IT'S FOR: describes the database TABLES in TypeScript:
//   - log_entries: the saved log lines (logs, metrics, the weekly report).
//   - corpus_chunks: the help-document passages plus their embeddings (the "meaning" numbers).
//   - the shop tables: shops, users, pro_profiles, client_profiles, services, pro_services,
//     availability_rules, appointments, style_cards, and app_settings (for example demo mode).
// WHO USES IT: lib/db/client.ts (so queries know the tables), lib/logger.ts (saves log rows),
// lib/search.ts and scripts/corpus-embed.ts (corpus_chunks), and drizzle-kit (reads this file
// to write the migration SQL in the /drizzle folder).
// WHY THE NAME: "schema" = the blueprint of a database; ".ts" = no screen code.
// Matches docs/data-model.md.

// These builders come from Drizzle (drizzle-orm): one per kind of column.
// "pg-core" means "PostgreSQL basics". "vector" is the column type for embeddings (pgvector).
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  unique,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

// One row per log line. Never holds names, emails, phones, or raw request bodies:
// lib/redact.ts cleans everything before it gets here.
export const logEntries = pgTable(
  "log_entries",
  {
    // A random unique id for the row, made by the database.
    id: uuid("id").defaultRandom().primaryKey(),
    // When it happened. "withTimezone" = stored as an exact moment (see docs/data-model.md: timestamptz).
    ts: timestamp("ts", { withTimezone: true }).defaultNow().notNull(),
    // debug, info, warn or error.
    level: text("level").notNull(),
    // The event name, e.g. request_done. A fact label, not a sentence.
    event: text("event").notNull(),
    // The route pattern, e.g. /api/health. Empty when the line isn't about a request.
    route: text("route"),
    // Which shop / user it was about (IDs only). Empty until accounts exist (Section 3).
    shopId: uuid("shop_id"),
    userId: uuid("user_id"),
    // Ties together the lines from one request.
    requestId: text("request_id"),
    // Everything else (method, status, ms, ...), already cleaned by redaction.
    details: jsonb("details"),
  },
  // Indexes = a book's index: they make the dashboard's "newest first" and "filter by level/event" fast.
  (table) => [
    index("log_entries_ts_idx").on(table.ts),
    index("log_entries_level_ts_idx").on(table.level, table.ts),
    index("log_entries_event_ts_idx").on(table.event, table.ts),
  ],
);

// The size of the list of numbers OpenAI's text-embedding-3-small makes for each text.
export const EMBEDDING_DIMENSIONS = 1536;

// One row per chunk (passage) of the corpus. The corpus FILES stay on your computer; only the
// chunk text and its embedding are stored here. The number of rows is the embedded chunk count.
export const corpusChunks = pgTable(
  "corpus_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Which file the passage came from, e.g. "pro-guide.md".
    source: text("source").notNull(),
    // Where in the file, e.g. "Your clients" or "6. Pay & Timekeeping > Overtime".
    heading: text("heading").notNull(),
    // Order of the passage within its file (0, 1, 2...).
    position: integer("position").notNull(),
    // The passage text itself (shown in search results).
    body: text("body").notNull(),
    // A fingerprint (SHA-256) of the exact text that was embedded. UNIQUE, so embedding the
    // same chunk twice can never make a duplicate row: this is what makes the command re-runnable.
    contentHash: text("content_hash").notNull().unique(),
    // The embedding: 1,536 numbers capturing the passage's MEANING.
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
    // Which embedding model made it, so we never compare numbers from different models.
    model: text("model").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // An HNSW index makes "find the closest passages" fast. "vector_cosine_ops" means it is
    // built for cosine distance, which is how we compare meaning (matches lib/search.ts).
    index("corpus_chunks_embedding_idx").using("hnsw", table.embedding.op("vector_cosine_ops")),
    index("corpus_chunks_source_idx").on(table.source),
  ],
);

// ---------------------------------------------------------------------------------------------
// SHOP TABLES
// Every record that belongs to a shop carries shop_id, so one shop's data can always be told
// apart from another's. "onDelete: cascade" means deleting a shop deletes everything under it,
// which is how demo data is removed in one step (delete the demo shops). See docs/data-model.md.
// ---------------------------------------------------------------------------------------------

// One row per shop (a barbershop, a nail salon, a lash studio).
export const shops = pgTable(
  "shops",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Short name for links, e.g. "fade-factory". Unique.
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    // barbershop, nail_salon or lash_studio.
    businessType: text("business_type").notNull(),
    // IANA time zone name, e.g. America/New_York. Times are stored in UTC and shown in this zone.
    timezone: text("timezone").notNull(),
    // How many days ahead clients can book, and how late they can cancel.
    bookingWindowDays: integer("booking_window_days").notNull().default(5),
    cancellationWindowHours: integer("cancellation_window_hours").notNull().default(2),
    // True for the made-up demo shops. Demo data is added and removed by this flag only.
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [check("shops_business_type_check", sql`${t.businessType} in ('barbershop', 'nail_salon', 'lash_studio')`)],
);

// Everyone who can log in. Pros see only a client's name, phone and style card; the rest of a
// client's row is never sent to them (enforced in the routes, not here).
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // The shop this person belongs to. Empty only for the Super Admin.
    shopId: uuid("shop_id").references(() => shops.id, { onDelete: "cascade" }),
    // super_admin, owner, pro or client.
    role: text("role").notNull(),
    name: text("name").notNull(),
    // Unique when present. Used to log in. Never shown to pros.
    email: text("email").unique(),
    // E.164 format, e.g. +15550101234. Unique when present.
    phone: text("phone").unique(),
    // Only the hash (never the password). Never returned by any route. Empty = can't log in yet.
    passwordHash: text("password_hash"),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check("users_role_check", sql`${t.role} in ('super_admin', 'owner', 'pro', 'client')`),
    // Everyone except the Super Admin must belong to a shop.
    check("users_shop_check", sql`(${t.role} = 'super_admin') = (${t.shopId} is null)`),
    index("users_shop_role_idx").on(t.shopId, t.role),
  ],
);

// Extra fields for people who take appointments (pros, and owners who also work as pros).
export const proProfiles = pgTable(
  "pro_profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    // What clients see, e.g. "Barber", "Nail tech", "Lash artist".
    title: text("title").notNull(),
    stationNumber: text("station_number"),
    // chair_rent or commission. Owner and Super Admin only.
    payType: text("pay_type"),
    // Monthly rent in cents, or commission percent. Owner and Super Admin only.
    payAmount: integer("pay_amount"),
    // available, with_client or on_break.
    liveStatus: text("live_status").notNull().default("available"),
    // standard (the shop's price list) or custom (prices set per service in pro_services).
    priceMode: text("price_mode").notNull().default("standard"),
    bio: text("bio"),
  },
  (t) => [
    check("pro_profiles_live_status_check", sql`${t.liveStatus} in ('available', 'with_client', 'on_break')`),
    check("pro_profiles_price_mode_check", sql`${t.priceMode} in ('standard', 'custom')`),
    check("pro_profiles_pay_type_check", sql`${t.payType} is null or ${t.payType} in ('chair_rent', 'commission')`),
  ],
);

// Extra fields for clients.
export const clientProfiles = pgTable("client_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  // No-show strikes at this shop. They never block booking.
  noShowCount: integer("no_show_count").notNull().default(0),
});

// The shop's service list and standard prices.
export const services = pgTable(
  "services",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull(),
    durationMin: integer("duration_min").notNull(),
    // The shop's standard price, in cents (2500 = $25.00).
    standardPriceCents: integer("standard_price_cents").notNull(),
    active: boolean("active").notNull().default(true),
  },
  (t) => [
    unique("services_shop_name_unique").on(t.shopId, t.name),
    check("services_duration_check", sql`${t.durationMin} > 0`),
    check("services_price_check", sql`${t.standardPriceCents} >= 0`),
  ],
);

// Which pro offers which service. custom_price_cents is used only when the pro's price_mode is
// custom; only an owner or the Super Admin can set it.
export const proServices = pgTable(
  "pro_services",
  {
    proId: uuid("pro_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    customPriceCents: integer("custom_price_cents"),
  },
  (t) => [primaryKey({ columns: [t.proId, t.serviceId] })],
);

// A pro's weekly hours (kind = work) and breaks (kind = break), in the shop's local time.
export const availabilityRules = pgTable(
  "availability_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    proId: uuid("pro_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // 0 = Sunday ... 6 = Saturday.
    weekday: integer("weekday").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    kind: text("kind").notNull().default("work"),
  },
  (t) => [
    check("availability_weekday_check", sql`${t.weekday} between 0 and 6`),
    check("availability_kind_check", sql`${t.kind} in ('work', 'break')`),
    check("availability_order_check", sql`${t.startTime} < ${t.endTime}`),
    index("availability_pro_idx").on(t.proId),
  ],
);

// Bookings. Two active appointments for the same pro can never overlap: a database rule
// (added in the migration "appointments_no_overlap") refuses it, even if a route forgot to check.
export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    proId: uuid("pro_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    // waiting, in_chair, completed, no_show or cancelled.
    status: text("status").notNull().default("waiting"),
    // paid, deposit_held or cash. A record only; no real payments are taken.
    paymentStatus: text("payment_status"),
    // The price when it was booked, in cents. Revenue is the sum of completed appointments.
    priceCents: integer("price_cents").notNull(),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    chairAt: timestamp("chair_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check("appointments_status_check", sql`${t.status} in ('waiting', 'in_chair', 'completed', 'no_show', 'cancelled')`),
    check(
      "appointments_payment_check",
      sql`${t.paymentStatus} is null or ${t.paymentStatus} in ('paid', 'deposit_held', 'cash')`,
    ),
    check("appointments_time_check", sql`${t.startsAt} < ${t.endsAt}`),
    index("appointments_pro_time_idx").on(t.proId, t.startsAt),
    index("appointments_shop_time_idx").on(t.shopId, t.startsAt),
    index("appointments_client_idx").on(t.clientId),
  ],
);

// One style card per pro-and-client pair: how this client likes it, and how long it takes.
export const styleCards = pgTable(
  "style_cards",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    proId: uuid("pro_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Free-form preferences, e.g. { "guard": "#2 on the sides", "beard": "lined up" }.
    preferences: jsonb("preferences").$type<Record<string, string>>(),
    notes: text("notes"),
    usualServiceId: uuid("usual_service_id").references(() => services.id, { onDelete: "set null" }),
    // Pre-filled length for this client's usual service, used when they book.
    timeEstimateMin: integer("time_estimate_min"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique("style_cards_pro_client_unique").on(t.proId, t.clientId)],
);

// App-wide settings as key/value pairs, e.g. key "demo_mode" = { "enabled": true }.
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  // The Super Admin who changed it (ID only).
  updatedBy: uuid("updated_by"),
});
