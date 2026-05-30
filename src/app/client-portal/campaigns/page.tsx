import { Suspense } from 'react';
import CampaignsContent from './CampaignsContent';

export const dynamic = 'force-dynamic';

export default function ClientPortalCampaignsPage() {
  return (
    <Suspense fallback={<div dir="rtl" style={{ padding: 32, color: '#6b7280' }}>טוען...</div>}>
      <CampaignsContent />
    </Suspense>
  );
}
