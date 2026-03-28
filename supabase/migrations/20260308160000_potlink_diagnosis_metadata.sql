-- Agregar columna de metadatos estructurados al log de diagnóstico
ALTER TABLE potlink_diagnosis_logs
ADD COLUMN IF NOT EXISTS metadata JSONB;
