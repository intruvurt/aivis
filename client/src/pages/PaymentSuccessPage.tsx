import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const [refreshed, setRefreshed] = useState(false);

  useEffect(() => {
    // Refresh user data to pick up the new tier from the webhook
    refreshUser().finally(() => setRefreshed(true));
  }, [refreshUser]);

  return (
    <div className="min-h-screen page-splash-bg bg-[#2e3646] flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-2xl card-charcoal/30 flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl"></span>
        </div>

        <div className="lonely-text mb-4">
          <h1 className="text-2xl font-bold text-white mb-3">Payment Successful!</h1>
          <p className="text-white/55">
            Thank you for upgrading your plan. Your new features are now active.
          </p>
        </div>

        {sessionId && (
          <p className="text-white/60 text-xs mb-6 lonely-text inline-block">
            Session: {sessionId.slice(0, 20)}…
          </p>
        )}

        {!refreshed && (
          <p className="text-white/80 text-sm mb-6 animate-pulse lonely-text inline-block">
            Updating your account…
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/analyze"
            className="px-6 py-2.5 rounded-xl bg-charcoal hover:bg-charcoal text-white text-sm font-semibold transition-colors"
          >
            Start Analyzing
          </Link>
          <Link
            to="/billing"
            className="px-6 py-2.5 rounded-xl bg-charcoal-light hover:bg-charcoal text-white/75 text-sm font-semibold transition-colors border border-white/10"
          >
            View Billing
          </Link>
        </div>
      </div>
    </div>
  );
}
