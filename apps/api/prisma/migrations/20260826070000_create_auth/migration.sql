CREATE TYPE "Role" AS ENUM ('MANAGER', 'TECHNICIAN');

CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "login" VARCHAR(50) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_sessions" (
    "sid" VARCHAR(255) NOT NULL,
    "sess" JSONB NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("sid")
);

CREATE UNIQUE INDEX "users_login_key" ON "users"("login");
CREATE INDEX "user_sessions_expire_idx" ON "user_sessions"("expire");
