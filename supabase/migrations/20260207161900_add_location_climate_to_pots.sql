-- Add location and climate columns to pots table
ALTER TABLE pots
  ADD COLUMN latitude DECIMAL(10, 8),
  ADD COLUMN longitude DECIMAL(11, 8),
  ADD COLUMN address TEXT,
  ADD COLUMN temperature DECIMAL(5, 2),
  ADD COLUMN humidity INTEGER,
  ADD COLUMN weather_condition TEXT,
  ADD COLUMN weather_description TEXT;

-- Add index for location queries (future feature: nearby pots)
CREATE INDEX idx_pots_location ON pots(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Add comment
COMMENT ON COLUMN pots.latitude IS 'GPS latitude at registration time';
COMMENT ON COLUMN pots.longitude IS 'GPS longitude at registration time';
COMMENT ON COLUMN pots.address IS 'Human-readable address from reverse geocoding';
COMMENT ON COLUMN pots.temperature IS 'Temperature in Celsius at registration';
COMMENT ON COLUMN pots.humidity IS 'Relative humidity percentage at registration';
COMMENT ON COLUMN pots.weather_condition IS 'Weather condition (Clear, Cloudy, etc.)';
COMMENT ON COLUMN pots.weather_description IS 'Detailed weather description';
