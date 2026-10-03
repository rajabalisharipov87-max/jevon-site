import {requireReportsUser} from '../../../lib/reports-auth';
import {pool} from '../../../scripts/postgres-storage.mjs';
export default async function ReportsPage(){
 await requireReportsUser();
 const {rows:[counts]}=await pool.query('SELECT (SELECT count(*) FROM synced_orders) AS orders,(SELECT count(*) FROM employees WHERE active) AS employees,(SELECT count(*) FROM attendance_events) AS events,(SELECT count(*) FROM reports_users WHERE active) AS users');
 const {rows}=await pool.query('SELECT e.name,e.department,count(a.id)::integer AS events,max(a.created_at) AS last_event FROM employees e LEFT JOIN attendance_events a ON a.employee_id=e.id GROUP BY e.id ORDER BY e.name');
 return <><div className="grid gap-4 sm:grid-cols-4">{[['Заказы',counts.orders],['Активные сотрудники',counts.employees],['Отметки посещаемости',counts.events],['Пользователи портала',counts.users]].map(([label,value])=><div key={String(label)} className="rounded-xl border bg-white p-4"><p>{label}</p><p className="text-3xl font-bold">{value}</p></div>)}</div><h2 className="text-xl font-bold">Посещаемость сотрудников</h2><table className="w-full text-left"><thead><tr><th>Сотрудник</th><th>Отдел</th><th>Отметок</th><th>Последняя отметка</th></tr></thead><tbody>{rows.map(row=><tr key={row.name+'-'+row.department}><td>{row.name}</td><td>{row.department}</td><td>{row.events}</td><td>{row.last_event?new Date(row.last_event).toLocaleString('ru-RU',{timeZone:'Asia/Dushanbe'}):'Нет отметок'}</td></tr>)}</tbody></table></>;
}
