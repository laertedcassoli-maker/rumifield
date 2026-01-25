-- Add structured AI metadata fields to system_documentation
ALTER TABLE public.system_documentation 
ADD COLUMN IF NOT EXISTS ai_metadata jsonb DEFAULT '{}'::jsonb;

-- Create index for faster AI queries
CREATE INDEX IF NOT EXISTS idx_system_documentation_category ON public.system_documentation(category);
CREATE INDEX IF NOT EXISTS idx_system_documentation_slug ON public.system_documentation(slug);

-- Add comment explaining the ai_metadata structure
COMMENT ON COLUMN public.system_documentation.ai_metadata IS 'Structured metadata for AI consumption. Schema: {
  "type": "module|rule|table|permission",
  "scope": "functional scope description",
  "business_rules": ["rule1", "rule2"],
  "events": ["event1", "event2"],
  "related_tables": ["table1", "table2"],
  "main_fields": ["field1", "field2"],
  "possible_statuses": ["status1", "status2"],
  "enabled_metrics": ["metric1", "metric2"],
  "practical_examples": ["example1", "example2"]
}';