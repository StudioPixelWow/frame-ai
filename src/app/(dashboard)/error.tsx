'use client';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-8">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">🔧</div>
        <h2 className="text-xl font-bold text-white mb-2">משהו השתבש</h2>
        <p className="text-sm text-white/60 mb-6 leading-relaxed">
          הדף נתקל בשגיאה. אפשר לנסות לטעון מחדש או לחזור לדף הראשי.
        </p>
        {process.env.NODE_ENV === 'development' && error?.message && (
          <pre className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-xs text-left dir-ltr overflow-auto max-h-40 mb-4">
            {error.message}
          </pre>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            נסה שוב
          </button>
          <a
            href="/"
            className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-colors"
          >
            דף ראשי
          </a>
        </div>
      </div>
    </div>
  );
}
