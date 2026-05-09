'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// The wallet now lives inside the contributions section. This page just
// forwards anyone who lands here directly.
export default function WalletRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/contributions#wallet');
  }, [router]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
      <div className="text-zinc-400 text-sm">Opening wallet…</div>
    </div>
  );
}
