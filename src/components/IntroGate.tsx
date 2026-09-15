import {useState,type ReactNode} from 'react';
import {ForgeIntro} from './ForgeIntro';
import {clearIntro,shouldPlayIntro} from '@/lib/intro-session';
export function IntroGate({userId,children}:{userId:string;children:ReactNode}){const [show,setShow]=useState(()=>shouldPlayIntro(userId));return show?<ForgeIntro onComplete={()=>{clearIntro();setShow(false)}}/>:children;}
