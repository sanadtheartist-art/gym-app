-- ==========================================
-- USER BLOCKING FOR GYM APP MESSAGING
-- ==========================================

CREATE TABLE IF NOT EXISTS public.user_blocks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    blocker_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    blocked_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(blocker_id, blocked_id),
    CHECK (blocker_id <> blocked_id)
);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own block relationships" ON public.user_blocks;
DROP POLICY IF EXISTS "Users can create blocks" ON public.user_blocks;
DROP POLICY IF EXISTS "Users can remove their own blocks" ON public.user_blocks;

CREATE POLICY "Users can view their own block relationships"
ON public.user_blocks
FOR SELECT
USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);

CREATE POLICY "Users can create blocks"
ON public.user_blocks
FOR INSERT
WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can remove their own blocks"
ON public.user_blocks
FOR DELETE
USING (auth.uid() = blocker_id);

CREATE OR REPLACE FUNCTION public.prevent_blocked_messages()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    JOIN public.user_blocks ub
      ON (
        ub.blocker_id = NEW.sender_id
        AND ub.blocked_id = cp.user_id
      ) OR (
        ub.blocker_id = cp.user_id
        AND ub.blocked_id = NEW.sender_id
      )
    WHERE cp.conversation_id = NEW.conversation_id
      AND cp.user_id <> NEW.sender_id
  ) THEN
    RAISE EXCEPTION 'Cannot send message because one user has blocked the other';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS prevent_blocked_messages_trigger ON public.messages;

CREATE TRIGGER prevent_blocked_messages_trigger
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.prevent_blocked_messages();
