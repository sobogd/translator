-- Email sign-in challenges (OTP) for the OTP email auth flow.
CREATE TABLE "otp_codes" (
    "email" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("email")
);
