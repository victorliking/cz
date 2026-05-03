-- CreateEnum
CREATE TYPE "Role" AS ENUM ('AGENT', 'BUYER');

-- CreateEnum
CREATE TYPE "BuyerStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CLOSED');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('SFH', 'CONDO', 'TOWNHOUSE', 'COOP', 'MULTIFAMILY');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'PENDING', 'SOLD', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ShowingMode" AS ENUM ('IN_PERSON', 'VIRTUAL', 'DRIVE_BY');

-- CreateEnum
CREATE TYPE "GutReaction" AS ENUM ('LOVE', 'LIKE', 'MEH', 'DISLIKE', 'HATE');

-- CreateEnum
CREATE TYPE "ComparativeResult" AS ENUM ('BETTER', 'SAME', 'WORSE', 'DIFFERENT');

-- CreateEnum
CREATE TYPE "InsightKind" AS ENUM ('STATED_VS_REVEALED_MISMATCH', 'BUDGET_DRIFT', 'PREFERENCE_CONVERGED', 'LOW_CONFIDENCE', 'NEW_PATTERN');

-- CreateEnum
CREATE TYPE "SnapshotTrigger" AS ENUM ('INTAKE', 'FEEDBACK', 'RE_INTAKE', 'MANUAL_OVERRIDE', 'OBSERVATION');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "status" "BuyerStatus" NOT NULL DEFAULT 'ACTIVE',
    "intakeCompletedAt" TIMESTAMP(3),
    "budgetMin" INTEGER,
    "budgetMax" INTEGER,
    "minBedrooms" INTEGER,
    "minBathrooms" DOUBLE PRECISION,
    "propertyTypes" "PropertyType"[],
    "targetCities" TEXT[],
    "targetZipCodes" TEXT[],
    "commuteAnchors" JSONB,
    "mustHaves" TEXT[],
    "dealBreakers" TEXT[],
    "preferenceWeights" JSONB,
    "weightsUpdatedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuyerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "listPrice" INTEGER NOT NULL,
    "propertyType" "PropertyType" NOT NULL,
    "bedrooms" INTEGER NOT NULL,
    "bathroomsFull" INTEGER NOT NULL,
    "bathroomsHalf" INTEGER NOT NULL DEFAULT 0,
    "interiorSqft" INTEGER,
    "lotSqft" INTEGER,
    "yearBuilt" INTEGER,
    "yearRenovated" INTEGER,
    "hoaFeeMonthly" INTEGER,
    "propertyTaxAnnual" INTEGER,
    "listingUrl" TEXT,
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "vector" JSONB NOT NULL,
    "agentNotes" TEXT,
    "photos" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Showing" (
    "id" TEXT NOT NULL,
    "buyerProfileId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "attendedAt" TIMESTAMP(3),
    "mode" "ShowingMode" NOT NULL,
    "agentObservations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Showing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentObservation" (
    "id" TEXT NOT NULL,
    "showingId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "lingeredOn" TEXT[],
    "reactedNegativelyTo" TEXT[],
    "unpromptedQuotes" TEXT,
    "durationVsAverage" TEXT,
    "agentConfidence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "buyerProfileId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "showingId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gutReaction" "GutReaction" NOT NULL,
    "oneLineReaction" TEXT,
    "shownChips" JSONB NOT NULL,
    "likedDimensions" TEXT[],
    "dislikedDimensions" TEXT[],
    "comparativeToPrevious" "ComparativeResult",
    "previousListingId" TEXT,
    "wouldRevisit" BOOLEAN,
    "wouldBringPartner" BOOLEAN,
    "freeFormNotes" TEXT,
    "durationSeconds" INTEGER,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComparativeFeedback" (
    "id" TEXT NOT NULL,
    "buyerProfileId" TEXT NOT NULL,
    "listingAId" TEXT NOT NULL,
    "listingBId" TEXT NOT NULL,
    "preferredListingId" TEXT,
    "reasonDimensions" TEXT[],
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComparativeFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationBatch" (
    "id" TEXT NOT NULL,
    "buyerProfileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "agentReviewedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "RecommendationBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "rationale" JSONB NOT NULL,
    "purpose" TEXT NOT NULL,
    "probedDimension" TEXT,
    "agentApproved" BOOLEAN NOT NULL DEFAULT false,
    "shownToBuyerAt" TIMESTAMP(3),

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsightLog" (
    "id" TEXT NOT NULL,
    "buyerProfileId" TEXT NOT NULL,
    "kind" "InsightKind" NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "evidence" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dismissedAt" TIMESTAMP(3),
    "buyerResolution" TEXT,

    CONSTRAINT "InsightLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeResponse" (
    "id" TEXT NOT NULL,
    "buyerProfileId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "priorityRanking" TEXT[],
    "intakeFreeText" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,

    CONSTRAINT "IntakeResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreferenceSnapshot" (
    "id" TEXT NOT NULL,
    "buyerProfileId" TEXT NOT NULL,
    "triggerType" "SnapshotTrigger" NOT NULL,
    "triggerSourceId" TEXT,
    "weightsBefore" JSONB NOT NULL,
    "weightsAfter" JSONB NOT NULL,
    "delta" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PreferenceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreferenceSummary" (
    "id" TEXT NOT NULL,
    "buyerProfileId" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "topPriorities" JSONB NOT NULL,
    "patterns" JSONB NOT NULL,
    "mismatches" JSONB NOT NULL,
    "buyerFacingText" TEXT,
    "archetype" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "basedOnFeedbackCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PreferenceSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "BuyerProfile_userId_key" ON "BuyerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "IntakeResponse_buyerProfileId_key" ON "IntakeResponse"("buyerProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "PreferenceSummary_buyerProfileId_key" ON "PreferenceSummary"("buyerProfileId");

-- AddForeignKey
ALTER TABLE "BuyerProfile" ADD CONSTRAINT "BuyerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerProfile" ADD CONSTRAINT "BuyerProfile_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Showing" ADD CONSTRAINT "Showing_buyerProfileId_fkey" FOREIGN KEY ("buyerProfileId") REFERENCES "BuyerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Showing" ADD CONSTRAINT "Showing_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentObservation" ADD CONSTRAINT "AgentObservation_showingId_fkey" FOREIGN KEY ("showingId") REFERENCES "Showing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentObservation" ADD CONSTRAINT "AgentObservation_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_buyerProfileId_fkey" FOREIGN KEY ("buyerProfileId") REFERENCES "BuyerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_showingId_fkey" FOREIGN KEY ("showingId") REFERENCES "Showing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparativeFeedback" ADD CONSTRAINT "ComparativeFeedback_buyerProfileId_fkey" FOREIGN KEY ("buyerProfileId") REFERENCES "BuyerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationBatch" ADD CONSTRAINT "RecommendationBatch_buyerProfileId_fkey" FOREIGN KEY ("buyerProfileId") REFERENCES "BuyerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "RecommendationBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsightLog" ADD CONSTRAINT "InsightLog_buyerProfileId_fkey" FOREIGN KEY ("buyerProfileId") REFERENCES "BuyerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeResponse" ADD CONSTRAINT "IntakeResponse_buyerProfileId_fkey" FOREIGN KEY ("buyerProfileId") REFERENCES "BuyerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreferenceSnapshot" ADD CONSTRAINT "PreferenceSnapshot_buyerProfileId_fkey" FOREIGN KEY ("buyerProfileId") REFERENCES "BuyerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreferenceSummary" ADD CONSTRAINT "PreferenceSummary_buyerProfileId_fkey" FOREIGN KEY ("buyerProfileId") REFERENCES "BuyerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
