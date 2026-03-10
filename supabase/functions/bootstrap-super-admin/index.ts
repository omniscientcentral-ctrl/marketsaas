import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, serviceRole, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Check if super_admin already exists
    const { data: existingRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'super_admin')

    if (existingRoles && existingRoles.length > 0) {
      return new Response(JSON.stringify({ error: 'Super admin already exists' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const body = await req.json()
    const { email, password } = body

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Create auth user
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'Omniscient' },
    })

    if (createError) throw new Error(createError.message)
    if (!newUser.user) throw new Error('User creation failed')

    const userId = newUser.user.id

    // Update profile - no empresa_id restriction for super_admin
    await supabase.from('profiles').update({
      full_name: 'Omniscient',
      email,
      is_active: true,
      default_role: 'super_admin',
      empresa_id: null,
    }).eq('id', userId)

    // Assign super_admin role
    await supabase.from('user_roles').insert({
      user_id: userId,
      role: 'super_admin',
    })

    console.log('Super admin created:', userId)

    return new Response(JSON.stringify({ success: true, userId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
