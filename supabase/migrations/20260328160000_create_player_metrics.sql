-- Create postalpeek_player_metrics table
CREATE TABLE IF NOT EXISTS public.postalpeek_player_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    game_type TEXT NOT NULL,
    games_played INT NOT NULL DEFAULT 0,
    total_wins INT NOT NULL DEFAULT 0,
    best_time_s INT,
    best_clicks INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, game_type)
);

-- Setup RLS
ALTER TABLE public.postalpeek_player_metrics ENABLE ROW LEVEL SECURITY;

-- Allow users to read, insert, and update their own metrics
CREATE POLICY "Users can manage their own metrics"
    ON public.postalpeek_player_metrics
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Add index on user_id for faster lookups since we frequently query a user's metrics
CREATE INDEX idx_postalpeek_player_metrics_user_id ON public.postalpeek_player_metrics(user_id);
