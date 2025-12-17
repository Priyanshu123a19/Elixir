-- Migration: Add symptom_checks table
-- Created: 2025-12-16

-- Symptom Checks Table
CREATE TABLE IF NOT EXISTS symptom_checks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symptoms JSONB NOT NULL,
  lab_report_ids UUID[] NOT NULL,
  ai_analysis TEXT,
  correlations JSONB,
  severity_score INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_symptom_checks_user_id ON symptom_checks(user_id);
CREATE INDEX IF NOT EXISTS idx_symptom_checks_created_at ON symptom_checks(created_at DESC);

ALTER TABLE symptom_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own symptom checks" ON symptom_checks;
DROP POLICY IF EXISTS "Users can insert own symptom checks" ON symptom_checks;
DROP POLICY IF EXISTS "Users can update own symptom checks" ON symptom_checks;
DROP POLICY IF EXISTS "Users can delete own symptom checks" ON symptom_checks;

CREATE POLICY "Users can view own symptom checks"
  ON symptom_checks
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own symptom checks"
  ON symptom_checks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own symptom checks"
  ON symptom_checks
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own symptom checks"
  ON symptom_checks
  FOR DELETE
  USING (auth.uid() = user_id);
