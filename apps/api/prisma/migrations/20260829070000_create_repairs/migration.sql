CREATE TYPE "RepairStatus" AS ENUM (
    'CREATED',
    'IN_PROGRESS',
    'REVIEW',
    'REVISION',
    'COMPLETED'
);

CREATE TABLE "repairs" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "technicianId" UUID,
    "dueDate" DATE NOT NULL,
    "status" "RepairStatus" NOT NULL DEFAULT 'CREATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repairs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "repairs_name_idx" ON "repairs"("name");
CREATE INDEX "repairs_technicianId_idx" ON "repairs"("technicianId");
CREATE INDEX "repairs_status_idx" ON "repairs"("status");
CREATE INDEX "repairs_dueDate_idx" ON "repairs"("dueDate");

ALTER TABLE "repairs"
    ADD CONSTRAINT "repairs_technicianId_fkey"
    FOREIGN KEY ("technicianId") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
