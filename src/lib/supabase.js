import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eiwmmhnavpzuvolmhuwi.supabase.co';
const supabaseKey = 'sb_publishable_VZHUj4D4EYRaXnub4ppSng_VWL8qTjE';

export const supabase = createClient(supabaseUrl, supabaseKey);
