import { Navigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

export function Home() {
  const { isAuthenticated } = useAuthStore();
  return <Navigate to={isAuthenticated ? "/dashboard" : "/"} replace />;
}

