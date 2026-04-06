import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { API_URL } from "../config";

/**
 * Handles `/r/:code` referral links.
 * Calls the tracking API and redirects to the agreement page with the access token.
 */
export default function ReferralRedirect() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!code) { setError(true); return; }

    fetch(`${API_URL}/api/agreements/r/${encodeURIComponent(code)}`, {
      headers: { Accept: "application/json" },
    })
      .then((res) => {
        if (!res.ok) throw new Error("not found");
        return res.json();
      })
      .then((data: { redirect_url: string }) => {
        try {
          const url = new URL(data.redirect_url);
          navigate(`${url.pathname}${url.search}`, { replace: true });
        } catch {
          window.location.href = data.redirect_url;
        }
      })
      .catch(() => setError(true));
  }, [code, navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#0d0d14] flex items-center justify-center text-white/50">
        <p>Invite link not found or expired.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0d14] flex items-center justify-center text-white/50">
      <Loader2 className="animate-spin mr-2" size={18} /> Redirecting...
    </div>
  );
}
