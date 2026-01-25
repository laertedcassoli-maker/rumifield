-- Add public flag to system_documentation for future granular control
ALTER TABLE public.system_documentation 
ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT true;

-- Create RLS policy for anonymous/public read access
CREATE POLICY "Public can read public documentation"
ON public.system_documentation
FOR SELECT
TO anon
USING (is_public = true);