const KEY = 'eforge:intro-pending';
export function requestIntro(userId = '*') { try { sessionStorage.setItem(KEY, JSON.stringify({userId, at: Date.now()})); } catch {} }
export function clearIntro() { try { sessionStorage.removeItem(KEY); } catch {} }
export function shouldPlayIntro(userId: string) { try { const p=JSON.parse(sessionStorage.getItem(KEY)||'null');return !!p && (p.userId===userId||p.userId==='*') && Date.now()-p.at < 10*60*1000; } catch { return false; } }
