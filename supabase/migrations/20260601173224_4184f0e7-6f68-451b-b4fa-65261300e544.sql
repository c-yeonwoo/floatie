-- Make the answers bucket private (URLs no longer publicly reachable)
UPDATE storage.buckets SET public = false WHERE id = 'answers';

-- Replace SELECT policy to also allow avatars to be readable by authenticated users
DROP POLICY IF EXISTS "answer photos readable when owner or public answer" ON storage.objects;

CREATE POLICY "answer photos readable when owner, public answer, or avatar"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'answers'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1 FROM public.answers a
      WHERE a.visibility = 'public'
        AND EXISTS (
          SELECT 1 FROM unnest(a.photos) p
          WHERE p LIKE '%/' || storage.objects.name
        )
    )
    OR (
      auth.role() = 'authenticated'
      AND storage.objects.name LIKE '%/avatar-%'
    )
  )
);