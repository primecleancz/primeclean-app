import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://zkuexarumnixfoflrixj.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprdWV4YXJ1bW5peGZvZmxyaXhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NjEwNTIsImV4cCI6MjA4NzIzNzA1Mn0.RFFquTbG-coENC3vxw9QhupiryE7hiLwX_fAjQdJggg'

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
