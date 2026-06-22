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
DECLARE
  current_user_id UUID := auth.uid();
  conversation_ids UUID[];
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Remove any chat threads this user participates in from both sides.
  -- This handles installations where messaging tables are not wired with
  -- the same cascade behavior as workouts/splits.
  IF to_regclass('public.conversation_participants') IS NOT NULL THEN
    SELECT array_agg(DISTINCT conversation_id)
    INTO conversation_ids
    FROM public.conversation_participants
    WHERE user_id = current_user_id;

    IF conversation_ids IS NOT NULL THEN
      IF to_regclass('public.messages') IS NOT NULL THEN
        DELETE FROM public.messages
        WHERE conversation_id = ANY(conversation_ids);
      END IF;

      DELETE FROM public.conversation_participants
      WHERE conversation_id = ANY(conversation_ids);

      IF to_regclass('public.conversations') IS NOT NULL THEN
        DELETE FROM public.conversations
        WHERE id = ANY(conversation_ids);
      END IF;
    END IF;
  END IF;

  IF to_regclass('public.user_blocks') IS NOT NULL THEN
    DELETE FROM public.user_blocks
    WHERE blocker_id = current_user_id
       OR blocked_id = current_user_id;
  END IF;

  -- Remaining app data can still cascade through the auth user delete.
  DELETE FROM auth.users WHERE id = current_user_id;
END;
$$;

-- Grant permission for any authenticated user to call this function
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
