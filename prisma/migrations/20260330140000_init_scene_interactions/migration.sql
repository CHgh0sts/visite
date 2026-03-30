-- CreateTable
CREATE TABLE "SceneInteractionsSnapshot" (
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SceneInteractionsSnapshot_pkey" PRIMARY KEY ("id")
);
