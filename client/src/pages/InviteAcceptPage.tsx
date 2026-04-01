import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2, Users } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, token: accessToken } = useAuthStore();

  // Derive initial state synchronously — avoids setState inside effect
  const initialState = useMemo<'loading' | 'error' | 'auth_required'>(() => {
    if (!token) return 'error';
    if (!user || !accessToken) return 'auth_required';
    return 'loading';
  }, [token, user, accessToken]);

  const [state, setState] = useState<'loading' | 'success' | 'error' | 'auth_required'>(initialState);
  const [errorMsg, setErrorMsg] = useState(!token ? 'Invalid invite link' : '');

  useEffect(() => {
    if (!token || !user || !accessToken) return;

    const accept = async () => {
      try {
        const res = await fetch(`${API_URL}/api/workspaces/invites/${token}/accept`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const data = await res.json();

        if (res.ok && data.success) {
          setState('success');
          toast.success('Invitation accepted!');
          setTimeout(() => navigate('/team', { replace: true }), 2000);
        } else {
          setState('error');
          setErrorMsg(data.error || 'Failed to accept invitation');
        }
      } catch {
        setState('error');
        setErrorMsg('Network error — please try again');
      }
    };

    accept();
  }, [token, user, accessToken, navigate]);

  const handleLoginRedirect = () => {
    // Store the invite URL so we can redirect back after auth
    sessionStorage.setItem('aivis_post_auth_redirect', `/invite/${token}`);
    navigate('/auth');
  };

  return (
    <div className="min-h-screen page-splash-bg bg-[#2e3646] flex items-center justify-center py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-sm w-full card-charcoal rounded-2xl p-8 text-center space-y-5"
      >
        {state === 'loading' && (
          <>
            <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mx-auto" />
            <h2 className="text-xl font-bold text-white">Accepting invitation…</h2>
            <p className="text-sm text-white/60">Please wait</p>
          </>
        )}

        {state === 'success' && (
          <>
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <h2 className="text-xl font-bold text-white">You&apos;re in!</h2>
            <p className="text-sm text-white/60">Redirecting to your team workspace…</p>
          </>
        )}

        {state === 'error' && (
          <>
            <XCircle className="w-10 h-10 text-red-400 mx-auto" />
            <h2 className="text-xl font-bold text-white">Invitation Error</h2>
            <p className="text-sm text-white/60">{errorMsg}</p>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white text-sm transition-colors"
            >
              Go to Dashboard
            </button>
          </>
        )}

        {state === 'auth_required' && (
          <>
            <Users className="w-10 h-10 text-cyan-400 mx-auto" />
            <h2 className="text-xl font-bold text-white">Sign in to accept</h2>
            <p className="text-sm text-white/60">
              You need to be signed in to accept this workspace invitation.
            </p>
            <button
              onClick={handleLoginRedirect}
              className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 text-white text-sm font-medium hover:from-cyan-400 hover:to-cyan-500 transition-all"
            >
              Sign In
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}
