import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bkbjuerluzdpsxiidlzh.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_9qebA-YUW3myzX8_3w-nDA_6VhgqBeU';

export const supabase = createBrowserClient(
  supabaseUrl,
  supabaseAnonKey
);
