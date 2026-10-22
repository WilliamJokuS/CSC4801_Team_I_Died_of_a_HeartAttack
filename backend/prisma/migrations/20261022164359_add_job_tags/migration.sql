-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "tags" JSONB NOT NULL DEFAULT '[]';
