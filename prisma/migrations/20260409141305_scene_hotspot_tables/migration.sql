-- AlterTable
ALTER TABLE "SceneInteractionsSnapshot" ALTER COLUMN "id" SET DEFAULT 'default';

-- CreateTable
CREATE TABLE "Scene" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotspotInteraction" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "hotspotId" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotspotInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Scene_name_key" ON "Scene"("name");

-- CreateIndex
CREATE UNIQUE INDEX "HotspotInteraction_sceneId_hotspotId_key" ON "HotspotInteraction"("sceneId", "hotspotId");

-- AddForeignKey
ALTER TABLE "HotspotInteraction" ADD CONSTRAINT "HotspotInteraction_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;
