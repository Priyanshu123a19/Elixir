-- Add recommendations column to lab_reports table
-- Run this migration in your Supabase SQL editor

ALTER TABLE lab_reports 
ADD COLUMN IF NOT EXISTS recommendations JSONB;

-- Add comment to column
COMMENT ON COLUMN lab_reports.recommendations IS 'AI-generated personalized recommendations including diet, exercise, and lifestyle suggestions';
