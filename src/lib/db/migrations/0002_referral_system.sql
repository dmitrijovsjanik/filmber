-- Add referral fields to users
ALTER TABLE "users" ADD COLUMN "referral_code" varchar(12) UNIQUE;
ALTER TABLE "users" ADD COLUMN "referred_by_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "users" ADD COLUMN "referred_at" timestamp;

-- Create indexes
CREATE INDEX "users_referral_code_idx" ON "users" ("referral_code");
CREATE INDEX "users_referred_by_idx" ON "users" ("referred_by_id");

-- Generate referral codes for existing users (8 uppercase alphanumeric characters)
UPDATE "users" SET "referral_code" = UPPER(SUBSTRING(REPLACE(CAST(gen_random_uuid() AS text), '-', ''), 1, 8)) WHERE "referral_code" IS NULL;

-- Make referral_code NOT NULL after populating
ALTER TABLE "users" ALTER COLUMN "referral_code" SET NOT NULL;

-- Create referral_rewards table (for future bonuses)
CREATE TABLE "referral_rewards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "reward_type" varchar(50) NOT NULL,
  "referral_count" integer NOT NULL,
  "reward_value" text,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "claimed_at" timestamp,
  "expires_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "reward_user_idx" ON "referral_rewards" ("user_id");
CREATE INDEX "reward_status_idx" ON "referral_rewards" ("status");
