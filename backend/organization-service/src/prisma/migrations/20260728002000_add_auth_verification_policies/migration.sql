ALTER TABLE "OrgSettings"
    ADD COLUMN "requireEmailVerification" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "requirePhoneVerification" BOOLEAN NOT NULL DEFAULT false;
