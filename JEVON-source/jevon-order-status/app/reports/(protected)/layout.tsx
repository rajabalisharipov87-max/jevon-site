import Link from 'next/link';
import {requireReportsUser} from '../../../lib/reports-auth';
export const dynamic='force-dynamic';
export default async function ReportsLayout({children}:{children:React.ReactNode}){
 const user=await requireReportsUser();
 return <section className="mx-auto max-w-6xl space-y-6 p-6"><header className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-2xl font-bold">Портал отчётов</h1><p>{user.fullName} · {user.role==='admin'?'Администратор':'Аналитик'}</p></div><nav className="flex items-center gap-4"><Link href="/reports">Обзор</Link>{user.role==='admin'&&<Link href="/reports/users">Пользователи</Link>}<form action="/api/reports/logout" method="post"><button className="rounded border px-3 py-2">Выйти</button></form></nav></header>{children}</section>;
}
