import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UpdateCredentialsRequest {
  userId: string
  newEmail?: string
  newPassword?: string
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

    // Decodificar JWT (validado por el runtime)
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

    // Verificar rol admin
    const { data: roles } = await supabaseService
      .from('user_roles')
      .select('role')
      .eq('user_id', requesterId)

    const isAdmin = roles?.some((r: any) => r.role === 'admin' || r.role === 'super_admin')
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Only admins can update user credentials' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    // Parsear body
    const body: UpdateCredentialsRequest = await req.json()
    console.log('Updating credentials for user:', body.userId)

    // Validaciones
    if (!body.userId) {
      throw new Error('userId is required')
    }

    if (!body.newEmail && !body.newPassword) {
      throw new Error('At least newEmail or newPassword must be provided')
    }

    // Validar formato de email si se proporciona
    if (body.newEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(body.newEmail)) {
        throw new Error('Invalid email format')
      }
    }

    // Validar contraseña si se proporciona
    if (body.newPassword && body.newPassword.length < 5) {
      throw new Error('Password must be at least 5 characters')
    }

    // Cliente service role ya creado arriba: supabaseService

    // Preparar datos de actualización
    const updateData: any = {}
    if (body.newEmail) {
      updateData.email = body.newEmail
    }
    if (body.newPassword) {
      updateData.password = body.newPassword
    }

    // Actualizar usuario en auth.users
    const { data: userData, error: updateError } = await supabaseService.auth.admin.updateUserById(
      body.userId,
      updateData
    )

    if (updateError) {
      console.error('Error updating user credentials:', updateError)
      if (updateError.message?.includes('duplicate') || updateError.message?.includes('already')) {
        throw new Error('El email ya está en uso por otro usuario')
      }
      throw new Error(updateError.message || 'Error updating user')
    }

    console.log('Credentials updated in auth.users:', body.userId)

    // Si se actualizó el email, también actualizar en profiles
    if (body.newEmail) {
      const { error: profileError } = await supabaseService
        .from('profiles')
        .update({ email: body.newEmail })
        .eq('id', body.userId)

      if (profileError) {
        console.error('Error updating email in profiles:', profileError)
      }
    }

    console.log('Credential update completed for user:', body.userId)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Credentials updated successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error in update-user-credentials function:', error)
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
