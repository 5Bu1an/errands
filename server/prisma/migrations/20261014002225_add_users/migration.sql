-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT,
    "program" TEXT,
    "bio" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);


-- Block direct access through Supabase's public API.
-- Our Express server connects as the database owner, so it is unaffected.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
