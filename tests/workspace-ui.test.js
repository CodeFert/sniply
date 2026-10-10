import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://sniply.test',pretendToBeVisual:true});
for(const key of ['window','document','DOMParser','HTMLElement','Element','Node','MutationObserver','localStorage','getComputedStyle'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
globalThis.requestAnimationFrame=cb=>setTimeout(cb,0);globalThis.cancelAnimationFrame=clearTimeout;globalThis.innerHeight=900;globalThis.innerWidth=1400;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
globalThis.prompt=()=> 'A named version';
localStorage.setItem('tb-pro',JSON.stringify({folders:[{id:'f',name:'Examples'}],user:{name:'Demo'},values:[],snippets:[{id:'s',folderId:'f',label:'Greeting',shortcut:'/hi',content:'Hello {formtext: name=person; default=Jordan}. Again: {field: person}'}]}));
await mkdir('work',{recursive:true});await build({entryPoints:['src/App.jsx'],outfile:'work/ui-test-app.mjs',bundle:true,platform:'node',format:'esm',packages:'external',jsx:'automatic'});
const React=await import('react');const {createRoot}=await import('react-dom/client');const {default:App}=await import('../work/ui-test-app.mjs');
const root=createRoot(document.getElementById('root'));
const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);
async function click(text){const b=button(text);assert.ok(b,`Missing button ${text}`);await React.act(async()=>b.click());}
async function fill(input,value){await React.act(async()=>{const proto=input.tagName==='TEXTAREA'?dom.window.HTMLTextAreaElement.prototype:dom.window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(input,value);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});}
test('workspace supports live answers, fields, values, history and test panels',async()=>{
 await React.act(async()=>root.render(React.createElement(App)));
 assert.match(document.querySelector('[aria-label="Finished message"]').textContent,/Hello Jordan. Again: Jordan/);
 const sample=document.querySelector('.sample-fields input');await fill(sample,'Taylor');assert.match(document.querySelector('[aria-label="Finished message"]').textContent,/Hello Taylor. Again: Taylor/);
 await click('Fields');assert.match(document.querySelector('.panel-scroll').textContent,/Reusable fields/);assert.ok(button('Insert reference'));
 await click('Shared values');await click('+ New shared value');const form=document.querySelector('.panel-scroll form');await fill(form.querySelector('input'),'unit_price');await fill(form.querySelector('textarea'),'125');await React.act(async()=>form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));assert.match(document.querySelector('.panel-scroll').textContent,/unit_price/);
 await click('History');await click('Save version now');assert.match(document.querySelector('.panel-scroll').textContent,/A named version/);
 await click('Tests');await click('Save current example');await click('Run all tests');assert.match(document.querySelector('.panel-scroll').textContent,/Passed/);
 await click('Settings');assert.ok(document.querySelector('input[placeholder="example.com, mail.example.org"]'));
 await React.act(async()=>root.unmount());
});
