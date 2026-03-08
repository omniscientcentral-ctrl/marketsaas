import { useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [activeRole, setActiveRole] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Fetch user roles when session changes
        if (session?.user) {
          setTimeout(() => {
            fetchUserRoles(session.user.id);
          }, 0);
        } else {
          setUserRole(null);
          setUserRoles([]);
          setActiveRole(null);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        fetchUserRoles(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRoles = async (userId: string) => {
    try {
      // Obtener perfil con estado activo y rol por defecto
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("is_active, default_role")
        .eq("id", userId)
        .maybeSingle();

      if (profileError) {
        console.error("Error fetching profile:", profileError);
        return;
      }

      if (!profile) {
        console.warn("No profile found for user:", userId);
        setUserRoles([]);
        setActiveRole(null);
        setUserRole(null);
        return;
      }

      setIsActive(profile?.is_active ?? true);

      // Si el usuario está inactivo, cerrar sesión
      if (!profile?.is_active) {
        await signOut();
        return;
      }

      // Obtener todos los roles del usuario
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (rolesError) {
        console.error("Error fetching roles:", rolesError);
        return;
      }

      const roles = rolesData?.map((r: any) => r.role).filter(Boolean) || [];
      setUserRoles(roles);

      // Establecer rol activo (el guardado en localStorage o el default_role o el primero)
      const savedRole = localStorage.getItem(`activeRole_${userId}`);
      let currentRole: any = roles[0] || null;

      if (savedRole && roles.includes(savedRole as any)) {
        currentRole = savedRole;
      } else if (profile?.default_role && roles.includes(profile.default_role as any)) {
        currentRole = profile.default_role;
      }

      setUserRole(currentRole);
      setActiveRole(currentRole);

      if (currentRole) {
        localStorage.setItem(`activeRole_${userId}`, currentRole);
      }
    } catch (error) {
      console.error("Error in fetchUserRoles:", error);
    }
  };

  const switchRole = (newRole: string) => {
    if (userRoles.includes(newRole)) {
      setUserRole(newRole as any);
      setActiveRole(newRole as any);
      if (user?.id) {
        localStorage.setItem(`activeRole_${user.id}`, newRole);
      }
    }
  };

  const signOut = async () => {
    try {
      // Limpiar sesión local primero para evitar errores de "Auth session missing!"
      await (supabase.auth.signOut as any)({ scope: "local" });

      // Intentar cerrar sesión global (ignorar errores si no hay sesión activa)
      try {
        await (supabase.auth.signOut as any)({ scope: "global" });
      } catch (e) {
        console.warn("Global signOut failed (ignored):", e);
      }
      
      // Limpiar almacenamiento local de rol activo
      if (user?.id) {
        localStorage.removeItem(`activeRole_${user.id}`);
      }

      // Limpiar estado local
      setUserRole(null);
      setUserRoles([]);
      setActiveRole(null);
      setUser(null);
      setSession(null);
      
      // Redirigir al login
      navigate("/auth");
    } catch (error) {
      console.error("Error in signOut:", error);
      // Limpiar estado y redirigir incluso si hay error
      if (user?.id) {
        localStorage.removeItem(`activeRole_${user.id}`);
      }
      setUserRole(null);
      setUserRoles([]);
      setActiveRole(null);
      setUser(null);
      setSession(null);
      navigate("/auth");
    }
  };

  return { 
    user, 
    session, 
    loading, 
    userRole, 
    userRoles,
    activeRole,
    isActive,
    switchRole,
    signOut 
  };
};
