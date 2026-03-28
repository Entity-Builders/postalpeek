-- Expand plant_species_care_guides with comprehensive metadata
-- This enables token-efficient caching of species information

ALTER TABLE plant_species_care_guides
  -- Basic Information (already have species_name, variety)
  ADD COLUMN common_name TEXT,
  
  -- Care Requirements (expanding existing fields)
  ADD COLUMN watering_amount TEXT,
  ADD COLUMN misting_required BOOLEAN,
  ADD COLUMN misting_frequency TEXT,
  ADD COLUMN light_requirements TEXT,
  ADD COLUMN light_hours TEXT,
  ADD COLUMN temperature_range TEXT,
  ADD COLUMN humidity_level TEXT,
  
  -- Soil & Fertilization (fertilizer_frequency already exists)
  ADD COLUMN soil_type TEXT,
  ADD COLUMN fertilizer_type TEXT,
  ADD COLUMN fertilizer_season TEXT,
  
  -- Additional Care (pruning_info already exists)
  ADD COLUMN repotting_frequency TEXT,
  ADD COLUMN common_issues TEXT,
  ADD COLUMN seasonal_care TEXT,
  
  -- Growth & Lifecycle
  ADD COLUMN growth_rate TEXT,
  ADD COLUMN mature_height TEXT,
  ADD COLUMN mature_width TEXT,
  ADD COLUMN lifespan TEXT,
  ADD COLUMN time_to_harvest TEXT,
  ADD COLUMN flowering_season TEXT,
  ADD COLUMN fruiting_season TEXT,
  
  -- Pests & Safety
  ADD COLUMN common_pests TEXT[], -- Array of pest names
  ADD COLUMN pest_prevention TEXT,
  ADD COLUMN disease_susceptibility TEXT,
  ADD COLUMN pet_safe BOOLEAN,
  ADD COLUMN child_safe BOOLEAN,
  
  -- Propagation
  ADD COLUMN propagation_method TEXT,
  ADD COLUMN propagation_difficulty TEXT,
  ADD COLUMN best_propagation_season TEXT,
  
  -- Special Features
  ADD COLUMN edible_parts TEXT,
  ADD COLUMN air_purifying BOOLEAN,
  ADD COLUMN fragrant BOOLEAN,
  ADD COLUMN attracts_wildlife TEXT,
  ADD COLUMN drought_tolerant BOOLEAN,
  ADD COLUMN cold_hardy BOOLEAN,
  
  -- Metadata
  ADD COLUMN notes TEXT;

-- Create index on common_name for faster lookups
CREATE INDEX idx_care_guides_common_name ON plant_species_care_guides(common_name);

-- Add comment explaining the table's purpose
COMMENT ON TABLE plant_species_care_guides IS 
  'Comprehensive plant species metadata cache. Populated by AI on first encounter, then reused to save tokens on subsequent requests.';
