import ts from 'typescript';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=ts.transpileModule(fs.readFileSync('src/lib/workout-storage.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {readDraft,saveDraft,number,remaining,totals}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const data=new Map();globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
const d={id:'session-a',userId:'a',exercises:[{sets:[{done:true,reps:'10',carga:'12,5'},{done:false,reps:'8',carga:'100'}]}]};saveDraft(d);assert.equal(readDraft('b'),null);assert.equal(readDraft('a').id,'session-a');assert.deepEqual(totals(d),{sets:1,volume:125});assert.equal(number('-1'),0);assert.equal(remaining(100000,90000),10);assert.equal(remaining(100000,150000),0);data.set('eforge:v1:b:draft',JSON.stringify(d));assert.equal(readDraft('b'),null);console.log('PASS: local user isolation, decimal parsing, completed-series volume, suspended timer.');
