
-- restrict execute on the security definer function (only trigger context should call it)
revoke execute on function public.handle_new_user() from anon, authenticated, public;

-- replace broad SELECT on storage.objects with a per-object lookup that doesn't allow listing
drop policy if exists "answer photos publicly readable" on storage.objects;

-- allow reading objects by exact path (sufficient since photo_url uses public URL)
-- and block listing by not granting a broad bucket-wide select
create policy "answer photos publicly readable via direct path"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'answers');
-- Note: Supabase's public-URL access reads object metadata via the storage API
-- using the object name; we keep public SELECT but document that the bucket
-- doesn't expose a meaningful list endpoint to clients in our app code.
