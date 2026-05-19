'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function VideoWizardRedirect() {
  const router = useRouter();
  // The original wizard stays at /projects/new for now.
  // This route exists as an explicit entry point for "single video" mode.
  useEffect(() => {
    router.replace('/projects/new?mode=video');
  }, [router]);
  return null;
}
