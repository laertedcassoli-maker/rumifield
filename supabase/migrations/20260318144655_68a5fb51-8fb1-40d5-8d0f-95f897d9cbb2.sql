-- Allow authenticated users to update preventive_part_consumption
CREATE POLICY "Authenticated users can update preventive_part_consumption"
ON public.preventive_part_consumption
FOR UPDATE
TO authenticated
USING (true);

-- Allow authenticated users to delete preventive_part_consumption
CREATE POLICY "Authenticated users can delete preventive_part_consumption"
ON public.preventive_part_consumption
FOR DELETE
TO authenticated
USING (true);