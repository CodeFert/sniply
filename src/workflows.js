import { expand, fieldsFor, parse } from './engine.js';
export const id = () => crypto.randomUUID();
export function normalizeDb(db) { return { ...db, folders:db.folders||[], settings:{...db.settings,trigger:['immediate','space','tab','enter'].includes(db.settings?.trigger)?db.settings.trigger:'immediate'}, values: db.values || [], snippets: (db.snippets || []).map(s => ({ ...s, history:s.history || [], tests:s.tests || [], sites:s.sites || [], blockedSites:s.blockedSites || [], paths:s.paths || [], fieldDefaults:s.fieldDefaults || {} })) }; }
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
 const found=fieldsFor(snippet.content || '').map(f=>({...f,defaultSharedKey:snippet.fieldDefaults?.[f.name]}));
 for(const n of commands(snippet.content))if(n.name==='import'){const key=n.settings.positional[0];found.push(...allFields(db.snippets.find(s=>s.id===key||s.shortcut===key||s.label===key),db,seen));}
 return [...new Map(found.map(f=>[f.name,f])).values()];
}
export function commands(text='') { const result=[];function walk(nodes){for(const n of nodes){if(n.name)result.push(n);if(n.body)walk(n.body);if(n.branches)for(const b of n.branches){result.push(b.cond);walk(b.body);}}}walk(parse(text));return result; }
export function defaultsFor(fields,db={},snippet={}) { return Object.fromEntries(fields.map(f=>{const key=snippet.fieldDefaults?.[f.name]||f.defaultSharedKey;const shared=(db.values||[]).find(v=>v.key===key);let value=shared?shared.value:f.default;if(f.kind==='formmenu'){value=f.multiple?(Array.isArray(value)?value:value?[value]:[]).filter(v=>f.options.includes(v)):f.options.includes(value)?value:'';}return [f.name,f.kind==='formtoggle'?/^(yes|true|1|on)$/i.test(String(value)):f.multiple?(Array.isArray(value)?value:value?[value]:[]):value??''];})); }
export function missingFields(fields,values) {return fields.filter(f=>f.required&&(values[f.name]===false||values[f.name]==null||values[f.name]===''||(Array.isArray(values[f.name])&&!values[f.name].length))).map(f=>`${f.label} is required`);}
export const variationGroup = s => s.variationGroup || s.id;
export function domainMatches(host,domain) {domain=domain.trim().toLowerCase();return host===domain||host.endsWith('.'+domain);}
export function siteReason(snippet,url,settings={}) {
 let page;try{page=new URL(url);}catch{return snippet.sites?.length||snippet.paths?.length?'Enter a test website address.':'';}
 if([...(settings.blockedSites||[]),...(snippet.blockedSites||[])].some(d=>domainMatches(page.hostname,d)))return 'Blocked by a website exclusion.';
 if(snippet.sites?.length&&!snippet.sites.some(d=>domainMatches(page.hostname,d)))return 'This website is outside the allowed domains.';
 if(snippet.paths?.length&&!snippet.paths.some(p=>page.pathname.startsWith(p)))return 'This page does not match an allowed path.';
 return '';
}
export function explainCommand(syntax,context) {
 const n=commands(syntax)[0];if(!n)return 'This is literal text.';
 const key=n.settings.positional[0]||n.settings.named.name;
 if(n.name==='value')return `Shared value “${key}” currently contains “${context.values?.[key]??''}”. Updating it changes every reference.`;
 if(n.name==='field'||n.name.startsWith('form'))return `Field “${key}” uses the answer “${String(context.fields?.[key]??'')}”. References to this field reuse the same answer.`;
 if(n.name==='site')return `Page information “${key}” resolves to “${context.site?.[key]??''}”.`;
 if(n.name==='if')return `This section is controlled by: ${n.settings.raw}. Its contents appear only when the condition is true.`;
 if(n.name==='=')return `Calculation: ${n.settings.raw}. Result: ${expand(syntax,context).text}.`;
 if(n.name==='import')return `This includes the snippet “${key}”, using the same answers and shared values.`;
 return `The ${n.name} command produces “${expand(syntax,context).text}”.`;
}
export function contextFor(snippet,db,answers={},url='',now,page={}) {
 let site={url,domain:'',path:'',title:''};try{const u=new URL(url);site={...site,domain:u.hostname,path:u.pathname};}catch{}
 site={...site,...page};
 return { fields:answers, vars:Object.fromEntries((db.values||[]).map(v=>[v.key,v.value])), user:db.user||{}, values:Object.fromEntries((db.values||[]).map(v=>[v.key,v.value])), snippet, site, now, clipboard:'', lookup:key=>db.snippets.find(s=>s.id===key||s.shortcut===key||s.label===key) };
}
export function siteAllowed(snippet,url,settings={}) { return !siteReason(snippet,url,settings); }
export function evaluateSnippet(snippet,db,answers,url,now,page={}) { const fields=allFields(snippet,db);const values={...defaultsFor(fields,db,snippet),...answers};const result=expand(snippet.content,contextFor(snippet,db,values,url,now,page));return {...result,errors:[...result.errors,...missingFields(fields,values)],values}; }
export function checkpoint(snippet,reason='Saved version') { const {history,tests,...snapshot}=snippet;return {id:id(),at:new Date().toISOString(),reason,snapshot}; }
export function updateSnippet(db,snippetId,patch,reason) {return {...db,snippets:db.snippets.map(s=>{if(s.id!==snippetId)return s;const changed=Object.keys(patch).some(k=>JSON.stringify(s[k])!==JSON.stringify(patch[k]));if(!changed)return s;const last=s.history?.at(-1);const save=reason||!last||Date.now()-new Date(last.at).getTime()>30000;return {...s,...patch,history:patch.history ?? (save?[...(s.history||[]),checkpoint(s,reason||'Before edits')].slice(-50):s.history||[])};})};}
export function healthCheck(db) {
 const issues=[];const add=(s,code,message,detail)=>issues.push({snippetId:s.id,label:s.label,code,message,detail});
 for(const s of db.snippets){
  if(!s.shortcut?.trim())add(s,'shortcut','Choose a shortcut.');
  else if(db.snippets.some(o=>o.id!==s.id&&variationGroup(o)!==variationGroup(s)&&o.shortcut.toLowerCase()===s.shortcut.toLowerCase()&&(!o.sites?.length||!s.sites?.length||o.sites.some(a=>s.sites.some(b=>a===b||a.endsWith('.'+b)||b.endsWith('.'+a))))))add(s,'duplicate',`Shortcut ${s.shortcut} overlaps another snippet.`);
  for(const [field,key] of Object.entries(s.fieldDefaults||{}))if(key&&!(db.values||[]).some(v=>v.key===key))add(s,'default',`Default for “${field}” refers to missing Shared value “${key}”.`);
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
 const direct=new Set(db.snippets.filter(s=>Object.values(s.fieldDefaults||{}).includes(key)||commands(s.content).some(n=>n.name==='value'&&n.settings.positional[0]===key||['=','if','elseif'].includes(n.name)&&(n.settings.raw||'').includes(ref(key)))).map(s=>s.id));
 let changed=true;while(changed){changed=false;for(const s of db.snippets)if(!direct.has(s.id)&&commands(s.content).some(n=>n.name==='import'&&db.snippets.some(o=>direct.has(o.id)&&[o.id,o.shortcut,o.label].includes(n.settings.positional[0])))){direct.add(s.id);changed=true;}}
 return db.snippets.filter(s=>direct.has(s.id));
}
export function datePreset(preset,now=new Date()) {const d=new Date(now);d.setHours(12,0,0,0);if(preset==='tomorrow')d.setDate(d.getDate()+1);if(preset==='business'){do{d.setDate(d.getDate()+1);}while([0,6].includes(d.getDay()));}if(preset==='monday'){d.setDate(d.getDate()+((8-d.getDay())%7||7));}if(preset==='month'){d.setMonth(d.getMonth()+1,1);}return d;}
