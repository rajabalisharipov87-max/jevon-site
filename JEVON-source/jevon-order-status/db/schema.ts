import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

export const orderDeadlines = sqliteTable("order_deadlines", {
  orderId: text("order_id").primaryKey(),
  deadline: text("deadline").notNull(),
});

export const orderMaterials = sqliteTable("order_materials", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: text("order_id").notNull(),
  type: text("type").notNull(),
  description: text("description").notNull(),
  thickness: text("thickness").notNull(),
  planned: integer("planned").notNull(),
  supplySource: text("supply_source").notNull().default("client"),
  purchaseUnitPriceCents: integer("purchase_unit_price_cents"),
  purchaseQuantity: integer("purchase_quantity"),
  received: integer("received"),
  condition: text("condition").notNull().default("Ожидаем"),
  note: text("note").notNull().default(""),
  receivedAt: text("received_at"),
  photoKey: text("photo_key"),
});

export const orderDrawings = sqliteTable("order_drawings", {
  orderId: text("order_id").primaryKey(),
  completedAt: text("completed_at").notNull(),
});

export const orderDrawingLinks = sqliteTable("order_drawing_links", {
  orderId: text("order_id").primaryKey(),
  url: text("url").notNull(),
});

export const orderAcceptances = sqliteTable("order_acceptances", {
  orderId: text("order_id").primaryKey(),
  acceptedAt: text("accepted_at").notNull(),
});

export const orderShipments = sqliteTable("order_shipments", {
  orderId: text("order_id").primaryKey(),
  pickedUpAt: text("picked_up_at").notNull(),
});

export const orderStageStatuses = sqliteTable("order_stage_statuses", {
  orderId: text("order_id").notNull(),
  stage: text("stage").notNull(),
  status: text("status").notNull(),
}, table => [primaryKey({ columns: [table.orderId, table.stage] })]);

export const orderShareLinks = sqliteTable("order_share_links", {
  orderId: text("order_id").primaryKey(),
  token: text("token").notNull().unique(),
});

export const syncedOrders = sqliteTable("synced_orders", {
  id: text("id").primaryKey(),
  data: text("data").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const workshopProjects = sqliteTable("workshop_projects", {
 id: integer("id").primaryKey({autoIncrement:true}),
 client: text("client").notNull(),
 phone: text("phone").notNull(),
 createdAt: text("created_at").notNull(),
});

export const workshopProjectItems = sqliteTable("workshop_project_items", {
 id: integer("id").primaryKey({autoIncrement:true}),
 projectId: integer("project_id").notNull().references(()=>workshopProjects.id),
 name: text("name").notNull(),
 quantity: integer("quantity").notNull(),
 unitPriceCents: integer("unit_price_cents").notNull(),
 createdAt: text("created_at").notNull(),
});

export const servicePriceOverrides = sqliteTable('service_price_overrides', {
 type: text('type').primaryKey(),
 priceCents: integer('price_cents').notNull(),
});

export const orderEstimateChanges = sqliteTable('order_estimate_changes', {
 orderId: text('order_id').notNull(),
 rowId: text('row_id').notNull(),
 data: text('data').notNull(),
}, table => [primaryKey({columns:[table.orderId,table.rowId]})]);
