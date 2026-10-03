import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  crea: text('crea').notNull().default(''),
  rnp: text('rnp').notNull().default(''),
  phone: text('phone').notNull().default(''),
  passwordSalt: text('password_salt').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('engineer'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, table => [uniqueIndex('idx_users_email').on(table.email)]);
export const sessions = sqliteTable('sessions', {
  tokenHash: text('token_hash').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at').notNull(),
  createdAt: integer('created_at').notNull(),
}, table => [index('idx_sessions_user').on(table.userId)]);
export const authLimits = sqliteTable('auth_limits', {
  key: text('key').primaryKey(),
  windowStart: integer('window_start').notNull(),
  attempts: integer('attempts').notNull(),
});
export const inspections = sqliteTable('inspections', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').references(() => users.id),
  document: text('document').notNull(),
  revision: integer('revision').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, table => [index('idx_inspections_owner_updated').on(table.ownerId, table.updatedAt)]);
export const photos = sqliteTable('photos', {
  id: text('id').primaryKey(),
  inspectionId: text('inspection_id').notNull().references(() => inspections.id, { onDelete: 'cascade' }),
  itemId: text('item_id').notNull(),
  objectKey: text('object_key').notNull(),
  mime: text('mime').notNull(),
  filename: text('filename').notNull(),
  bytes: integer('bytes').notNull(),
}, (table) => [index('idx_photos_inspection').on(table.inspectionId)]);
export const brandAssets = sqliteTable('brand_assets', {
  slot: text('slot').primaryKey(),
  objectKey: text('object_key').notNull(),
  mime: text('mime').notNull(),
  filename: text('filename').notNull(),
  updatedAt: text('updated_at').notNull(),
});
