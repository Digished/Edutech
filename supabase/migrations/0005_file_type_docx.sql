-- ============================================================
-- Migration: add 'docx' to the file_type enum so Word documents can
-- be uploaded and processed alongside PDFs and images.
-- ============================================================

BEGIN;

ALTER TYPE file_type ADD VALUE IF NOT EXISTS 'docx';

COMMIT;
