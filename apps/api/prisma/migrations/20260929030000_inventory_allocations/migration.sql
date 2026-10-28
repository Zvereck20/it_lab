CREATE TYPE "InventoryMovementType" AS ENUM (
    'STOCK_RECEIPT',
    'MANUAL_DECREASE',
    'ORDER_ALLOCATION',
    'REPAIR_ALLOCATION',
    'ORDER_RETURN',
    'REPAIR_RETURN'
);

ALTER TABLE "orders" ADD COLUMN "number" INTEGER;
WITH numbered_orders AS (
    SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS "number"
    FROM "orders"
)
UPDATE "orders"
SET "number" = numbered_orders."number"
FROM numbered_orders
WHERE "orders"."id" = numbered_orders."id";
CREATE SEQUENCE "orders_number_seq";
SELECT setval(
    '"orders_number_seq"',
    COALESCE((SELECT MAX("number") FROM "orders"), 0) + 1,
    false
);
ALTER TABLE "orders"
    ALTER COLUMN "number" SET DEFAULT nextval('"orders_number_seq"'),
    ALTER COLUMN "number" SET NOT NULL;
ALTER SEQUENCE "orders_number_seq" OWNED BY "orders"."number";

ALTER TABLE "repairs" ADD COLUMN "number" INTEGER;
WITH numbered_repairs AS (
    SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS "number"
    FROM "repairs"
)
UPDATE "repairs"
SET "number" = numbered_repairs."number"
FROM numbered_repairs
WHERE "repairs"."id" = numbered_repairs."id";
CREATE SEQUENCE "repairs_number_seq";
SELECT setval(
    '"repairs_number_seq"',
    COALESCE((SELECT MAX("number") FROM "repairs"), 0) + 1,
    false
);
ALTER TABLE "repairs"
    ALTER COLUMN "number" SET DEFAULT nextval('"repairs_number_seq"'),
    ALTER COLUMN "number" SET NOT NULL;
ALTER SEQUENCE "repairs_number_seq" OWNED BY "repairs"."number";

CREATE UNIQUE INDEX "orders_number_key" ON "orders"("number");
CREATE UNIQUE INDEX "repairs_number_key" ON "repairs"("number");

CREATE TABLE "order_components" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "inventoryItemId" UUID NOT NULL,
    "nameSnapshot" VARCHAR(150) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "order_components_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "order_components_quantity_check" CHECK ("quantity" > 0)
);

CREATE TABLE "repair_components" (
    "id" UUID NOT NULL,
    "repairId" UUID NOT NULL,
    "inventoryItemId" UUID NOT NULL,
    "nameSnapshot" VARCHAR(150) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "repair_components_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "repair_components_quantity_check" CHECK ("quantity" > 0)
);

CREATE TABLE "inventory_movements" (
    "id" UUID NOT NULL,
    "inventoryItemId" UUID NOT NULL,
    "operationType" "InventoryMovementType" NOT NULL,
    "quantityDelta" INTEGER NOT NULL,
    "orderId" UUID,
    "repairId" UUID,
    "performedById" VARCHAR(50) NOT NULL,
    "performedByName" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "inventory_movements_quantity_delta_check" CHECK ("quantityDelta" <> 0),
    CONSTRAINT "inventory_movements_target_check" CHECK (
        "orderId" IS NULL OR "repairId" IS NULL
    )
);

CREATE UNIQUE INDEX "order_components_orderId_inventoryItemId_key"
    ON "order_components"("orderId", "inventoryItemId");
CREATE INDEX "order_components_inventoryItemId_idx"
    ON "order_components"("inventoryItemId");
CREATE UNIQUE INDEX "repair_components_repairId_inventoryItemId_key"
    ON "repair_components"("repairId", "inventoryItemId");
CREATE INDEX "repair_components_inventoryItemId_idx"
    ON "repair_components"("inventoryItemId");
CREATE INDEX "inventory_movements_inventoryItemId_createdAt_idx"
    ON "inventory_movements"("inventoryItemId", "createdAt");
CREATE INDEX "inventory_movements_orderId_idx" ON "inventory_movements"("orderId");
CREATE INDEX "inventory_movements_repairId_idx" ON "inventory_movements"("repairId");
CREATE INDEX "inventory_movements_performedById_idx"
    ON "inventory_movements"("performedById");

ALTER TABLE "order_components"
    ADD CONSTRAINT "order_components_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "orders"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_components"
    ADD CONSTRAINT "order_components_inventoryItemId_fkey"
    FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "repair_components"
    ADD CONSTRAINT "repair_components_repairId_fkey"
    FOREIGN KEY ("repairId") REFERENCES "repairs"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "repair_components"
    ADD CONSTRAINT "repair_components_inventoryItemId_fkey"
    FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements"
    ADD CONSTRAINT "inventory_movements_inventoryItemId_fkey"
    FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_movements"
    ADD CONSTRAINT "inventory_movements_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "orders"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_movements"
    ADD CONSTRAINT "inventory_movements_repairId_fkey"
    FOREIGN KEY ("repairId") REFERENCES "repairs"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
