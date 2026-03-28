-- Fix pot-photos bucket configuration and policies

-- 1. Ensure the bucket is public (files are accessible via public URL)
UPDATE storage.buckets
SET public = true
WHERE id = 'pot-photos';

-- 2. Drop existing restrictive policies to avoid conflicts
DROP POLICY IF EXISTS "Users can upload their own pot photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view pot photos" ON storage.objects;

-- 3. Create a more robust upload policy
-- Allows users to upload ANY file to a folder matching their user ID
-- structure: pot-photos/USER_ID/filename.jpg
CREATE POLICY "Users can upload their own pot photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'pot-photos' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Create a policy to allow users to update/delete their own photos
DROP POLICY IF EXISTS "Users can update their own pot photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own pot photos" ON storage.objects;
CREATE POLICY "Users can update their own pot photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'pot-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own pot photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'pot-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 5. Ensure public read access
CREATE POLICY "Anyone can view pot photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'pot-photos');
