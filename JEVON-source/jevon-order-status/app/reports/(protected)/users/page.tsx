import {redirect} from 'next/navigation';
import {requireReportsUser} from '../../../../lib/reports-auth';
import {pool} from '../../../../scripts/postgres-storage.mjs';
import UsersForm from './users-form';
export default async function UsersPage(){
 const user=await requireReportsUser();if(user.role!=='admin')redirect('/reports');
 const [users,employees]=await Promise.all([pool.query('SELECT id,username,full_name AS "fullName",role,active,employee_id AS "employeeId" FROM reports_users ORDER BY id'),pool.query('SELECT id,name,department FROM employees WHERE active ORDER BY name')]);
 return <UsersForm initialUsers={users.rows} employees={employees.rows}/>;
}
