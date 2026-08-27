CREATE TABLE "main_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "main_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "additional_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "additional_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "main_category_additional_categories" (
    "mainCategoryId" UUID NOT NULL,
    "additionalCategoryId" UUID NOT NULL,

    CONSTRAINT "main_category_additional_categories_pkey"
        PRIMARY KEY ("mainCategoryId", "additionalCategoryId")
);

CREATE TABLE "inventory_items" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "count" INTEGER NOT NULL DEFAULT 0,
    "mainCategoryId" UUID NOT NULL,
    "additionalCategoryId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "inventory_items_count_check" CHECK ("count" >= 0)
);

CREATE UNIQUE INDEX "main_categories_name_key" ON "main_categories"("name");
CREATE UNIQUE INDEX "additional_categories_name_key" ON "additional_categories"("name");
CREATE INDEX "main_category_additional_categories_additionalCategoryId_idx"
    ON "main_category_additional_categories"("additionalCategoryId");
CREATE INDEX "inventory_items_name_idx" ON "inventory_items"("name");
CREATE INDEX "inventory_items_mainCategoryId_idx" ON "inventory_items"("mainCategoryId");
CREATE INDEX "inventory_items_additionalCategoryId_idx" ON "inventory_items"("additionalCategoryId");
CREATE INDEX "inventory_items_mainCategoryId_additionalCategoryId_idx"
    ON "inventory_items"("mainCategoryId", "additionalCategoryId");

ALTER TABLE "main_category_additional_categories"
    ADD CONSTRAINT "main_category_additional_categories_mainCategoryId_fkey"
    FOREIGN KEY ("mainCategoryId") REFERENCES "main_categories"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "main_category_additional_categories"
    ADD CONSTRAINT "main_category_additional_categories_additionalCategoryId_fkey"
    FOREIGN KEY ("additionalCategoryId") REFERENCES "additional_categories"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inventory_items"
    ADD CONSTRAINT "inventory_items_mainCategoryId_fkey"
    FOREIGN KEY ("mainCategoryId") REFERENCES "main_categories"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory_items"
    ADD CONSTRAINT "inventory_items_additionalCategoryId_fkey"
    FOREIGN KEY ("additionalCategoryId") REFERENCES "additional_categories"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
