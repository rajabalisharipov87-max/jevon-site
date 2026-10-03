import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {reportsUser} from '../../../lib/reports-auth';
import LoginForm from './login-form';
export default async function LoginPage(){if(await reportsUser((await cookies()).get('jevon_reports')?.value))redirect('/reports');return <LoginForm/>;}
