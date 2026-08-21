-- AlterTable
ALTER TABLE "ambulances" ADD COLUMN "assignedDriverId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ambulances_assignedDriverId_key" ON "ambulances"("assignedDriverId");

-- AddForeignKey
ALTER TABLE "ambulances" ADD CONSTRAINT "ambulances_assignedDriverId_fkey" FOREIGN KEY ("assignedDriverId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
