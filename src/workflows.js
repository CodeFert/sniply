import { expand, fieldsFor, parse } from './engine.js';
export const id = () => crypto.randomUUID();
export function normalizeDb(db) { return { ...db, values: db.values || [], snippets: (db.snippets || []).map(s => ({ ...s, history:s.history || [], tests:s.tests || [], sites:s.sites || [] })) }; }
export const ref = name => '`' + String(name).replace(/`/g,'') + '`';
export function ruleExpression(rules=[], mode='all') { return rules.map(r => `(${ref(r.field)} ${r.operator || '=='} ${r.valueType==='field' ? ref(r.value) : /^-?\d+(\.\d+)?$/.test(String(r.value)) ? r.value : JSON.stringify(String(r.value ?? ''))})`).join(mode==='any'?' or ':' and ') || 'true'; }
export function nodePlain(node) {
 const type=typeof node.type==='string'?node.type:node.type.name;
 if(type==='text')return node.text || '';
 if(type==='hardBreak')return '\n';
 if(type==='snippetCommand')return node.attrs.syntax;
 const children=Array.isArray(node.content)?node.content:node.content?.content || [];
 const body=children.map(nodePlain).join(['doc','conditionalSection','bulletList','orderedList','blockquote'].includes(type)?'\n':'');
 if(type==='conditionalSection')return `{if: ${ruleExpression(node.attrs.rules,node.attrs.mode)}}${body}{endif}`;
 return body;
}
export function allFields(snippet, db, seen=new Set()) {
 if(!snippet || seen.has(snippet.id))return [];seen.add(snippet.id);
 const found=fieldsFor(snippet.content || '');
 for(const n of commands(snippet.content))if(n.name==='import'){const key=n.settings.positional[0];found.push(...allFields(db.snippets.find(s=>s.id===key||s.shortcut===key||s.label===key),db,seen));}
 return [...new Map(found.map(f=>[f.name,f])).values()];
}
export function commands(text='') { const result=[];function walk(nodes){for(const n of nodes){if(n.name)result.push(n);if(n.body)walk(n.body);if(n.branches)for(const b of n.branches){result.push(b.cond);walk(b.body);}}}walk(parse(text));return result; }
export function defaultsFor(fields) { return Object.fromEntries(fields.map(f=>[f.name,f.kind==='formtoggle'?f.default==='yes':f.multiple?(f.default?[f.default]:[]):f.default||''])); }
export function contextFor(snippet,db,answers={},url='',now) {
 let site={url,domain:'',path:'',title:''};try{const u=new URL(url);site={...site,domain:u.hostname,path:u.pathname};}catch{}
 return { fields:answers, vars:Object.fromEntries((db.values||[]).map(v=>[v.key,v.value])), user:db.user||{}, values:Object.fromEntries((db.values||[]).map(v=>[v.key,v.value])), snippet, site, now, clipboard:'', lookup:key=>db.snippets.find(s=>s.id===key||s.shortcut===key||s.label===key) };
}
export function siteAllowed(snippet,url) { if(!snippet.sites?.length)return true;try{const host=new URL(url).hostname.toLowerCase();return snippet.sites.some(d=>host===d||host.endsWith('.'+d));}catch{return false;} }
export function evaluateSnippet(snippet,db,answers,url,now) { const fields=allFields(snippet,db);const values={...defaultsFor(fields),...answers};const result=expand(snippet.content,contextFor(snippet,db,values,url,now));const missing=fields.filter(f=>f.required&&(!values[f.name]||(Array.isArray(values[f.name])&&!values[f.name].length))).map(f=>`${f.label} is required`);return {...result,errors:[...missing,...result.errors],values}; }
export function checkpoint(snippet,reason='Saved version') { const {history,tests,...snapshot}=snippet;return {id:id(),at:new Date().toISOString(),reason,snapshot}; }
export function updateSnippet(db,snippetId,patch,reason) {return {...db,snippets:db.snippets.map(s=>{if(s.id!==snippetId)return s;const changed=Object.keys(patch).some(k=>JSON.stringify(s[k])!==JSON.stringify(patch[k]));if(!changed)return s;const last=s.history?.at(-1);const save=reason||!last||Date.now()-new Date(last.at).getTime()>30000;return {...s,...patch,history:patch.history ?? (save?[...(s.history||[]),checkpoint(s,reason||'Before edits')].slice(-50):s.history||[])};})};}
export function healthCheck(db) {
 const issues=[];const add=(s,code,message,detail)=>issues.push({snippetId:s.id,label:s.label,code,message,detail});
 for(const s of db.snippets){
  if(!s.shortcut?.trim())add(s,'shortcut','Choose a shortcut.');
  else if(db.snippets.some(o=>o.id!==s.id&&o.shortcut.toLowerCase()===s.shortcut.toLowerCase()&&(!o.sites?.length||!s.sites?.length||o.sites.some(a=>s.sites.some(b=>a===b||a.endsWith('.'+b)||b.endsWith('.'+a))))))add(s,'duplicate',`Shortcut ${s.shortcut} overlaps another snippet.`);
  const fields=allFields(s,db);const names=new Set([...fields.map(f=>f.name),...(db.values||[]).map(v=>v.key)]);
  for(const n of commands(s.content)){
   const key=n.settings?.positional?.[0];
   if(n.name==='import'&&!db.snippets.some(o=>[o.id,o.shortcut,o.label].includes(key)))add(s,'import',`Imported snippet “${key}” is missing.`);
   if(n.name==='field'&&!names.has(key))add(s,'field',`Field “${key}” has not been defined.`);
   if(n.name==='value'&&!(db.values||[]).some(v=>v.key===key))add(s,'value',`Shared value “${key}” is missing.`);
   if(['=','if','elseif'].includes(n.name)){
    const expr=(n.settings?.positional?.[0]||n.settings?.raw||'').replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,'');
    const ids=[...expr.matchAll(/`([^`]+)`|\b([a-zA-Z_][\w]*)\b/g)].map(m=>m[1]||m[2]);
    for(const token of new Set(ids))if(!names.has(token)&&!['true','false','yes','no','and','or','not','index','upper','lower','trim','len','length','round','abs','sqrt','log','contains','left','right','replace','if'].includes(token))add(s,'reference',`Calculation or rule refers to unknown field “${token}”.`);
   }
  }
  if((s.content.match(/\{if:/g)||[]).length!==(s.content.match(/\{endif\}/g)||[]).length)add(s,'unfinished','A conditional section is unfinished.');
  const definitions=new Map();
  for(const n of commands(s.content).filter(n=>n.name?.startsWith('form'))){const name=n.settings.named.name;if(name){const signature=JSON.stringify({kind:n.name,settings:n.settings});if(definitions.has(name)&&definitions.get(name)!==signature)add(s,'definition',`Field “${name}” has conflicting definitions. Keep one definition and reuse it.`);definitions.set(name,signature);}}
  let depth=0;for(let i=0;i<s.content.length;i++){if(s.content[i]==='\\'){i++;continue;}if(s.content[i]==='{')depth++;if(s.content[i]==='}')depth--;}if(depth!==0)add(s,'unfinished','A command has an unmatched brace.');
  const own=fieldsFor(s.content);for(const f of own)if(!f.name.trim())add(s,'field','A field needs a name.');
  function cycle(item,path){if(path.includes(item.id))return true;return commands(item.content).filter(n=>n.name==='import').some(n=>{const to=db.snippets.find(o=>[o.id,o.shortcut,o.label].includes(n.settings.positional[0]));return to&&cycle(to,[...path,item.id]);});}
  if(cycle(s,[]))add(s,'cycle','Circular snippet imports cannot expand reliably.');
 }
 return [...new Map(issues.map(i=>[i.snippetId+i.message,i])).values()];
}
export function valueDependents(key,db) {
 const direct=new Set(db.snippets.filter(s=>commands(s.content).some(n=>n.name==='value'&&n.settings.positional[0]===key||['=','if','elseif'].includes(n.name)&&(n.settings.raw||'').includes(ref(key)))).map(s=>s.id));
 let changed=true;while(changed){changed=false;for(const s of db.snippets)if(!direct.has(s.id)&&commands(s.content).some(n=>n.name==='import'&&db.snippets.some(o=>direct.has(o.id)&&[o.id,o.shortcut,o.label].includes(n.settings.positional[0])))){direct.add(s.id);changed=true;}}
 return db.snippets.filter(s=>direct.has(s.id));
}
export function datePreset(preset,now=new Date()) {const d=new Date(now);d.setHours(12,0,0,0);if(preset==='tomorrow')d.setDate(d.getDate()+1);if(preset==='business'){do{d.setDate(d.getDate()+1);}while([0,6].includes(d.getDay()));}if(preset==='monday'){d.setDate(d.getDate()+((8-d.getDay())%7||7));}if(preset==='month'){d.setMonth(d.getMonth()+1,1);}return d;}
