import {id,normalizeDb,variationGroup} from './workflows.js';
export function parseCSV(text) {
 const rows=[];let row=[],cell='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;}else if(c===','){row.push(cell);cell='';closed=false;}else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v!==''))rows.push(row);row=[];cell='';closed=false;}else if(c==='"'&&!cell&&!closed){quoted=true;}else{if(closed||c==='"')throw Error('Invalid CSV quoting. Put quotes around cells containing commas or line breaks.');cell+=c;}}
 if(quoted)throw Error('The CSV ends inside a quoted cell.');row.push(cell);if(row.some(v=>v!==''))rows.push(row);return rows;
}
export function prepareImport(text,filename) {
 if(text.length>5_000_000)throw Error('Choose a library smaller than 5 MB.');
 if(/\.csv$/i.test(filename)){
  const rows=parseCSV(text.replace(/^\uFEFF/,''));const headers=(rows.shift()||[]).map(v=>v.trim().toLowerCase());const index=Object.fromEntries(headers.map((h,i)=>[h,i]));if(['label','shortcut','content'].some(h=>index[h]===undefined))throw Error('CSV needs label, shortcut and content columns. An optional folder column is supported.');
  const folders=new Map(),warnings=[];const snippets=rows.map((row,i)=>{const folder=row[index.folder]?.trim()||'Imported';if(!folders.has(folder))folders.set(folder,{id:id(),name:folder});const label=row[index.label]?.trim(),shortcut=row[index.shortcut]?.trim(),content=row[index.content];if(!label||!shortcut||content===undefined)throw Error(`CSV row ${i+2} needs a label, shortcut and content.`);if(/[{}]|%[A-Z]/.test(content))warnings.push(`Row ${i+2}: imported as literal text. Commands from other tools are not converted.`);return {id:id(),folderId:folders.get(folder).id,label,shortcut,content:content.replace(/[\\{}]/g,'\\$&')};});
  if(!snippets.length)throw Error('The CSV has no snippets.');return {library:normalizeDb({snippets,folders:[...folders.values()],values:[]}),warnings};
 }
 if(!/\.json$/i.test(filename))throw Error('Use a Sniply JSON backup or CSV. Native Espanso and TextExpander formats are not yet supported; export CSV first.');
 const data=JSON.parse(text);if(!Array.isArray(data.snippets)||!Array.isArray(data.folders)||data.snippets.some(s=>!s||['id','content','label','shortcut'].some(k=>typeof s[k]!=='string'))||data.folders.some(f=>!f||typeof f.id!=='string'||typeof f.name!=='string')||(data.values||[]).some(v=>!v||typeof v.key!=='string'||!['string','number'].includes(typeof v.value)))throw Error('This is not a valid Sniply library.');
 if(data.snippets.some(s=>!data.folders.some(f=>f.id===s.folderId)))throw Error('Some snippets refer to a missing folder. Repair the backup before importing.');
 if(data.snippets.some(s=>['sites','blockedSites','paths','history','tests'].some(k=>s[k]!==undefined&&!Array.isArray(s[k]))||['sites','blockedSites','paths'].some(k=>s[k]?.some(v=>typeof v!=='string'))||s.richContent!==undefined&&typeof s.richContent!=='string'))throw Error('Some snippet settings in this backup are invalid.');
 return {library:normalizeDb(data),warnings:['Website rules and library trigger preferences in this backup will not replace your current library settings.']};
}
export function importConflict(snippet,existing){return existing.some(s=>s.id===snippet.id||s.shortcut.toLowerCase()===snippet.shortcut.toLowerCase()&&variationGroup(s)!==variationGroup(snippet));}
export function mergeImport(db,incoming,policy='skip') {
 const snippets=[...db.snippets];for(const item of incoming.snippets){const conflict=importConflict(item,snippets);if(conflict&&policy==='skip')continue;let next={...item};if(conflict&&policy==='copy'){next.id=id();let n=2,shortcut=item.shortcut;while(snippets.some(s=>s.shortcut.toLowerCase()===shortcut.toLowerCase()))shortcut=item.shortcut+n++;next.shortcut=shortcut;next.variationGroup=undefined;next.variationName=undefined;}snippets.push(next);}
 return normalizeDb({...db,snippets,pageMappings:[...new Map([...(incoming.pageMappings||[]),...(db.pageMappings||[])].map(m=>[m.domain+'|'+m.key,m])).values()],folders:[...new Map([...incoming.folders,...db.folders].map(f=>[f.id,f])).values()],values:[...new Map([...incoming.values,...db.values].map(v=>[v.key,v])).values()]});
}
