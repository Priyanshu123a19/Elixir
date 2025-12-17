-- ============================================
-- Health Goals and Progress Tracking Schema
-- ============================================

-- Health Goals Table
-- Stores AI-generated health goals for each lab report
CREATE TABLE IF NOT EXISTS health_goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES lab_reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_category TEXT NOT NULL CHECK (goal_category IN ('diet', 'exercise', 'lifestyle', 'medication', 'monitoring')),
  goal_title TEXT NOT NULL,
  goal_description TEXT NOT NULL,
  target_metric TEXT,
  target_value TEXT,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'in_progress', 'not_started')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_goals_report_id ON health_goals(report_id);
CREATE INDEX IF NOT EXISTS idx_health_goals_user_id ON health_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_health_goals_status ON health_goals(status);

ALTER TABLE health_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own health goals" ON health_goals;
DROP POLICY IF EXISTS "Users can insert own health goals" ON health_goals;
DROP POLICY IF EXISTS "Users can update own health goals" ON health_goals;
DROP POLICY IF EXISTS "Users can delete own health goals" ON health_goals;

CREATE POLICY "Users can view own health goals"
  ON health_goals
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own health goals"
  ON health_goals
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own health goals"
  ON health_goals
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own health goals"
  ON health_goals
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- Report Relationships Table
-- Links follow-up reports to baseline reports for progress tracking
-- ============================================
CREATE TABLE IF NOT EXISTS report_relationships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  baseline_report_id UUID NOT NULL REFERENCES lab_reports(id) ON DELETE CASCADE,
  followup_report_id UUID NOT NULL REFERENCES lab_reports(id) ON DELETE CASCADE,
  relationship_type TEXT DEFAULT 'follow_up' CHECK (relationship_type IN ('follow_up', 'comparison', 'series')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(baseline_report_id, followup_report_id)
);

CREATE INDEX IF NOT EXISTS idx_report_relationships_user_id ON report_relationships(user_id);
CREATE INDEX IF NOT EXISTS idx_report_relationships_baseline ON report_relationships(baseline_report_id);
CREATE INDEX IF NOT EXISTS idx_report_relationships_followup ON report_relationships(followup_report_id);

ALTER TABLE report_relationships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own report relationships" ON report_relationships;
DROP POLICY IF EXISTS "Users can insert own report relationships" ON report_relationships;
DROP POLICY IF EXISTS "Users can update own report relationships" ON report_relationships;
DROP POLICY IF EXISTS "Users can delete own report relationships" ON report_relationships;

CREATE POLICY "Users can view own report relationships"
  ON report_relationships
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own report relationships"
  ON report_relationships
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own report relationships"
  ON report_relationships
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own report relationships"
  ON report_relationships
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- Progress Tracking Table
-- Stores progress data comparing baseline and follow-up reports
-- ============================================
CREATE TABLE IF NOT EXISTS progress_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  relationship_id UUID NOT NULL REFERENCES report_relationships(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  baseline_value TEXT NOT NULL,
  followup_value TEXT NOT NULL,
  unit TEXT,
  reference_range TEXT,
  improvement_percentage DECIMAL,
  status TEXT CHECK (status IN ('improved', 'worsened', 'stable', 'normalized')),
  ai_insight TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_progress_tracking_relationship ON progress_tracking(relationship_id);
CREATE INDEX IF NOT EXISTS idx_progress_tracking_user_id ON progress_tracking(user_id);

ALTER TABLE progress_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own progress tracking" ON progress_tracking;
DROP POLICY IF EXISTS "Users can insert own progress tracking" ON progress_tracking;
DROP POLICY IF EXISTS "Users can update own progress tracking" ON progress_tracking;
DROP POLICY IF EXISTS "Users can delete own progress tracking" ON progress_tracking;

CREATE POLICY "Users can view own progress tracking"
  ON progress_tracking
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress tracking"
  ON progress_tracking
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress tracking"
  ON progress_tracking
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own progress tracking"
  ON progress_tracking
  FOR DELETE
  USING (auth.uid() = user_id);
