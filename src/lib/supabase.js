import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://hdgiwrwcxfbojqfeyrxn.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkZ2l3cndjeGZib2pxZmV5cnhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NTUxNzMsImV4cCI6MjA5NjMzMTE3M30.Ul4cEtYBxj0EmSASokj0jZAJnRa9JKXygfzl0838sAo'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
