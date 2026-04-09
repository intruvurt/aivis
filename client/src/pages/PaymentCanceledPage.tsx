import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';

export default function PaymentCanceledPage() {
  usePageMeta({
    title: 'Payment Canceled',
    description: 'Your payment was canceled. You have not been charged.',
    noIndex: true,
  });
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-2xl card-charcoal flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">↩</span>
        </div>

        <div className="lonely-text mb-6">
          <h1 className="text-2xl font-bold text-white mb-3">Payment Canceled</h1>
          <p className="text-white/55">
            No worries, you haven't been charged. You can upgrade anytime.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/pricing"
            className="px-6 py-2.5 rounded-xl bg-charcoal hover:bg-charcoal text-white text-sm font-semibold transition-colors"
          >
            View Plans
          </Link>
          <Link
            to="/"
            className="px-6 py-2.5 rounded-xl bg-charcoal-light hover:bg-charcoal text-white/75 text-sm font-semibold transition-colors border border-white/10"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
