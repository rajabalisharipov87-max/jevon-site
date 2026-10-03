'use client';
import {useEffect,useState,type ReactNode,type FormEvent} from 'react';
export function ClientGate({children}:{children:ReactNode}){
 const [ready,setReady]=useState(false),[phone,setPhone]=useState(''),[pin,setPin]=useState(''),[issuedCode,setIssuedCode]=useState(''),[step,setStep]=useState<'login'|'phone'|'password'>('login'),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{try{const stored=localStorage.getItem('jevon_client_phone')||'';setPhone(stored);}catch{}fetch('/api/client-auth',{cache:'no-store'}).then(r=>r.json() as Promise<{authenticated:boolean}>).then(data=>setReady(!!data.authenticated)).catch(()=>setError('Не удалось проверить вход')).finally(()=>setLoading(false))},[]);
 function changeStep(next:'login'|'phone'){setStep(next);setError('');setMessage('');setPin('');setIssuedCode('')}
 async function submit(event:FormEvent){
  event.preventDefault();setBusy(true);setError('');setMessage('');
  try{
   const response=await fetch('/api/client-auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone,pin,token:new URLSearchParams(window.location.search).get('t'),action:step==='phone'?'register':'login'})});
   const data=await response.json() as {code?:string;phone?:string;error?:string;message?:string};
   if(!response.ok)throw Error(data.error||'Не удалось войти');
   try{localStorage.setItem('jevon_client_phone',data.phone||phone)}catch{}
   if(step==='phone'&&data.code){setIssuedCode(data.code);setStep('password');return}
   setReady(true);
  }catch(e){setError(e instanceof Error?e.message:'Не удалось войти')}finally{setBusy(false)}
 }
 if(ready)return children;
 const setup=step==='password';
 const editPin=(value:string)=>{setPin(value.replace(/\D/g,'').slice(0,5))};
 return <main className="client-login"><div className="login-wrap"><header className="login-brand"><div className="brand-mark" aria-hidden="true">J</div><div><strong>JEVON</strong><span>Личный кабинет клиента</span></div></header><section className="card login-card"><span className="eyebrow">{setup?'Добро пожаловать':step==='phone'?'Регистрация клиента':'Вход для клиентов'}</span><h1>{step==='phone'?'Регистрация':setup?'Спасибо, что выбрали JEVON!':'Введите ваш пароль'}</h1><p>{step==='phone'?'Введите ваш номер телефона. К нему будет привязан личный кабинет.':setup?'Сохраните этот код. Он нужен для входа и просмотра ваших заказов.':'Введите пароль, чтобы увидеть ваши заказы.'}</p>{setup?<div className="issued-code-panel"><div className="issued-code" aria-label="Ваш код для входа">{issuedCode}</div><p>Не передавайте код другим людям. Если забудете — обратитесь к менеджеру.</p><button type="button" onClick={()=>setReady(true)}>Я сохранил код · Открыть заказ</button></div>:loading?<p>Проверяем вход…</p>:<form onSubmit={submit}>
 {step==='phone'&&<label>Номер телефона<input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+992… или +7…" required maxLength={24}/></label>}
 {step!=='phone'&&<div className="pin-entry"><label htmlFor="client-pin">{setup?'Придумайте пароль из 5 цифр':'Пароль из 5 цифр'}</label><div className="pin-dots"><input id="client-pin" aria-label={setup?'Придумайте пароль из 5 цифр':'Пароль из 5 цифр'} type="password" inputMode="numeric" pattern="[0-9]{5}" minLength={5} maxLength={5} autoComplete={setup?'new-password':'current-password'} value={pin} onChange={e=>editPin(e.target.value)} required/>{Array.from({length:5},(_,i)=><span key={i} className={i<pin.length?'filled':''}/>)}</div><div className="login-keypad">{['1','2','3','4','5','6','7','8','9','Очистить','0','⌫'].map(key=><button type="button" key={key} disabled={busy} aria-label={key==='⌫'?'Удалить последнюю цифру':key} onClick={()=>editPin(key==='Очистить'?'':key==='⌫'?pin.slice(0,-1):pin+key)}>{key}</button>)}</div></div>}
 <button disabled={busy} type="submit">{busy?'Подождите…':step==='phone'?'Продолжить':setup?'Сохранить и войти':'Войти'}</button>
 {error&&<p className="error" role="alert">{error}</p>}{message&&!setup&&<p className="login-message" role="status">{message}</p>}
 {step==='login'?<div className="registration-link"><span>Нет пароля?</span><button type="button" onClick={()=>changeStep('phone')}>Регистрация</button></div>:<button type="button" className="login-back" onClick={()=>changeStep('login')}>Уже есть пароль? Войти</button>}
 </form>}</section></div></main>;
}
