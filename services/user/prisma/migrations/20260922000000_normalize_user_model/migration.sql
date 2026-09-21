-- Normalize User model: enforce lengths, add soft-delete and pagination indexes
-- Align with frontend limits (name 50, bio 280, username 30) and make pagination stable

-- Add deletedAt for soft-delete (nullable, no backfill needed)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ(3);

-- Enforce column lengths via type change (TEXT -> VARCHAR with limits)
-- These ALTERs are safe for existing short data; they will fail if any row exceeds the new limit,
-- which is the desired robustness signal.
ALTER TABLE "User" ALTER COLUMN "username" TYPE VARCHAR(30);
ALTER TABLE "User" ALTER COLUMN "email" TYPE VARCHAR(254);
ALTER TABLE "User" ALTER COLUMN "password" TYPE VARCHAR(255);
ALTER TABLE "User" ALTER COLUMN "name" TYPE VARCHAR(50);
ALTER TABLE "User" ALTER COLUMN "bio" TYPE VARCHAR(280);
ALTER TABLE "User" ALTER COLUMN "avatarUrl" TYPE VARCHAR(2048);
ALTER TABLE "User" ALTER COLUMN "bannerUrl" TYPE VARCHAR(2048);

-- Explicit check constraints (defense-in-depth, also documents intent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_username_length_check') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_username_length_check" CHECK (char_length("username") >= 3 AND char_length("username") <= 30);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_email_length_check') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_email_length_check" CHECK (char_length("email") >= 5 AND char_length("email") <= 254);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_name_length_check') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_name_length_check" CHECK ("name" IS NULL OR char_length("name") <= 50);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_bio_length_check') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_bio_length_check" CHECK ("bio" IS NULL OR char_length("bio") <= 280);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_avatarUrl_length_check') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_avatarUrl_length_check" CHECK ("avatarUrl" IS NULL OR char_length("avatarUrl") <= 2048);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_bannerUrl_length_check') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_bannerUrl_length_check" CHECK ("bannerUrl" IS NULL OR char_length("bannerUrl") <= 2048);
  END IF;
END $$;

-- Indexes for stable pagination and soft-delete filtering
CREATE INDEX IF NOT EXISTS "User_createdAt_id_idx" ON "User"("createdAt" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "User_deletedAt_idx" ON "User"("deletedAt");

-- The case-insensitive uniqueness is already provided by the lower() indexes from the
-- initial migration (User_email_lower_key, User_username_lower_key). Keep them as
-- the authoritative constraint; the plain @unique indexes remain for Prisma.
