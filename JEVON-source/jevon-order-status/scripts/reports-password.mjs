import {randomBytes,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const derive=promisify(scrypt);
export async function hashPassword(password){
  const salt=randomBytes(16).toString('hex');
  const hash=await derive(password,salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024});
  return `scrypt:${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password,encoded){
  const [scheme,salt,hex]=encoded?.split(':')??[];
  // A missing account performs the same expensive operation as an existing one.
  const valid=scheme==='scrypt'&&/^[a-f0-9]{32}$/.test(salt??'')&&/^[a-f0-9]{128}$/.test(hex??'');
  const hash=await derive(password,valid?salt:'00000000000000000000000000000000',64,{N:16384,r:8,p:1,maxmem:64*1024*1024});
  return valid&&timingSafeEqual(hash,Buffer.from(hex,'hex'));
}
