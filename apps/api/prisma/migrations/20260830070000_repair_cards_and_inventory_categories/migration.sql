CREATE TABLE "inventory_item_additional_categories" (
    "inventoryItemId" UUID NOT NULL,
    "additionalCategoryId" UUID NOT NULL,

    CONSTRAINT "inventory_item_additional_categories_pkey"
        PRIMARY KEY ("inventoryItemId", "additionalCategoryId")
);

INSERT INTO "inventory_item_additional_categories" ("inventoryItemId", "additionalCategoryId")
SELECT "id", "additionalCategoryId"
FROM "inventory_items"
WHERE "additionalCategoryId" IS NOT NULL;

ALTER TABLE "inventory_items"
    DROP CONSTRAINT "inventory_items_additionalCategoryId_fkey";
DROP INDEX "inventory_items_additionalCategoryId_idx";
DROP INDEX "inventory_items_mainCategoryId_additionalCategoryId_idx";
ALTER TABLE "inventory_items" DROP COLUMN "additionalCategoryId";

CREATE INDEX "inventory_item_additional_categories_additionalCategoryId_idx"
    ON "inventory_item_additional_categories"("additionalCategoryId");

ALTER TABLE "inventory_item_additional_categories"
    ADD CONSTRAINT "inventory_item_additional_categories_inventoryItemId_fkey"
    FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inventory_item_additional_categories"
    ADD CONSTRAINT "inventory_item_additional_categories_additionalCategoryId_fkey"
    FOREIGN KEY ("additionalCategoryId") REFERENCES "additional_categories"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TYPE "RepairStatus" RENAME TO "RepairStatus_old";
CREATE TYPE "RepairStatus" AS ENUM (
    'CREATED',
    'DIAGNOSTICS',
    'APPROVAL',
    'IN_PROGRESS',
    'REVISION',
    'COMPLETED'
);
ALTER TABLE "repairs" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "repairs"
    ALTER COLUMN "status" TYPE "RepairStatus"
    USING (
        CASE
            WHEN "status"::TEXT = 'REVIEW' THEN 'APPROVAL'
            ELSE "status"::TEXT
        END
    )::"RepairStatus";
DROP TYPE "RepairStatus_old";
ALTER TABLE "repairs" ALTER COLUMN "status" SET DEFAULT 'CREATED';

CREATE TYPE "CustomerType" AS ENUM ('INDIVIDUAL', 'LEGAL_ENTITY');
CREATE TYPE "RepairAssignmentMode" AS ENUM ('FREE_QUEUE', 'ASSIGNED');

DROP INDEX "repairs_dueDate_idx";
ALTER TABLE "repairs"
    DROP COLUMN "dueDate",
    ADD COLUMN "customerType" "CustomerType" NOT NULL DEFAULT 'INDIVIDUAL',
    ADD COLUMN "customerPhone" VARCHAR(30) NOT NULL DEFAULT 'Не указан',
    ADD COLUMN "customerFirstName" VARCHAR(100) NOT NULL DEFAULT 'Не указано',
    ADD COLUMN "customerLastName" VARCHAR(100) NOT NULL DEFAULT 'Не указано',
    ADD COLUMN "customerMiddleName" VARCHAR(100),
    ADD COLUMN "companyName" VARCHAR(150),
    ADD COLUMN "inn" VARCHAR(12),
    ADD COLUMN "assignmentMode" "RepairAssignmentMode" NOT NULL DEFAULT 'FREE_QUEUE';

UPDATE "repairs"
SET "assignmentMode" = 'ASSIGNED'
WHERE "technicianId" IS NOT NULL;

ALTER TABLE "repairs" ALTER COLUMN "customerPhone" DROP DEFAULT;
ALTER TABLE "repairs" ALTER COLUMN "customerFirstName" DROP DEFAULT;
ALTER TABLE "repairs" ALTER COLUMN "customerLastName" DROP DEFAULT;

ALTER TABLE "repairs"
    ADD CONSTRAINT "repairs_assignment_check"
    CHECK (
        ("assignmentMode" = 'FREE_QUEUE' AND "technicianId" IS NULL)
        OR ("assignmentMode" = 'ASSIGNED' AND "technicianId" IS NOT NULL)
    );

CREATE INDEX "repairs_assignmentMode_idx" ON "repairs"("assignmentMode");
