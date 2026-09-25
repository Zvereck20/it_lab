CREATE TYPE "OrderStatus" AS ENUM (
    'CREATED',
    'DIAGNOSTICS',
    'APPROVAL',
    'IN_PROGRESS',
    'REVISION',
    'COMPLETED'
);

CREATE TYPE "OrderAssignmentMode" AS ENUM ('FREE_QUEUE', 'ASSIGNED');

CREATE TABLE "order_main_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "order_main_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "order_additional_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "order_additional_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "order_main_additional_categories" (
    "mainCategoryId" UUID NOT NULL,
    "additionalCategoryId" UUID NOT NULL,
    CONSTRAINT "order_main_additional_categories_pkey"
        PRIMARY KEY ("mainCategoryId", "additionalCategoryId")
);

CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "companyName" VARCHAR(150) NOT NULL,
    "inn" VARCHAR(12) NOT NULL,
    "customerPhone" VARCHAR(30) NOT NULL,
    "contactFirstName" VARCHAR(100) NOT NULL,
    "contactLastName" VARCHAR(100) NOT NULL,
    "contactMiddleName" VARCHAR(100),
    "mainCategoryId" UUID NOT NULL,
    "assignmentMode" "OrderAssignmentMode" NOT NULL DEFAULT 'FREE_QUEUE',
    "technicianId" UUID,
    "status" "OrderStatus" NOT NULL DEFAULT 'CREATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "orders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "orders_assignment_check" CHECK (
        ("assignmentMode" = 'FREE_QUEUE' AND "technicianId" IS NULL)
        OR ("assignmentMode" = 'ASSIGNED' AND "technicianId" IS NOT NULL)
    )
);

CREATE TABLE "order_additional_category_links" (
    "orderId" UUID NOT NULL,
    "additionalCategoryId" UUID NOT NULL,
    CONSTRAINT "order_additional_category_links_pkey"
        PRIMARY KEY ("orderId", "additionalCategoryId")
);

CREATE TABLE "order_status_history" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedByUserId" UUID,
    "changedByName" VARCHAR(100) NOT NULL,
    "changedByRole" "HistoryActorRole",
    "comment" TEXT,
    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "order_main_categories_name_key" ON "order_main_categories"("name");
CREATE UNIQUE INDEX "order_additional_categories_name_key" ON "order_additional_categories"("name");
CREATE INDEX "order_main_additional_categories_additionalCategoryId_idx"
    ON "order_main_additional_categories"("additionalCategoryId");
CREATE INDEX "orders_name_idx" ON "orders"("name");
CREATE INDEX "orders_mainCategoryId_idx" ON "orders"("mainCategoryId");
CREATE INDEX "orders_technicianId_idx" ON "orders"("technicianId");
CREATE INDEX "orders_status_idx" ON "orders"("status");
CREATE INDEX "orders_assignmentMode_idx" ON "orders"("assignmentMode");
CREATE INDEX "order_additional_category_links_additionalCategoryId_idx"
    ON "order_additional_category_links"("additionalCategoryId");
CREATE INDEX "order_status_history_orderId_changedAt_idx"
    ON "order_status_history"("orderId", "changedAt");
CREATE INDEX "order_status_history_changedByUserId_idx"
    ON "order_status_history"("changedByUserId");

ALTER TABLE "order_main_additional_categories"
    ADD CONSTRAINT "order_main_additional_categories_mainCategoryId_fkey"
    FOREIGN KEY ("mainCategoryId") REFERENCES "order_main_categories"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_main_additional_categories"
    ADD CONSTRAINT "order_main_additional_categories_additionalCategoryId_fkey"
    FOREIGN KEY ("additionalCategoryId") REFERENCES "order_additional_categories"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "orders"
    ADD CONSTRAINT "orders_mainCategoryId_fkey"
    FOREIGN KEY ("mainCategoryId") REFERENCES "order_main_categories"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders"
    ADD CONSTRAINT "orders_technicianId_fkey"
    FOREIGN KEY ("technicianId") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_additional_category_links"
    ADD CONSTRAINT "order_additional_category_links_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "orders"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_additional_category_links"
    ADD CONSTRAINT "order_additional_category_links_additionalCategoryId_fkey"
    FOREIGN KEY ("additionalCategoryId") REFERENCES "order_additional_categories"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_status_history"
    ADD CONSTRAINT "order_status_history_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "orders"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_status_history"
    ADD CONSTRAINT "order_status_history_changedByUserId_fkey"
    FOREIGN KEY ("changedByUserId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
