import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateUserRequest {
  email: string
  password: string
  fullName: string
  phone?: string
  pin?: string
  roles: string[]
  defaultRole: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Verificar autenticación
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing or invalid token' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !serviceRole) {
      return new Response(JSON.stringify({ error: 'Missing Supabase service configuration' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    // Cliente con service role
    const supabaseService = createClient(supabaseUrl, serviceRole, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Decodificar JWT (el runtime ya lo validó)
    const jwt = authHeader.replace('Bearer ', '')
    let requesterId: string | null = null
    try {
      const payload = JSON.parse(atob(jwt.split('.')[1]))
      requesterId = payload.sub
    } catch (_) {}

    if (!requesterId) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token payload' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    // Verificar que el solicitante es admin
    const { data: roles } = await supabaseService
      .from('user_roles')
      .select('role')
      .eq('user_id', requesterId)

    const isAdmin = roles?.some((r: any) => r.role === 'admin' || r.role === 'super_admin')
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Only admins can create users' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    // Parsear body
    const body: CreateUserRequest = await req.json()
    console.log('Creating user:', body.email)

    // Validaciones
    if (!body.email || !body.password || !body.fullName) {
      throw new Error('Email, password and fullName are required')
    }

    if (body.password.length < 5) {
      throw new Error('Password must be at least 5 characters')
    }

    if (!body.roles || body.roles.length === 0) {
      throw new Error('At least one role is required')
    }

    if (!body.roles.includes(body.defaultRole)) {
      throw new Error('Default role must be in assigned roles')
    }

    // supabaseService ya creado arriba

    // Crear usuario con admin API (ya confirmado)
    const { data: newUser, error: createError } = await supabaseService.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true, // Usuario ya confirmado
      user_metadata: {
        full_name: body.fullName
      }
    })

    if (createError) {
      console.error('Error creating user:', createError)
      throw new Error(createError.message)
    }

    if (!newUser.user) {
      throw new Error('User creation failed')
    }

    console.log('User created:', newUser.user.id)

    // Actualizar perfil con datos adicionales
    const { error: profileError } = await supabaseService
      .from('profiles')
      .update({
        phone: body.phone || null,
        pin: body.pin || null,
        is_active: true,
        default_role: body.defaultRole,
        email: body.email
      })
      .eq('id', newUser.user.id)

    if (profileError) {
      console.error('Error updating profile:', profileError)
    }

    // Asignar roles
    for (const role of body.roles) {
      const { error: roleError } = await supabaseService
        .from('user_roles')
        .insert({ user_id: newUser.user.id, role })

      if (roleError) {
        console.error('Error assigning role:', roleError)
      }

      // Registrar en auditoría
      await supabaseService.from('role_assignment_logs').insert({
        user_id: newUser.user.id,
        role,
        action: 'add',
        assigned_by: requesterId
      })
    }

    console.log('User setup completed:', newUser.user.id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId: newUser.user.id 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error in create-user function:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ 
        error: errorMessage
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
