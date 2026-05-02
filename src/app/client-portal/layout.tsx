import LayoutContent from './LayoutContent';

export const dynamic = 'force-dynamic';

export default function ClientPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <LayoutContent>{children}</LayoutContent>;
}
