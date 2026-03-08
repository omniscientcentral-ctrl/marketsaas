import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DeleteUserRequest {
  userId: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
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

    const supabaseService = createClient(supabaseUrl, serviceRole, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

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

    const { data: roles } = await supabaseService
      .from('user_roles')
      .select('role')
      .eq('user_id', requesterId)

    const isAdmin = roles?.some((r: any) => r.role === 'admin')
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Only admins can delete users' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    const body: DeleteUserRequest = await req.json()
    console.log('Soft-deleting user:', body.userId)

    if (!body.userId) {
      throw new Error('userId is required')
    }

    if (body.userId === requesterId) {
      throw new Error('Cannot delete your own account')
    }

    // Check if user has related sales data
    const { count: salesCount } = await supabaseService
      .from('sales')
      .select('id', { count: 'exact', head: true })
      .eq('cashier_id', body.userId)

    if (salesCount && salesCount > 0) {
      // Soft delete: deactivate user in profiles
      const { error: profileError } = await supabaseService
        .from('profiles')
        .update({ is_active: false })
        .eq('id', body.userId)

      if (profileError) {
        console.error('Error deactivating user:', profileError)
        throw new Error(profileError.message)
      }

      console.log('User soft-deleted (deactivated):', body.userId)

      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'User deactivated successfully (has historical data)',
          soft_delete: true
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    // No related data: safe to hard delete
    // Save profile data BEFORE deleting for potential rollback
    const { data: profileBackup } = await supabaseService
      .from('profiles')
      .select('*')
      .eq('id', body.userId)
      .maybeSingle()

    const { data: rolesBackup } = await supabaseService
      .from('user_roles')
      .select('*')
      .eq('user_id', body.userId)

    // Remove roles and profile
    await supabaseService.from('user_roles').delete().eq('user_id', body.userId)
    await supabaseService.from('profiles').delete().eq('id', body.userId)

    const { error: deleteError } = await supabaseService.auth.admin.deleteUser(body.userId)

    if (deleteError) {
      console.error('Error deleting user:', deleteError)
      // Restore profile with original data
      if (profileBackup) {
        await supabaseService
          .from('profiles')
          .upsert({ ...profileBackup, is_active: false })
      }
      // Restore roles
      if (rolesBackup && rolesBackup.length > 0) {
        await supabaseService
          .from('user_roles')
          .upsert(rolesBackup)
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'User deactivated (could not fully delete)',
          soft_delete: true
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    console.log('User hard-deleted successfully:', body.userId)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'User deleted successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error in delete-user function:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
