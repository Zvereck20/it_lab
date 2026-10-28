ALTER TABLE "order_components"
    ADD COLUMN "addedById" VARCHAR(50),
    ADD COLUMN "addedByName" VARCHAR(100);

UPDATE "order_components" AS component
SET
    "addedById" = COALESCE((
        SELECT movement."performedById"
        FROM "inventory_movements" AS movement
        WHERE movement."orderId" = component."orderId"
          AND movement."inventoryItemId" = component."inventoryItemId"
          AND movement."operationType" = 'ORDER_ALLOCATION'
        ORDER BY movement."createdAt", movement."id"
        LIMIT 1
    ), 'ADMIN'),
    "addedByName" = COALESCE((
        SELECT movement."performedByName"
        FROM "inventory_movements" AS movement
        WHERE movement."orderId" = component."orderId"
          AND movement."inventoryItemId" = component."inventoryItemId"
          AND movement."operationType" = 'ORDER_ALLOCATION'
        ORDER BY movement."createdAt", movement."id"
        LIMIT 1
    ), 'Администратор');

ALTER TABLE "order_components"
    ALTER COLUMN "addedById" SET NOT NULL,
    ALTER COLUMN "addedByName" SET NOT NULL;

ALTER TABLE "repair_components"
    ADD COLUMN "addedById" VARCHAR(50),
    ADD COLUMN "addedByName" VARCHAR(100);

UPDATE "repair_components" AS component
SET
    "addedById" = COALESCE((
        SELECT movement."performedById"
        FROM "inventory_movements" AS movement
        WHERE movement."repairId" = component."repairId"
          AND movement."inventoryItemId" = component."inventoryItemId"
          AND movement."operationType" = 'REPAIR_ALLOCATION'
        ORDER BY movement."createdAt", movement."id"
        LIMIT 1
    ), 'ADMIN'),
    "addedByName" = COALESCE((
        SELECT movement."performedByName"
        FROM "inventory_movements" AS movement
        WHERE movement."repairId" = component."repairId"
          AND movement."inventoryItemId" = component."inventoryItemId"
          AND movement."operationType" = 'REPAIR_ALLOCATION'
        ORDER BY movement."createdAt", movement."id"
        LIMIT 1
    ), 'Администратор');

ALTER TABLE "repair_components"
    ALTER COLUMN "addedById" SET NOT NULL,
    ALTER COLUMN "addedByName" SET NOT NULL;
