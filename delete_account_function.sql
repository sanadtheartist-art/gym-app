-- ============================================================
-- JEXI: Self-Delete Account Function
-- Run this ONCE in your Supabase SQL Editor to enable
-- the "Delete Account" button in the app.
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- All table rows cascade-delete automatically because
  -- workouts, splits, and split_exercises all reference
  -- auth.users(id) ON DELETE CASCADE.
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

-- Grant permission for any authenticated user to call this function
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
