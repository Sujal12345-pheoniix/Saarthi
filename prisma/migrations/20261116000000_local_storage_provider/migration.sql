-- Development-only local file storage for uploaded photos (used when Cloudinary is not configured).
-- Additive: adds one enum value. Production rows are unaffected.
ALTER TYPE "StorageProvider" ADD VALUE IF NOT EXISTS 'LOCAL_FILESYSTEM';
