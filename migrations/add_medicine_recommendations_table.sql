-- ============================================
-- Medicine Recommendations Table Migration
-- ============================================

-- Medicine Recommendations Table
CREATE TABLE IF NOT EXISTS medicine_recommendations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_id UUID NOT NULL REFERENCES lab_reports(id) ON DELETE CASCADE,
  medications JSONB NOT NULL, -- Array of medication objects with name, dosage, frequency, etc.
  general_advice TEXT,
  disclaimer_note TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'prescribed', 'declined')),
  doctor_notes TEXT, -- Optional notes from healthcare provider
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_medicine_recommendations_user_id ON medicine_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_medicine_recommendations_report_id ON medicine_recommendations(report_id);
CREATE INDEX IF NOT EXISTS idx_medicine_recommendations_status ON medicine_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_medicine_recommendations_created_at ON medicine_recommendations(created_at DESC);

-- Enable Row Level Security
ALTER TABLE medicine_recommendations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own medicine recommendations" ON medicine_recommendations;
DROP POLICY IF EXISTS "Users can insert own medicine recommendations" ON medicine_recommendations;
DROP POLICY IF EXISTS "Users can update own medicine recommendations" ON medicine_recommendations;
DROP POLICY IF EXISTS "Users can delete own medicine recommendations" ON medicine_recommendations;

-- RLS Policies
CREATE POLICY "Users can view own medicine recommendations"
  ON medicine_recommendations
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own medicine recommendations"
  ON medicine_recommendations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own medicine recommendations"
  ON medicine_recommendations
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own medicine recommendations"
  ON medicine_recommendations
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add comment for documentation
COMMENT ON TABLE medicine_recommendations IS 'Stores AI-generated medicine recommendations based on lab report analysis. Recommendations should be reviewed by healthcare professionals before use.';
COMMENT ON COLUMN medicine_recommendations.medications IS 'JSONB array containing medication objects with structure: {name, dosage, frequency, duration, purpose, precautions[]}';
COMMENT ON COLUMN medicine_recommendations.status IS 'Status of recommendation: pending (not reviewed), reviewed (seen by user), prescribed (approved by doctor), declined (rejected)';
