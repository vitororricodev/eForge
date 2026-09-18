// Run against a LOCAL dev server. Network fixtures exist only in this test process.
// npm install --no-save playwright && npx playwright install chromium
// node tests/muscle-map-browser.mjs
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const playwright = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
 ? require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'playwright'))
 : await import('playwright');
const baseURL = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:5173';
assert(['127.0.0.1','localhost'].includes(new URL(baseURL).hostname), 'Use a local server only');
const output = process.env.TEST_SCREENSHOTS ?? 'validation';
fs.mkdirSync(output,{recursive:true});
const userId = '00000000-0000-4000-8000-000000000001';
const user = {id:userId,aud:'authenticated',role:'authenticated',email:'visual-test@example.invalid',app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString()};
const env = fs.existsSync('.env') ? fs.readFileSync('.env','utf8') : '';
const supabaseURL = process.env.VITE_SUPABASE_URL ?? env.match(/^VITE_SUPABASE_URL=["']?([^\s"']+)/m)?.[1];
assert(supabaseURL, 'Configure the same public Supabase URL used by your local app');
const storageKey = `sb-${new URL(supabaseURL).hostname.split('.')[0]}-auth-token`;
const session = {access_token:'local-visual-test-only',refresh_token:'local-visual-test-only',token_type:'bearer',expires_in:86400,expires_at:Math.floor(Date.now()/1000)+86400,user};
const examples = [
 {id:'exercise-1',nome:'Supino reto',musculo_principal:'Peito',musculos_secundarios:['Tríceps'],musculos_terciarios:[]},
 {id:'exercise-2',nome:'Supino inclinado',musculo_principal:'Peito',musculos_secundarios:['Ombros'],musculos_terciarios:[]},
 {id:'exercise-3',nome:'Remada',musculo_principal:'Costas',musculos_secundarios:['Bíceps'],musculos_terciarios:[]},
].map(e=>({...e,user_id:userId,gif_url:null,tipo_controle:'peso_kg',categoria:'musculacao',visibility:'private',created_at:new Date().toISOString(),observacoes:null}));
let failure=false, empty=false;
let launchOptions={headless:true,args:['--no-sandbox']};
if(process.env.TEST_CHROMIUM_MODULE){const {default:chromium}=await import(process.env.TEST_CHROMIUM_MODULE);launchOptions={...launchOptions,executablePath:await chromium.executablePath(),args:chromium.args};}
const browser=await playwright.chromium.launch(launchOptions);
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});
await context.addInitScript(({storageKey,session})=>localStorage.setItem(storageKey,JSON.stringify(session)),{storageKey,session});
// No requests from the test may reach the real database, authentication service or other remote host.
await context.route('**/*',async route=>{
 const url=new URL(route.request().url());
 if(url.hostname==='127.0.0.1'||url.hostname==='localhost')return route.continue();
 if(url.origin!==new URL(supabaseURL).origin)return route.abort();
 let body=[];
 if(url.pathname.includes('/auth/v1/user'))body=user;
 else if(url.pathname.includes('/rest/v1/exercises'))body=empty?[]:examples;
 else if(url.pathname.includes('/rest/v1/set_logs')){
  if(failure)return route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:'Test failure'})});
  body=empty?[]:[{id:'set-1',session_id:'workout-1',kind:'normal',musculo_principal:'Costas',musculos_secundarios:['Bíceps'],musculos_terciarios:[]}];
 }
 return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(baseURL+'/muscle-map');
 await page.getByRole('heading',{name:'Mapa muscular',exact:true}).waitFor({timeout:45000});
 await page.locator('.anatomical-stage img').evaluate(img=>img.decode());
 await page.getByRole('heading',{name:'Por onde começar?'}).waitFor();
 await page.locator('[data-muscle="chest"]').click({position:{x:20,y:20}});
 await page.getByRole('heading',{name:'Peitoral',exact:true}).waitFor();
 assert.equal(await page.locator('.anatomical-label').textContent(),'Peitoral');
 await page.getByRole('button',{name:'Ocultar nomes'}).click();assert.equal(await page.locator('.anatomical-label').count(),0);
 await page.getByRole('button',{name:'Mostrar nomes'}).click();
 await page.screenshot({path:output+'/mobile-frente.png'});
 await page.locator('.muscle-week-card').scrollIntoViewIfNeeded();
 await page.screenshot({path:output+'/mobile-detalhes.png'});
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.getByRole('button',{name:'Costas',exact:true}).click();
 await page.locator('[data-muscle="lats"]').focus();await page.keyboard.press('Enter');
 await page.getByRole('heading',{name:'Dorsais',exact:true}).waitFor();
 await page.locator('[data-muscle="lats"]').evaluate(el=>el.blur());
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:output+'/mobile-costas.png'});
 await page.getByText('Selecionar pela lista',{exact:true}).click();
 await page.getByRole('button',{name:'Peitoral',exact:true}).click();
 await page.getByRole('button',{name:'Frente',exact:true}).getAttribute('aria-pressed').then(value=>assert.equal(value,'true'));
 await page.getByRole('link',{name:'Ver exercícios',exact:true}).click();
 await page.waitForURL('**/exercises?**');assert(new URL(page.url()).searchParams.get('muscle')==='chest');
 await page.getByText('Supino reto',{exact:true}).waitFor();assert.equal(await page.getByText('Remada',{exact:true}).count(),0);
 await page.getByRole('button',{name:'Limpar filtro do mapa muscular'}).click();await page.getByText('Remada',{exact:true}).waitFor();
 await page.goto(baseURL+'/muscle-map');await page.getByRole('heading',{name:'Mapa muscular',exact:true}).waitFor();
 for (const width of [320,390,430,768,1440]) {
  await page.setViewportSize({width,height:900}); await page.waitForTimeout(120);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),`Horizontal overflow at ${width}`);
 }
 await page.getByRole('button',{name:'Ambos',exact:true}).click();
 assert.equal(await page.locator('.anatomical-figure:visible').count(),2);
 await page.locator('[data-muscle="chest"]').click({position:{x:20,y:20}});
 await page.locator('[data-muscle="chest"]').evaluate(el=>el.blur());
 assert.equal(await page.getByRole('button',{name:'Ambos',exact:true}).getAttribute('aria-pressed'),'true');
 await page.screenshot({path:output+'/desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.locator('.anatomical-figure:visible').count(),1);
 await page.getByRole('button',{name:'Limpar seleção',exact:true}).click();
 await page.getByRole('heading',{name:'Por onde começar?'}).waitFor();
 empty=true;await page.reload();await page.getByText('Seus treinos concluídos aparecerão aqui.',{exact:true}).waitFor();
 await page.screenshot({path:output+'/mobile-vazio.png',fullPage:true});
 failure=true;await page.reload();await page.getByText('Não foi possível carregar os treinos.',{exact:true}).waitFor({timeout:20000});
 await page.screenshot({path:output+'/mobile-erro.png',fullPage:true});
 failure=false;await page.getByRole('button',{name:'Tentar novamente'}).click();await page.getByText('Seus treinos concluídos aparecerão aqui.',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);
 console.log('PASS: real route with isolated HTTP fixtures — touch, keyboard, views, labels, list, clear, exercise links/filter, mobile/desktop, empty/error/retry, no overflow or page errors.');
}catch(error){console.error('Browser location:',page.url());console.error((await page.locator('body').innerText()).slice(0,1800));await page.screenshot({path:output+'/failure.png',fullPage:true});throw error;}finally{await browser.close();}
