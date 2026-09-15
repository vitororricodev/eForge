import {useEffect,useRef,useState,useId} from 'react';
import {Volume2,VolumeX} from 'lucide-react';
import {Brand} from './Brand';
import {createIntroAudio,introAudioRunning,unlockIntroAudio} from '@/lib/intro-audio';
import './forge-intro.css';
export const INTRO_HITS=[550,1100,1650];
export const INTRO_REVEAL=2150;
export const INTRO_DURATION=3700;
export function ForgeIntro({onComplete}:{onComplete:()=>void}){
 const id=useId().replace(/:/g,'');const [reduced]=useState(()=>typeof matchMedia!=='undefined'&&matchMedia('(prefers-reduced-motion: reduce)').matches);
 const [elapsed,setElapsed]=useState(0),[muted,setMuted]=useState(()=>!introAudioRunning()),[hit,setHit]=useState(0);
 const finishRef=useRef(onComplete);finishRef.current=onComplete;
 const audioRef=useRef<ReturnType<typeof createIntroAudio>>(null);const skipRef=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null;skipRef.current?.focus({preventScroll:true});
  const audio=reduced?null:createIntroAudio();audioRef.current=audio;audio?.mute(!introAudioRunning());
  const start=performance.now();let raf=0,last=0,revealed=false,finished=false;
  const tick=(now:number)=>{const ms=now-start;setElapsed(ms);if(!reduced){const hits=INTRO_HITS.filter(t=>ms>=t).length;if(hits>last){last=hits;setHit(hits);if(document.visibilityState==='visible')audio?.hit();}if(ms>=INTRO_REVEAL&&!revealed){revealed=true;if(document.visibilityState==='visible')audio?.reveal();}}if(ms>=(reduced?1400:INTRO_DURATION)){finished=true;audio?.stop();finishRef.current();}else raf=requestAnimationFrame(tick);};raf=requestAnimationFrame(tick);
  const visibility=()=>{if(document.hidden&&!finished){finished=true;cancelAnimationFrame(raf);audio?.stop();finishRef.current();}};document.addEventListener('visibilitychange',visibility);
  return()=>{cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',visibility);audio?.stop();previous?.focus?.({preventScroll:true});};
 },[reduced]);
 const revealing=reduced||elapsed>=INTRO_REVEAL;
 function finish(){audioRef.current?.stop();finishRef.current();}
 async function toggleSound(){if(muted){try{if(await unlockIntroAudio()){setMuted(false);audioRef.current?.mute(false);}}catch{}}else{setMuted(true);audioRef.current?.mute(true);}}
 return <section className={`forge-intro ${revealing?'is-revealing':''} ${reduced?'reduced':''}`} role="dialog" aria-modal="true" aria-label="Boas-vindas ao eForge" onKeyDown={e=>{if(e.key==='Escape')finish();if(e.key==='Tab'){const sound=e.currentTarget.querySelector<HTMLButtonElement>('.forge-sound');if(e.shiftKey&&document.activeElement===sound){e.preventDefault();skipRef.current?.focus();}else if(!e.shiftKey&&document.activeElement===skipRef.current){e.preventDefault();sound?.focus();}}}}>
  <div className="forge-intro-brand"><Brand/></div>
  <div className="forge-scene" aria-hidden="true">
   <svg className="forge-art" viewBox="0 0 420 470">
    <defs>
     <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#66606c"/><stop offset=".18" stopColor="#26232d"/><stop offset=".46" stopColor="#111117"/><stop offset=".77" stopColor="#49404e"/><stop offset="1" stopColor="#17151d"/></linearGradient>
     <linearGradient id={`${id}-edge`}><stop stopColor="#d5b4ff"/><stop offset=".4" stopColor="#767080"/><stop offset=".72" stopColor="#2c2638"/><stop offset="1" stopColor="#bb82ff"/></linearGradient>
     <linearGradient id={`${id}-top`} x2="0" y2="1"><stop stopColor="#c2b1d4"/><stop offset=".3" stopColor="#6d617a"/><stop offset="1" stopColor="#25212d"/></linearGradient>
     <radialGradient id={`${id}-halo`}><stop stopColor="#ac6beb" stopOpacity=".22"/><stop offset="1" stopColor="#ac6beb" stopOpacity="0"/></radialGradient>
    </defs>
    <ellipse cx="220" cy="389" rx="180" ry="65" fill={`url(#${id}-halo)`}/>
    <ellipse cx="212" cy="410" rx="139" ry="11" fill="#000" opacity=".7"/>
    <g className="forge-anvil">
     <path d="M47 284L349 281 365 295 280 319Q255 352 292 382L311 393 307 411H118L112 395 143 378Q167 350 144 321L107 317Z" fill={`url(#${id}-metal)`} stroke={`url(#${id}-edge)`} strokeWidth="2"/>
     <path d="M47 284Q101 270 164 273L344 273 365 283 349 295H113Q70 291 47 284Z" fill={`url(#${id}-top)`} stroke="#c9acdf" strokeWidth="1"/>
     <path d="M148 322Q170 352 143 381M280 319Q255 352 292 382M117 395H309" fill="none" stroke="#897097" strokeOpacity=".5"/>
     <path d="M210 326h44l-12 12h-24l-5 9h27l-12 12h-23l-12 17h-11z" fill="#bb82ff" opacity=".3"/>
    </g>
    <g className="forge-hammer"><g transform="rotate(-38 249 226)">
     <rect x="73" y="211" width="168" height="26" rx="9" fill="#19161e" stroke={`url(#${id}-edge)`} strokeWidth="2"/>
     {Array.from({length:9},(_,i)=><path key={i} d={`M${87+i*13} 213l-8 22`} stroke="#64586f" strokeWidth="3"/>)}
     <rect x="217" y="184" width="66" height="85" rx="8" fill={`url(#${id}-metal)`} stroke={`url(#${id}-edge)`} strokeWidth="3"/>
     <path d="M228 187v77M275 192v66" stroke="#a895bb" strokeOpacity=".7" strokeWidth="2"/>
    </g></g>
    {hit>0&&<g key={hit} className="forge-sparks">{Array.from({length:16},(_,i)=>{const angle=Math.PI+(i/15)*Math.PI;const length=36+(i%4)*18;return <line key={i} x1="247" y1="279" x2={247+Math.cos(angle)*length} y2={279+Math.sin(angle)*length} stroke={i%3?'#bc80ff':'#eee0ff'} strokeWidth={i%3?2:3}/>})}<ellipse cx="247" cy="278" rx="23" ry="5" fill="#e4c8ff"/></g>}
   </svg>
  </div>
  <div className="forge-message" aria-live="polite">{revealing&&<><h1>Forjando a sua<br/><span>melhor versão!</span></h1><div className="forge-wipe" aria-hidden="true"/></>}</div>
  <div className="forge-intro-controls"><button className="forge-sound" disabled={reduced} onClick={toggleSound} aria-label={muted?'Ativar som':'Silenciar'} aria-pressed={!muted}>{muted?<VolumeX size={20}/>:<Volume2 size={20}/>}<span>{muted?'Ativar som':'Som ligado'}</span></button><button ref={skipRef} onClick={finish}>Pular</button></div>
 </section>
}
