import { pgTable, index, foreignKey, check, uuid, text, numeric, timestamp, date, boolean, jsonb, time, integer, unique, varchar } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

// Tabela de autenticação (substitui auth.users do Supabase). Usada pelo Auth.js.
export const users = pgTable("users", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	email: text().notNull(),
	passwordHash: text("password_hash"),
	emailVerified: timestamp("email_verified", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('utc'::text, now())`).notNull(),
}, (table) => [
	unique("users_email_key").on(table.email),
]);

export const sales = pgTable("sales", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	organizationId: uuid("organization_id"),
	clientName: text("client_name").notNull(),
	totalValue: numeric("total_value").default('0').notNull(),
	receivedValue: numeric("received_value").default('0').notNull(),
	status: text().default('Orçamento').notNull(),
	commissionCarpenterPercent: numeric("commission_carpenter_percent").default('0').notNull(),
	commissionSellerPercent: numeric("commission_seller_percent").default('0').notNull(),
	rtArchitectPercent: numeric("rt_architect_percent").default('0').notNull(),
	freightCost: numeric("freight_cost").default('0').notNull(),
	mealsCost: numeric("meals_cost").default('0').notNull(),
	rawMaterialCost: numeric("raw_material_cost").default('0').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('utc'::text, now())`).notNull(),
	clientId: uuid("client_id"),
	architectId: uuid("architect_id"),
	sellerId: uuid("seller_id"),
	carpenterId: uuid("carpenter_id"),
	deliveryDate: date("delivery_date"),
	kanbanType: text("kanban_type").default('production'),
	kanbanStageId: uuid("kanban_stage_id"),
	notes: text(),
}, (table) => [
	index("idx_sales_carpenter").using("btree", table.carpenterId.asc().nullsLast()),
	index("idx_sales_delivery").using("btree", table.organizationId.asc().nullsLast(), table.deliveryDate.asc().nullsLast()),
	index("idx_sales_seller").using("btree", table.sellerId.asc().nullsLast()),
	foreignKey({ columns: [table.kanbanStageId], foreignColumns: [kanbanStages.id], name: "fk_sales_kanban_stage" }).onDelete("set null"),
	foreignKey({ columns: [table.architectId], foreignColumns: [architects.id], name: "sales_architect_id_fkey" }).onDelete("set null"),
	foreignKey({ columns: [table.carpenterId], foreignColumns: [profiles.id], name: "sales_carpenter_id_fkey" }).onDelete("set null"),
	foreignKey({ columns: [table.clientId], foreignColumns: [clients.id], name: "sales_client_id_fkey" }).onDelete("set null"),
	foreignKey({ columns: [table.organizationId], foreignColumns: [organizations.id], name: "sales_organization_id_fkey" }).onDelete("cascade"),
	foreignKey({ columns: [table.sellerId], foreignColumns: [profiles.id], name: "sales_seller_id_fkey" }).onDelete("set null"),
	check("sales_kanban_type_check", sql`kanban_type = ANY (ARRAY['sales'::text, 'production'::text])`),
]);

export const inventory = pgTable("inventory", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	organizationId: uuid("organization_id"),
	category: text(),
	brand: text(),
	nameOrColor: text("name_or_color"),
	thickness: numeric(),
	quantity: numeric().default('0').notNull(),
	costPerUnit: numeric("cost_per_unit").default('0').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('utc'::text, now())`).notNull(),
}, (table) => [
	foreignKey({ columns: [table.organizationId], foreignColumns: [organizations.id], name: "inventory_organization_id_fkey" }).onDelete("cascade"),
	check("inventory_category_check", sql`category = ANY (ARRAY['MDF'::text, 'Ferragem'::text])`),
]);

export const expenses = pgTable("expenses", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	organizationId: uuid("organization_id"),
	saleId: uuid("sale_id"),
	description: text().notNull(),
	amount: numeric().notNull(),
	expenseType: text("expense_type"),
	dateIncurred: date("date_incurred").default(sql`CURRENT_DATE`).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('utc'::text, now())`).notNull(),
}, (table) => [
	foreignKey({ columns: [table.organizationId], foreignColumns: [organizations.id], name: "expenses_organization_id_fkey" }).onDelete("cascade"),
	foreignKey({ columns: [table.saleId], foreignColumns: [sales.id], name: "expenses_sale_id_fkey" }).onDelete("set null"),
	check("expenses_expense_type_check", sql`expense_type = ANY (ARRAY['Fixed'::text, 'Direct'::text])`),
]);

export const stockMovements = pgTable("stock_movements", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	organizationId: uuid("organization_id"),
	inventoryId: uuid("inventory_id"),
	saleId: uuid("sale_id"),
	movementType: text("movement_type").notNull(),
	quantity: numeric().default('0').notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('utc'::text, now())`).notNull(),
}, (table) => [
	foreignKey({ columns: [table.inventoryId], foreignColumns: [inventory.id], name: "stock_movements_inventory_id_fkey" }).onDelete("cascade"),
	foreignKey({ columns: [table.organizationId], foreignColumns: [organizations.id], name: "stock_movements_organization_id_fkey" }).onDelete("cascade"),
	foreignKey({ columns: [table.saleId], foreignColumns: [sales.id], name: "stock_movements_sale_id_fkey" }).onDelete("set null"),
	check("stock_movements_movement_type_check", sql`movement_type = ANY (ARRAY['IN'::text, 'OUT'::text])`),
]);

export const installments = pgTable("installments", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	organizationId: uuid("organization_id"),
	saleId: uuid("sale_id"),
	description: text().default('Parcela').notNull(),
	amount: numeric().default('0').notNull(),
	dueDate: date("due_date").notNull(),
	paid: boolean().default(false).notNull(),
	paidAt: timestamp("paid_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('utc'::text, now())`).notNull(),
}, (table) => [
	foreignKey({ columns: [table.organizationId], foreignColumns: [organizations.id], name: "installments_organization_id_fkey" }).onDelete("cascade"),
	foreignKey({ columns: [table.saleId], foreignColumns: [sales.id], name: "installments_sale_id_fkey" }).onDelete("cascade"),
]);

export const clients = pgTable("clients", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	organizationId: uuid("organization_id"),
	name: text().notNull(),
	phone: text(),
	email: text(),
	address: text(),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('utc'::text, now())`).notNull(),
	cpf: text(),
}, (table) => [
	foreignKey({ columns: [table.organizationId], foreignColumns: [organizations.id], name: "clients_organization_id_fkey" }).onDelete("cascade"),
]);

export const architects = pgTable("architects", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	organizationId: uuid("organization_id"),
	name: text().notNull(),
	phone: text(),
	email: text(),
	defaultRtPercent: numeric("default_rt_percent").default('5').notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('utc'::text, now())`).notNull(),
}, (table) => [
	foreignKey({ columns: [table.organizationId], foreignColumns: [organizations.id], name: "architects_organization_id_fkey" }).onDelete("cascade"),
]);

export const projectMessages = pgTable("project_messages", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	saleId: uuid("sale_id").notNull(),
	profileId: uuid("profile_id"),
	message: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('utc'::text, now())`).notNull(),
}, (table) => [
	index("idx_project_messages_org").using("btree", table.organizationId.asc().nullsLast(), table.createdAt.desc().nullsFirst()),
	index("idx_project_messages_sale").using("btree", table.saleId.asc().nullsLast(), table.createdAt.asc().nullsLast()),
	foreignKey({ columns: [table.organizationId], foreignColumns: [organizations.id], name: "project_messages_organization_id_fkey" }).onDelete("cascade"),
	foreignKey({ columns: [table.profileId], foreignColumns: [profiles.id], name: "project_messages_profile_id_fkey" }).onDelete("set null"),
	foreignKey({ columns: [table.saleId], foreignColumns: [sales.id], name: "project_messages_sale_id_fkey" }).onDelete("cascade"),
]);

export const auditLogs = pgTable("audit_logs", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	organizationId: uuid("organization_id"),
	userId: uuid("user_id"),
	tableName: text("table_name").notNull(),
	recordId: uuid("record_id"),
	action: text().notNull(),
	oldData: jsonb("old_data"),
	newData: jsonb("new_data"),
	ipAddress: text("ip_address"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('utc'::text, now())`).notNull(),
}, (table) => [
	index("idx_audit_logs_org").using("btree", table.organizationId.asc().nullsLast(), table.createdAt.desc().nullsFirst()),
	index("idx_audit_logs_record").using("btree", table.recordId.asc().nullsLast()),
	index("idx_audit_logs_table").using("btree", table.tableName.asc().nullsLast(), table.createdAt.desc().nullsFirst()),
	index("idx_audit_logs_user").using("btree", table.userId.asc().nullsLast(), table.createdAt.desc().nullsFirst()),
	foreignKey({ columns: [table.organizationId], foreignColumns: [organizations.id], name: "audit_logs_organization_id_fkey" }).onDelete("set null"),
	foreignKey({ columns: [table.userId], foreignColumns: [profiles.id], name: "audit_logs_user_id_fkey" }).onDelete("set null"),
	check("audit_logs_action_check", sql`action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])`),
]);

export const calendarEvents = pgTable("calendar_events", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	saleId: uuid("sale_id"),
	createdBy: uuid("created_by"),
	title: text().notNull(),
	description: text(),
	eventType: text("event_type").default('delivery'),
	eventDate: date("event_date").notNull(),
	eventTime: time("event_time"),
	isPrivate: boolean("is_private").default(false),
	color: text().default('#6366f1'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('utc'::text, now())`).notNull(),
}, (table) => [
	index("idx_calendar_events_org").using("btree", table.organizationId.asc().nullsLast(), table.eventDate.asc().nullsLast()),
	foreignKey({ columns: [table.createdBy], foreignColumns: [profiles.id], name: "calendar_events_created_by_fkey" }).onDelete("set null"),
	foreignKey({ columns: [table.organizationId], foreignColumns: [organizations.id], name: "calendar_events_organization_id_fkey" }).onDelete("cascade"),
	foreignKey({ columns: [table.saleId], foreignColumns: [sales.id], name: "calendar_events_sale_id_fkey" }).onDelete("cascade"),
	check("calendar_events_event_type_check", sql`event_type = ANY (ARRAY['delivery'::text, 'budget'::text, 'meeting'::text, 'installation'::text, 'other'::text])`),
]);

export const projectFiles = pgTable("project_files", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	saleId: uuid("sale_id").notNull(),
	uploadedBy: uuid("uploaded_by"),
	fileName: text("file_name").notNull(),
	filePath: text("file_path").notNull(),
	fileType: text("file_type"),
	fileSize: integer("file_size"),
	description: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('utc'::text, now())`).notNull(),
}, (table) => [
	index("idx_project_files_sale").using("btree", table.saleId.asc().nullsLast()),
	foreignKey({ columns: [table.organizationId], foreignColumns: [organizations.id], name: "project_files_organization_id_fkey" }).onDelete("cascade"),
	foreignKey({ columns: [table.saleId], foreignColumns: [sales.id], name: "project_files_sale_id_fkey" }).onDelete("cascade"),
	foreignKey({ columns: [table.uploadedBy], foreignColumns: [profiles.id], name: "project_files_uploaded_by_fkey" }).onDelete("set null"),
]);

export const priceTableItems = pgTable("price_table_items", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	position: integer().default(0).notNull(),
	name: text().notNull(),
	pricePrazo: numeric("price_prazo", { precision: 10, scale:  2 }).default('0').notNull(),
	priceAvista: numeric("price_avista", { precision: 10, scale:  2 }).default('0').notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('utc'::text, now())`).notNull(),
}, (table) => [
	index("idx_price_items_org").using("btree", table.organizationId.asc().nullsLast(), table.position.asc().nullsLast()),
	foreignKey({ columns: [table.organizationId], foreignColumns: [organizations.id], name: "price_table_items_organization_id_fkey" }).onDelete("cascade"),
]);

export const budgets = pgTable("budgets", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	saleId: uuid("sale_id"),
	clientId: uuid("client_id"),
	clientName: text("client_name").notNull(),
	clientAddress: text("client_address"),
	budgetNumber: text("budget_number"),
	paymentType: text("payment_type").default('both').notNull(),
	totalPrazo: numeric("total_prazo", { precision: 10, scale:  2 }).default('0').notNull(),
	totalAvista: numeric("total_avista", { precision: 10, scale:  2 }).default('0').notNull(),
	prazoEntryPercent: numeric("prazo_entry_percent", { precision: 5, scale:  2 }).default('30').notNull(),
	prazoInstallments: integer("prazo_installments").default(12).notNull(),
	avistaDiscountPercent: numeric("avista_discount_percent", { precision: 5, scale:  2 }).default('10').notNull(),
	avistaEntryPercent: numeric("avista_entry_percent", { precision: 5, scale:  2 }).default('50').notNull(),
	observations: text(),
	status: text().default('draft').notNull(),
	publicToken: uuid("public_token").default(sql`uuid_generate_v4()`),
	createdBy: uuid("created_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('utc'::text, now())`).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('utc'::text, now())`).notNull(),
}, (table) => [
	index("idx_budgets_client").using("btree", table.clientId.asc().nullsLast()),
	index("idx_budgets_org").using("btree", table.organizationId.asc().nullsLast(), table.createdAt.desc().nullsFirst()),
	index("idx_budgets_sale").using("btree", table.saleId.asc().nullsLast()),
	index("idx_budgets_token").using("btree", table.publicToken.asc().nullsLast()),
	foreignKey({ columns: [table.clientId], foreignColumns: [clients.id], name: "budgets_client_id_fkey" }).onDelete("set null"),
	foreignKey({ columns: [table.createdBy], foreignColumns: [profiles.id], name: "budgets_created_by_fkey" }).onDelete("set null"),
	foreignKey({ columns: [table.organizationId], foreignColumns: [organizations.id], name: "budgets_organization_id_fkey" }).onDelete("cascade"),
	foreignKey({ columns: [table.saleId], foreignColumns: [sales.id], name: "budgets_sale_id_fkey" }).onDelete("set null"),
	unique("budgets_public_token_key").on(table.publicToken),
	check("budgets_payment_type_check", sql`payment_type = ANY (ARRAY['prazo'::text, 'avista'::text, 'both'::text])`),
	check("budgets_status_check", sql`status = ANY (ARRAY['draft'::text, 'sent'::text, 'approved'::text, 'rejected'::text])`),
]);

export const budgetEnvironments = pgTable("budget_environments", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	budgetId: uuid("budget_id").notNull(),
	name: text().notNull(),
	position: integer().default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('utc'::text, now())`).notNull(),
}, (table) => [
	index("idx_budget_envs_budget").using("btree", table.budgetId.asc().nullsLast(), table.position.asc().nullsLast()),
	foreignKey({ columns: [table.budgetId], foreignColumns: [budgets.id], name: "budget_environments_budget_id_fkey" }).onDelete("cascade"),
]);

export const budgetItems = pgTable("budget_items", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	budgetId: uuid("budget_id").notNull(),
	environmentId: uuid("environment_id").notNull(),
	priceTableItemId: uuid("price_table_item_id"),
	description: text().notNull(),
	qty: numeric({ precision: 10, scale:  2 }).default('1').notNull(),
	altCm: numeric("alt_cm", { precision: 10, scale:  2 }).default('0').notNull(),
	largCm: numeric("larg_cm", { precision: 10, scale:  2 }).default('0').notNull(),
	profCm: numeric("prof_cm", { precision: 10, scale:  2 }).default('0').notNull(),
	pricePrazoM2: numeric("price_prazo_m2", { precision: 10, scale:  2 }).default('0').notNull(),
	priceAvistaM2: numeric("price_avista_m2", { precision: 10, scale:  2 }).default('0').notNull(),
	valuePrazo: numeric("value_prazo", { precision: 10, scale:  2 }).generatedAlwaysAs(sql`round(((((alt_cm * larg_cm) / 10000.0) * price_prazo_m2) * qty), 2)`),
	valueAvista: numeric("value_avista", { precision: 10, scale:  2 }).generatedAlwaysAs(sql`round(((((alt_cm * larg_cm) / 10000.0) * price_avista_m2) * qty), 2)`),
	isActive: boolean("is_active").default(true).notNull(),
	position: integer().default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('utc'::text, now())`).notNull(),
}, (table) => [
	index("idx_budget_items_budget").using("btree", table.budgetId.asc().nullsLast()),
	index("idx_budget_items_env").using("btree", table.environmentId.asc().nullsLast(), table.position.asc().nullsLast()),
	foreignKey({ columns: [table.budgetId], foreignColumns: [budgets.id], name: "budget_items_budget_id_fkey" }).onDelete("cascade"),
	foreignKey({ columns: [table.environmentId], foreignColumns: [budgetEnvironments.id], name: "budget_items_environment_id_fkey" }).onDelete("cascade"),
	foreignKey({ columns: [table.priceTableItemId], foreignColumns: [priceTableItems.id], name: "budget_items_price_table_item_id_fkey" }).onDelete("set null"),
]);

export const organizations = pgTable("organizations", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	name: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('utc'::text, now())`).notNull(),
	cnpj: text(),
	phone: text(),
	address: text(),
	city: text(),
	state: varchar({ length: 2 }),
	logoUrl: text("logo_url"),
	colorTheme: text("color_theme").default('blue'),
	plan: text().default('basic'),
	planStart: date("plan_start"),
	planEnd: date("plan_end"),
	isActive: boolean("is_active").default(true),
	defaultPaymentType: text("default_payment_type").default('both'),
	defaultPrazoEntryPercent: numeric("default_prazo_entry_percent").default('30'),
	defaultPrazoInstallments: integer("default_prazo_installments").default(12),
	defaultAvistaDiscountPercent: numeric("default_avista_discount_percent").default('10'),
	defaultAvistaEntryPercent: numeric("default_avista_entry_percent").default('50'),
	email: text(),
	defaultBudgetObservations: text("default_budget_observations"),
	companyName: text("company_name"),
	stateRegistration: text("state_registration"),
	ownerName: text("owner_name"),
	ownerCpf: text("owner_cpf"),
	ownerPhone: text("owner_phone"),
	budgetValidityDays: integer("budget_validity_days").default(30),
}, (table) => [
	check("organizations_plan_check", sql`plan = ANY (ARRAY['basic'::text, 'pro'::text, 'enterprise'::text])`),
]);

export const commissions = pgTable("commissions", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	saleId: uuid("sale_id").notNull(),
	profileId: uuid("profile_id").notNull(),
	commissionType: text("commission_type").notNull(),
	baseAmount: numeric("base_amount").default('0').notNull(),
	percent: numeric().default('0').notNull(),
	amount: numeric().default('0').notNull(),
	status: text().default('pending'),
	paidAt: timestamp("paid_at", { withTimezone: true, mode: 'string' }),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('utc'::text, now())`).notNull(),
}, (table) => [
	index("idx_commissions_org").using("btree", table.organizationId.asc().nullsLast(), table.status.asc().nullsLast()),
	index("idx_commissions_profile").using("btree", table.profileId.asc().nullsLast(), table.status.asc().nullsLast()),
	index("idx_commissions_sale").using("btree", table.saleId.asc().nullsLast()),
	foreignKey({ columns: [table.organizationId], foreignColumns: [organizations.id], name: "commissions_organization_id_fkey" }).onDelete("cascade"),
	foreignKey({ columns: [table.profileId], foreignColumns: [profiles.id], name: "commissions_profile_id_fkey" }).onDelete("cascade"),
	foreignKey({ columns: [table.saleId], foreignColumns: [sales.id], name: "commissions_sale_id_fkey" }).onDelete("cascade"),
	check("commissions_commission_type_check", sql`commission_type = ANY (ARRAY['seller'::text, 'carpenter'::text, 'architect_rt'::text])`),
	check("commissions_status_check", sql`status = ANY (ARRAY['pending'::text, 'paid'::text, 'cancelled'::text])`),
]);

export const purchases = pgTable("purchases", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	supplierId: uuid("supplier_id"),
	saleId: uuid("sale_id"),
	description: text().notNull(),
	amount: numeric().default('0').notNull(),
	quantity: numeric().default('1'),
	unit: text(),
	purchaseDate: date("purchase_date").default(sql`CURRENT_DATE`).notNull(),
	invoiceNumber: text("invoice_number"),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('utc'::text, now())`).notNull(),
}, (table) => [
	index("idx_purchases_org_date").using("btree", table.organizationId.asc().nullsLast(), table.purchaseDate.desc().nullsFirst()),
	index("idx_purchases_sale").using("btree", table.saleId.asc().nullsLast()),
	foreignKey({ columns: [table.organizationId], foreignColumns: [organizations.id], name: "purchases_organization_id_fkey" }).onDelete("cascade"),
	foreignKey({ columns: [table.saleId], foreignColumns: [sales.id], name: "purchases_sale_id_fkey" }).onDelete("set null"),
	foreignKey({ columns: [table.supplierId], foreignColumns: [suppliers.id], name: "purchases_supplier_id_fkey" }).onDelete("set null"),
]);

export const suppliers = pgTable("suppliers", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	name: text().notNull(),
	cnpjCpf: text("cnpj_cpf"),
	phone: text(),
	email: text(),
	address: text(),
	contactName: text("contact_name"),
	notes: text(),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('utc'::text, now())`).notNull(),
}, (table) => [
	index("idx_suppliers_org").using("btree", table.organizationId.asc().nullsLast(), table.isActive.asc().nullsLast()),
	foreignKey({ columns: [table.organizationId], foreignColumns: [organizations.id], name: "suppliers_organization_id_fkey" }).onDelete("cascade"),
]);

export const kanbanStages = pgTable("kanban_stages", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	kanbanType: text("kanban_type").notNull(),
	name: text().notNull(),
	color: text().default('#6366f1'),
	position: integer().default(0).notNull(),
	isFinal: boolean("is_final").default(false),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('utc'::text, now())`).notNull(),
}, (table) => [
	index("idx_kanban_stages_org").using("btree", table.organizationId.asc().nullsLast(), table.kanbanType.asc().nullsLast(), table.position.asc().nullsLast()),
	foreignKey({ columns: [table.organizationId], foreignColumns: [organizations.id], name: "kanban_stages_organization_id_fkey" }).onDelete("cascade"),
	check("kanban_stages_kanban_type_check", sql`kanban_type = ANY (ARRAY['sales'::text, 'production'::text])`),
]);

export const profiles = pgTable("profiles", {
	id: uuid().primaryKey().notNull(),
	organizationId: uuid("organization_id"),
	role: text().notNull(),
	fullName: text("full_name"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('utc'::text, now())`).notNull(),
	address: text(),
	city: text(),
	state: text(),
	cpf: text(),
	phone: text(),
	notes: text(),
	isActive: boolean("is_active").default(true),
	avatarUrl: text("avatar_url"),
	colorTheme: text("color_theme").default('blue'),
}, (table) => [
	foreignKey({ columns: [table.id], foreignColumns: [users.id], name: "profiles_id_fkey" }).onDelete("cascade"),
	foreignKey({ columns: [table.organizationId], foreignColumns: [organizations.id], name: "profiles_organization_id_fkey" }).onDelete("cascade"),
	check("profiles_role_check", sql`role = ANY (ARRAY['sysadmin'::text, 'owner'::text, 'office'::text, 'seller'::text, 'carpenter'::text])`),
]);
