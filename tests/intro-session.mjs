import ts from 'typescript';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const data=new Map();globalThis.sessionStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
const js=ts.transpileModule(fs.readFileSync('src/lib/intro-session.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {requestIntro,clearIntro,shouldPlayIntro}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
assert.equal(shouldPlayIntro('a'),false);requestIntro('a');assert.equal(shouldPlayIntro('a'),true);assert.equal(shouldPlayIntro('b'),false);clearIntro();assert.equal(shouldPlayIntro('a'),false);requestIntro();assert.equal(shouldPlayIntro('a'),true);data.set('eforge:intro-pending',JSON.stringify({userId:'a',at:Date.now()-700000}));assert.equal(shouldPlayIntro('a'),false);data.set('eforge:intro-pending','bad');assert.equal(shouldPlayIntro('a'),false);console.log('PASS: intro intent, account isolation, expiry and consumed intent.');
