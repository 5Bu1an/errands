-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('RIDE', 'TASK');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('OPEN', 'REQUESTED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "listings" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "ListingType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "pickup_location" TEXT,
    "dropoff_text" TEXT,
    "time" TIMESTAMP(3) NOT NULL,
    "available_seats" INTEGER,
    "price" DOUBLE PRECISION DEFAULT 0.0,
    "status" "ListingStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "listings_user_id_idx" ON "listings"("user_id");

-- CreateIndex
CREATE INDEX "listings_type_status_idx" ON "listings"("type", "status");

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Block direct access through Supabase's public API.
-- Our Express server connects as the database owner, so it is unaffected.
ALTER TABLE "listings" ENABLE ROW LEVEL SECURITY;
