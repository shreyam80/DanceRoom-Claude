# Supabase Setup

## 1. Run migrations

Open the **SQL Editor** in your Supabase project dashboard and run the files in order:

1. `migrations/001_create_tables.sql`
2. `migrations/002_rls_policies.sql`

## 2. Create the storage bucket

1. Go to **Storage** in the Supabase dashboard
2. Click **New bucket**
3. Name it: `rehearsal-videos`
4. Set **Public**: OFF (private bucket)
5. Click **Create bucket**

## 3. Add storage policies

In **Storage → rehearsal-videos → Policies**, add the following:

### Upload policy (INSERT)
- **Policy name:** `Authenticated users can upload videos`
- **Allowed operation:** INSERT
- **Target roles:** authenticated
- **USING expression:** `(auth.uid()::text = (storage.foldername(name))[1])`

### Read policy (SELECT)
- **Policy name:** `Authenticated users can read videos`
- **Allowed operation:** SELECT
- **Target roles:** authenticated
- **USING expression:** `auth.role() = 'authenticated'`

> Note: The backend uses the service role key to generate signed URLs, so backend-to-storage reads bypass RLS automatically.
