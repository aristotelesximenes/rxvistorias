import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const inspections = sqliteTable('inspections', {
  id: text('id').primaryKey(),
  document: text('document').notNull(),
  revision: integer('revision').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
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
