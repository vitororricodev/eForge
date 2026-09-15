import { useEffect,useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { readDraft } from '@/lib/workout-storage';
import { syncDraft } from '@/lib/workout-sync';
import { Link } from '@tanstack/react-router';
type InstallEvent=Event & {prompt:()=>Promise<void>};
export function MobileApp(){
 const {user}=useAuth();const [offline,setOffline]=useState(false);const [install,setInstall]=useState<InstallEvent|null>(null);const [waiting,setWaiting]=useState<ServiceWorker|null>(null);const [resume,setResume]=useState<string|null>(null);
 useEffect(()=>{ const connection=()=>{setOffline(!navigator.onLine);if(user){const d=readDraft(user.id);setResume(d&&!d.finished?d.workoutId:null);if(d?.finished&&!d.synced)syncDraft(d).catch(()=>{});}};connection();window.addEventListener('online',connection);window.addEventListener('offline',connection);window.addEventListener('focus',connection);return()=>{window.removeEventListener('online',connection);window.removeEventListener('offline',connection);window.removeEventListener('focus',connection)}},[user?.id]);
 useEffect(()=>{const handler=(e:Event)=>{e.preventDefault();setInstall(e as InstallEvent)};window.addEventListener('beforeinstallprompt',handler);
 if('serviceWorker' in navigator && import.meta.env.PROD)navigator.serviceWorker.register('/sw.js').then(r=>{if(r.waiting)setWaiting(r.waiting);r.addEventListener('updatefound',()=>{const w=r.installing;w?.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)setWaiting(w)})})}).catch(()=>{});
 return()=>window.removeEventListener('beforeinstallprompt',handler)},[]);
 return <div className="mx-auto max-w-lg px-4 text-sm">{offline&&<p role="status" className="p-3 surface">Sem conexão • seus treinos ficam salvos neste aparelho.</p>}{install&&<button className="text-neon" onClick={async()=>{await install.prompt();setInstall(null)}}>Instalar eForge ↗</button>}{waiting&&<button onClick={()=>{if(user&&readDraft(user.id)&&!readDraft(user.id)?.finished){alert('Finalize seu treino antes de atualizar.');return;}waiting.postMessage('SKIP_WAITING');navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true})}}>Nova versão • Atualizar</button>}{resume&&<Link className="block p-3 text-neon" to="/run/$workoutId" params={{workoutId:resume}}>Continuar treino em andamento →</Link>}</div>
}
