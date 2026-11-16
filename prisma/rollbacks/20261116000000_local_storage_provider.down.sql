-- Reverts 20261116000000_local_storage_provider.
-- Run manually, then: prisma migrate resolve --rolled-back 20261116000000_local_storage_provider
-- PostgreSQL cannot drop an enum value, so the type is rebuilt. Local-file assets exist only in development
-- databases; they are deleted first (their files live under .data/uploads on the developer's machine).
BEGIN;
DELETE FROM "UploadedAsset" WHERE "provider" = 'LOCAL_FILESYSTEM';
ALTER TYPE "StorageProvider" RENAME TO "StorageProvider_old";
CREATE TYPE "StorageProvider" AS ENUM ('CLOUDINARY');
ALTER TABLE "UploadedAsset" ALTER COLUMN "provider" DROP DEFAULT;
ALTER TABLE "UploadedAsset" ALTER COLUMN "provider" TYPE "StorageProvider" USING ("provider"::text::"StorageProvider");
ALTER TABLE "UploadedAsset" ALTER COLUMN "provider" SET DEFAULT 'CLOUDINARY';
DROP TYPE "StorageProvider_old";
COMMIT;
