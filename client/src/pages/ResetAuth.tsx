import React, { useEffect } from "react";
import { useAuthStore } from "../stores/authStore";

export default function ResetAuth() {
  useEffect(() => {
    try {
      localStorage.removeItem("auth-storage");
      localStorage.removeItem("aivis_auth_v1");
      localStorage.removeItem("aivis_auth_v2");
    } catch {}
    useAuthStore.getState().logout();
    window.location.href = "/auth?mode=signin";
  }, []);

  return <div className="flex flex-1 items-center justify-center text-white/55 text-sm">Resetting…</div>;
}