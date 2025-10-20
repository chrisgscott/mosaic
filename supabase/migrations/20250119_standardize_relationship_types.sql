-- Standardize relationship types to snake_case format
-- This migration converts any plain language relationship types to snake_case

-- Update common variations
UPDATE relationships SET relationship_type = 'part_of' WHERE relationship_type IN ('is part of', 'part of', 'is_part_of');
UPDATE relationships SET relationship_type = 'depends_on' WHERE relationship_type IN ('depends on', 'is dependent on');
UPDATE relationships SET relationship_type = 'relates_to' WHERE relationship_type IN ('relates to', 'related to', 'is related to');
UPDATE relationships SET relationship_type = 'created_by' WHERE relationship_type IN ('created by', 'is created by');
UPDATE relationships SET relationship_type = 'contributes_to' WHERE relationship_type IN ('contributes to', 'is contributing to');
UPDATE relationships SET relationship_type = 'collaborates_with' WHERE relationship_type IN ('collaborates with', 'is collaborating with');

-- Log the changes
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Standardized % relationship types to snake_case format', updated_count;
END $$;
