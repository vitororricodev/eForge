import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ForgeIntro} from './components/ForgeIntro';
import {Brand} from './components/Brand';
import {unlockIntroAudio} from './lib/intro-audio';
import './styles.css';
function Preview(){const [play,setPlay]=useState(false);return play?<ForgeIntro onComplete={()=>setPlay(false)}/>:<main className="mx-auto min-h-dvh flex flex-col items-center justify-center text-center px-6 gap-6"><Brand/><h1 className="text-3xl">Abertura eForge</h1><p className="text-muted-foreground">Prévia da animação, sem login e sem banco de dados.</p><button className="bg-neon rounded-xl px-6 py-4" onClick={async()=>{try{await unlockIntroAudio()}catch{}setPlay(true)}}>Reproduzir com som</button><p className="text-sm text-muted-foreground">Duração: aproximadamente 3,7 segundos.</p></main>}
createRoot(document.getElementById('root')!).render(<Preview/>);
