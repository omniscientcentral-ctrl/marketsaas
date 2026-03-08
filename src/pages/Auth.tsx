import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthForm } from "@/components/AuthForm";
import { useAuth } from "@/hooks/useAuth";
import { getHomePathForRole } from "@/config/navigation";

const Auth = () => {
  const { user, loading, activeRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !loading && activeRole) {
      const redirectPath = getHomePathForRole(activeRole);
      navigate(redirectPath);
    }
  }, [user, loading, activeRole, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  return <AuthForm />;
};

export default Auth;
