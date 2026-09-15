// Audio is unlocked by the login click; OAuth redirects may require another tap.
let context: AudioContext | null = null;
export function audioContext() { if(typeof window==='undefined')return null; try { context ??= new AudioContext();return context; } catch { return null; } }
export async function unlockIntroAudio(){const c=audioContext();if(c?.state==='suspended')await c.resume();return c?.state==='running';}
export function introAudioRunning(){return context?.state==='running';}
export function createIntroAudio(){
 const c=audioContext();if(!c)return null;
 const output=c.createGain();output.gain.value=.11;output.connect(c.destination);
 let stopped=false;
 return {
  hit(){if(stopped||c.state!=='running')return;const t=c.currentTime;[890,1421,2376,3890].forEach((f,i)=>{const o=c.createOscillator(),g=c.createGain();o.frequency.value=f;o.type='sine';g.gain.setValueAtTime(.7/(i+1),t);g.gain.exponentialRampToValueAtTime(.001,t+.5+i*.04);o.connect(g);g.connect(output);o.start(t);o.stop(t+.7);o.onended=()=>{o.disconnect();g.disconnect();}});},
  reveal(){if(stopped||c.state!=='running')return;const t=c.currentTime;const b=c.createBuffer(1,c.sampleRate*.5,c.sampleRate),a=b.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=Math.random()*2-1;const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=b;f.type='bandpass';f.frequency.setValueAtTime(400,t);f.frequency.exponentialRampToValueAtTime(4200,t+.3);g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(.6,t+.13);g.gain.exponentialRampToValueAtTime(.001,t+.5);s.connect(f);f.connect(g);g.connect(output);s.start();s.onended=()=>{s.disconnect();f.disconnect();g.disconnect();};},
  mute(muted:boolean){output.gain.value=muted?0:.11;},
  stop(){stopped=true;output.gain.value=0;output.disconnect();}
 };
}
