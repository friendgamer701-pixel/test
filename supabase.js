import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = 'https://bifwksautkkfyvbwgwls.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpZndrc2F1dGtrZnl2Yndnd2xzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2MTM5OTcsImV4cCI6MjA3ODE4OTk5N30.5lNGfRNN_PKwYDTL92rHnEsZEoAE0x0VRb62WBVo_r4'

export const supabase = createClient(supabaseUrl, supabaseKey)

export async function checkAdmin(user) {
  if (!user) return false

  try {
    const { data, error } = await supabase
      .from('user_roles')       
      .select('role')
      .eq('user_id', user.id)   
      .single()

    if (error || !data) {
      console.warn("Admin check failed (User might not be in user_roles table):", error?.message)
      return false
    }

    return data.role === 'admin' 

  } catch (err) {
    console.error("Unexpected error checking admin:", err)
    return false
  }
}