-- Adds 'docx' to the file_type enum so Word documents can be uploaded
-- alongside PDFs and images.
ALTER TYPE file_type ADD VALUE IF NOT EXISTS 'docx';
