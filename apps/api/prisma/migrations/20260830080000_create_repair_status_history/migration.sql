CREATE TYPE "HistoryActorRole" AS ENUM ('ADMIN', 'MANAGER', 'TECHNICIAN');

CREATE TABLE "repair_status_history" (
    "id" UUID NOT NULL,
    "repairId" UUID NOT NULL,
    "status" "RepairStatus" NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedByUserId" UUID,
    "changedByName" VARCHAR(100) NOT NULL,
    "changedByRole" "HistoryActorRole",
    "comment" TEXT,

    CONSTRAINT "repair_status_history_pkey" PRIMARY KEY ("id")
);

INSERT INTO "repair_status_history" (
    "id",
    "repairId",
    "status",
    "changedAt",
    "changedByName",
    "changedByRole"
)
SELECT
    gen_random_uuid(),
    "id",
    "status",
    "updatedAt",
    'Система',
    NULL
FROM "repairs";

CREATE INDEX "repair_status_history_repairId_changedAt_idx"
    ON "repair_status_history"("repairId", "changedAt");
CREATE INDEX "repair_status_history_changedByUserId_idx"
    ON "repair_status_history"("changedByUserId");

ALTER TABLE "repair_status_history"
    ADD CONSTRAINT "repair_status_history_repairId_fkey"
    FOREIGN KEY ("repairId") REFERENCES "repairs"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "repair_status_history"
    ADD CONSTRAINT "repair_status_history_changedByUserId_fkey"
    FOREIGN KEY ("changedByUserId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
