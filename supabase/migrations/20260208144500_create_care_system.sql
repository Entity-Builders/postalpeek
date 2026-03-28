-- Create care_schedules table
CREATE TABLE care_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pot_id UUID REFERENCES pots(id) NOT NULL,
  care_type TEXT NOT NULL CHECK (care_type IN ('watering', 'fertilizing', 'pruning', 'repotting', 'other')),
  frequency_days INTEGER,
  last_care_date TIMESTAMPTZ,
  next_care_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create care_logs table
CREATE TABLE care_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pot_id UUID REFERENCES pots(id) NOT NULL,
  care_type TEXT NOT NULL CHECK (care_type IN ('watering', 'fertilizing', 'pruning', 'repotting', 'other')),
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create reminders table (optional, for specific one-off reminders unrelated to a schedule, or as a queue)
-- For now, we'll stick to care_schedules as the source of truth for "next reminder"

-- Indexes
CREATE INDEX idx_care_schedules_pot_id ON care_schedules(pot_id);
CREATE INDEX idx_care_schedules_next_care_date ON care_schedules(next_care_date);
CREATE INDEX idx_care_logs_pot_id ON care_logs(pot_id);
CREATE INDEX idx_care_logs_performed_at ON care_logs(performed_at);

-- Enable RLS
ALTER TABLE care_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for care_schedules
CREATE POLICY "Users can view their own care schedules"
  ON care_schedules FOR SELECT
  USING (EXISTS (SELECT 1 FROM pots WHERE pots.id = care_schedules.pot_id AND pots.user_id = auth.uid()));

CREATE POLICY "Users can insert their own care schedules"
  ON care_schedules FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM pots WHERE pots.id = care_schedules.pot_id AND pots.user_id = auth.uid()));

CREATE POLICY "Users can update their own care schedules"
  ON care_schedules FOR UPDATE
  USING (EXISTS (SELECT 1 FROM pots WHERE pots.id = care_schedules.pot_id AND pots.user_id = auth.uid()));

CREATE POLICY "Users can delete their own care schedules"
  ON care_schedules FOR DELETE
  USING (EXISTS (SELECT 1 FROM pots WHERE pots.id = care_schedules.pot_id AND pots.user_id = auth.uid()));

-- RLS Policies for care_logs
CREATE POLICY "Users can view their own care logs"
  ON care_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM pots WHERE pots.id = care_logs.pot_id AND pots.user_id = auth.uid()));

CREATE POLICY "Users can insert their own care logs"
  ON care_logs FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM pots WHERE pots.id = care_logs.pot_id AND pots.user_id = auth.uid()));

CREATE POLICY "Users can update their own care logs"
  ON care_logs FOR UPDATE
  USING (EXISTS (SELECT 1 FROM pots WHERE pots.id = care_logs.pot_id AND pots.user_id = auth.uid()));

CREATE POLICY "Users can delete their own care logs"
  ON care_logs FOR DELETE
  USING (EXISTS (SELECT 1 FROM pots WHERE pots.id = care_logs.pot_id AND pots.user_id = auth.uid()));

-- Add Trigger to automatically update updated_at
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON care_schedules
  FOR EACH ROW EXECUTE PROCEDURE extensions.moddatetime(updated_at);
