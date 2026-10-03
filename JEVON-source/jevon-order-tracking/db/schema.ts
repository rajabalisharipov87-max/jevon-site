import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";

export const sharedOrders = sqliteTable("shared_orders", {
  token: text("token").primaryKey(),
  payload: text("payload").notNull(),
  ownerPhone: text("owner_phone"),
  updatedAt: text("updated_at").notNull(),
}, table => [index("shared_orders_phone_idx").on(table.ownerPhone)]);

export const clientAccounts = sqliteTable("client_accounts", {
  phone: text("phone").primaryKey(),
  salt: text("salt").notNull(),
  passwordHash: text("password_hash").notNull(),
  codeHash: text("code_hash").unique(),
});
export const clientAttempts = sqliteTable("client_attempts", {
  key: text("key").primaryKey(),
  count: text("count").notNull(),
  until: text("until").notNull(),
});
