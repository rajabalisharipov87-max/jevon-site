'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function SiteNavigation() {
  const pathname = usePathname();
  if (pathname === '/attendance' || pathname.startsWith('/attendance/')) return null;

  return (
    <nav style={{ height: 40, display: 'flex', gap: 24, alignItems: 'center', padding: '0 16px', background: '#0e3a5a', color: 'white', position: 'relative', zIndex: 100, overflowX: 'auto', whiteSpace: 'nowrap' }}>
      <Link href="/">Заказы</Link>
      <Link href="/attendance">Приход / уход</Link>
      <Link href="/employees">Сотрудники и журнал</Link>
      <Link href="/reports">Отчёты</Link>
    </nav>
  );
}
