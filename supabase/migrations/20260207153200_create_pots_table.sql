-- Create pots table
CREATE TABLE pots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  species TEXT NOT NULL,
  photo_url TEXT,
  
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  registered_day_of_year INTEGER NOT NULL,
  
  initial_state TEXT NOT NULL CHECK (initial_state IN ('seeds', 'seedling', 'young', 'mature')),
  
  moisture_threshold INTEGER DEFAULT 50,
  sensor_id TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_pots_user_id ON pots(user_id);
CREATE INDEX idx_pots_sensor_id ON pots(sensor_id) WHERE sensor_id IS NOT NULL;

-- Enable RLS
ALTER TABLE pots ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own pots"
  ON pots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pots"
  ON pots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pots"
  ON pots FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pots"
  ON pots FOR DELETE
  USING (auth.uid() = user_id);

-- Create storage bucket for pot photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('pot-photos', 'pot-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "Users can upload their own pot photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'pot-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view pot photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'pot-photos');
