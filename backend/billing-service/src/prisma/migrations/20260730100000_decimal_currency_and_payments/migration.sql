ALTER TABLE "Subscription"
  ALTER COLUMN "amount" TYPE DECIMAL(19,4)
    USING ROUND("amount"::numeric, 4),
  ADD COLUMN "currency" VARCHAR(3) NOT NULL DEFAULT 'MNT';

ALTER TABLE "Invoice"
  ALTER COLUMN "amount" TYPE DECIMAL(19,4)
    USING ROUND("amount"::numeric, 4),
  ADD COLUMN "currency" VARCHAR(3) NOT NULL DEFAULT 'MNT';

CREATE TABLE "Payment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "amount" DECIMAL(19,4) NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'MNT',
  "method" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'COMPLETED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Payment_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

ALTER TABLE "Subscription"
  ADD CONSTRAINT "Subscription_currency_iso4217"
    CHECK ("currency" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "Subscription_amount_nonnegative"
    CHECK ("amount" >= 0);

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_currency_iso4217"
    CHECK ("currency" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "Invoice_amount_positive"
    CHECK ("amount" > 0);

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_currency_iso4217"
    CHECK ("currency" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "Payment_amount_positive"
    CHECK ("amount" > 0);

CREATE UNIQUE INDEX "Payment_organizationId_transactionId_key"
  ON "Payment"("organizationId", "transactionId");
CREATE INDEX "Payment_organizationId_createdAt_idx"
  ON "Payment"("organizationId", "createdAt");
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");
