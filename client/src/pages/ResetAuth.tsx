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

  return <div className="min-h-screen page-splash-bg bg-[#2e3646] text-white flex items-center justify-center">resetting…</div>;
}