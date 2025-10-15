-- Add admin role to profiles table
ALTER TABLE profiles ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;

-- Add index for admin lookups
CREATE INDEX idx_profiles_is_admin ON profiles(is_admin) WHERE is_admin = true;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add is_public flag to documents table
ALTER TABLE documents ADD COLUMN is_public BOOLEAN DEFAULT FALSE;

-- Add index for public documents
CREATE INDEX idx_documents_is_public ON documents(is_public) WHERE is_public = true;

-- Update documents RLS policies to allow viewing public documents
DROP POLICY IF EXISTS "Users can view own documents" ON documents;
CREATE POLICY "Users can view own and public documents"
  ON documents
  FOR SELECT
  USING (auth.uid() = user_id OR is_public = true);

-- Only admins can create public documents
DROP POLICY IF EXISTS "Users can insert own documents" ON documents;
CREATE POLICY "Users can insert own documents"
  ON documents
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND 
    (NOT is_public OR public.is_admin(auth.uid()))
  );

-- Only admins can make documents public via update
DROP POLICY IF EXISTS "Users can update own documents" ON documents;
CREATE POLICY "Users can update own documents"
  ON documents
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id AND
    (NOT is_public OR public.is_admin(auth.uid()))
  );

-- Update chunks RLS to allow viewing chunks from public documents
DROP POLICY IF EXISTS "Users can view their own chunks" ON chunks;
CREATE POLICY "Users can view own and public chunks"
  ON chunks
  FOR SELECT
  USING (
    auth.uid() = user_id OR 
    document_id IN (SELECT id FROM documents WHERE is_public = true)
  );

-- Add comment for documentation
COMMENT ON COLUMN profiles.is_admin IS 'Admin users can create public documents visible to all users';
COMMENT ON COLUMN documents.is_public IS 'Public documents are visible to all users (shared corpus)';
