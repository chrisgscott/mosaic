-- Add relationship_count column to entities table
ALTER TABLE entities ADD COLUMN IF NOT EXISTS relationship_count INTEGER DEFAULT 0;

-- Create function to update relationship count
CREATE OR REPLACE FUNCTION update_entity_relationship_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update source entity count
  IF TG_OP = 'DELETE' THEN
    UPDATE entities 
    SET relationship_count = (
      SELECT COUNT(*) 
      FROM relationships 
      WHERE source_entity_id = OLD.source_entity_id 
         OR target_entity_id = OLD.source_entity_id
    )
    WHERE id = OLD.source_entity_id;
    
    -- Update target entity count
    UPDATE entities 
    SET relationship_count = (
      SELECT COUNT(*) 
      FROM relationships 
      WHERE source_entity_id = OLD.target_entity_id 
         OR target_entity_id = OLD.target_entity_id
    )
    WHERE id = OLD.target_entity_id;
  ELSE
    -- For INSERT and UPDATE
    UPDATE entities 
    SET relationship_count = (
      SELECT COUNT(*) 
      FROM relationships 
      WHERE source_entity_id = NEW.source_entity_id 
         OR target_entity_id = NEW.source_entity_id
    )
    WHERE id = NEW.source_entity_id;
    
    -- Update target entity count
    UPDATE entities 
    SET relationship_count = (
      SELECT COUNT(*) 
      FROM relationships 
      WHERE source_entity_id = NEW.target_entity_id 
         OR target_entity_id = NEW.target_entity_id
    )
    WHERE id = NEW.target_entity_id;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on relationships table
DROP TRIGGER IF EXISTS trigger_update_entity_relationship_count ON relationships;
CREATE TRIGGER trigger_update_entity_relationship_count
  AFTER INSERT OR UPDATE OR DELETE ON relationships
  FOR EACH ROW
  EXECUTE FUNCTION update_entity_relationship_count();

-- Initialize counts for existing entities
UPDATE entities e
SET relationship_count = (
  SELECT COUNT(*)
  FROM relationships r
  WHERE r.source_entity_id = e.id 
     OR r.target_entity_id = e.id
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_entities_relationship_count ON entities(relationship_count DESC);
