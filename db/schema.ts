import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const services = sqliteTable("services", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  durationMinutes: integer("duration_minutes").notNull(),
  priceCents: integer("price_cents"),
  active: integer("active").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const staff = sqliteTable("staff", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  active: integer("active").notNull().default(1),
});

export const staffServices = sqliteTable("staff_services", {
  staffId: text("staff_id").notNull().references(() => staff.id),
  serviceId: text("service_id").notNull().references(() => services.id),
}, (table) => [primaryKey({ columns: [table.staffId, table.serviceId] })]);

export const bookings = sqliteTable("bookings", {
  id: text("id").primaryKey(),
  serviceId: text("service_id").notNull().references(() => services.id),
  staffId: text("staff_id").notNull().references(() => staff.id),
  date: text("date").notNull(),
  time: text("time").notNull(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  status: text("status").notNull().default("confirmed"),
  cancelTokenHash: text("cancel_token_hash").notNull(),
  smsStatus: text("sms_status").notNull().default("pending"),
  createdAt: text("created_at").notNull(),
});

export const slotLocks = sqliteTable("slot_locks", {
  staffId: text("staff_id").notNull(),
  date: text("date").notNull(),
  time: text("time").notNull(),
  bookingId: text("booking_id").notNull().references(() => bookings.id),
}, (table) => [primaryKey({ columns: [table.staffId, table.date, table.time] })]);

export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  resetAt: integer("reset_at").notNull(),
});
