import { ref } from './workflows.js';
import { parseSettings } from './engine.js';
const field = (key, label, type = 'text', extra = {}) => ({ key, label, type, ...extra });
const name = field('name', 'Field name', 'text', { required: true, help: 'A name you will recognize when filling the snippet.' });
const def = field('default', 'Default value');
const width = field('cols', 'Field width', 'number', { min: 5, max: 100, help: 'Width in characters (5–100).' });
const required = field('required', 'Required', 'checkbox');
const formats = ['MMMM D, YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'HH:mm', 'MMMM D, YYYY HH:mm'];
export const COMMAND_SPECS = {
 'Reuse field': {kind:'field',fields:[field('field','Field to reuse','existingField',{required:true})]},
 'Shared value': {kind:'value',fields:[field('value','Shared value','sharedValue',{required:true})]},
 'Date/Time': { kind:'time', defaults:{format:formats[0],shift:0,unit:'days'}, fields:[field('preset','Relative date','select',{options:[['','Today / custom offset'],['tomorrow','Tomorrow'],['business','Next business day'],['monday','Next Monday'],['month','Start of next month']]}),field('format','Date or time format','select',{options:formats}),field('shift','Move date by','number'),field('unit','Unit','select',{options:['days','weeks','months','years','hours','minutes']})] },
 'Clipboard': { kind:'clipboard', fields:[], help:'Inserts clipboard text when available. Clipboard is read by the browser extension when you insert the snippet; the dashboard does not read it automatically.' },
 'Place cursor': { kind:'cursor', fields:[], help:'Places the typing cursor here after the snippet expands.' },
 'Text field': { kind:'formtext', defaults:{name:'text'}, fields:[name,def,field('placeholder','Hint shown in the field'),width,required] },
 'Paragraph field': { kind:'formparagraph', defaults:{name:'notes',rows:4}, fields:[name,field('default','Default text','textarea'),field('rows','Visible lines','number',{min:2,max:20}),width,required] },
 'Dropdown menu': { kind:'formmenu', defaults:{name:'choice',options:['Choice A','Choice B','Choice C'],default:'Choice A'}, fields:[name,field('options','Choices','options'),field('multiple','Allow multiple selections','checkbox'),width,required] },
 'Toggle field': { kind:'formtoggle', defaults:{name:'include',default:false,body:'Optional text'}, fields:[name,field('default','Enabled by default','checkbox'),field('body','Text to include when enabled','textarea',{required:true})] },
 'Date/Time field': { kind:'formdate', defaults:{name:'date',format:'YYYY-MM-DD'}, fields:[name,field('default','Default date','date'),field('format','Output format','select',{options:formats.slice(0,3)}),required] },
 'Click element': { kind:'click', fields:[field('selector','Element selector','text',{required:true,placeholder:'#submit',help:'The page element to click, such as #submit. Used by the browser extension.'})] },
 'Key press': { kind:'key', defaults:{key:'tab'}, fields:[field('key','Key','select',{options:['tab','enter','escape','backspace','arrowup','arrowdown','arrowleft','arrowright']})], help:'Describes a keyboard action. The dashboard previews text only; key automation is not yet connected.' },
 'Wait': { kind:'wait', defaults:{delay:1}, fields:[field('delay','Seconds to wait','number',{min:0,max:60,step:0.1})], help:'Pauses extension actions for the selected duration. Live preview does not execute actions.' },
 'Formula': { kind:'=', defaults:{left:'price',operator:'*',right:'quantity',format:''}, fields:[field('left','First number or field','text',{required:true}),field('operator','Calculation','select',{options:[['+','Add'],['-','Subtract'],['*','Multiply'],['/','Divide']]}),field('right','Second number or field','text',{required:true}),field('format','Result style','select',{options:[['','Number'],['$,.2f','Currency'],[',.2f','Two decimal places'],['%','Percent']]})] },
 'If/Else': { kind:'if', defaults:{left:'quantity',operator:'>',right:'5',body:'Yes',otherwise:'No'}, fields:[field('left','Field to check','text',{required:true}),field('operator','Condition','select',{options:[['==','Equals'],['!=','Does not equal'],['>','Greater than'],['>=','At least'],['<','Less than'],['<=','At most']]}),field('right','Compare with','text',{required:true}),field('body','Text when true','textarea'),field('otherwise','Text when false','textarea')] },
 'Repeat': { kind:'repeat', defaults:{count:3,body:'Item\n'}, fields:[field('count','Number of repetitions','number',{min:1,max:100}),field('body','Text to repeat','textarea',{required:true})] },
 'Error Message': { kind:'error', defaults:{block:true}, fields:[field('message','Message','text',{required:true}),field('block','Block insertion','checkbox')] },
 'Import snippet': { kind:'import', fields:[field('snippet','Snippet to include','snippet',{required:true})] },
 'Snippet properties': { kind:'snippet', defaults:{property:'shortcut'}, fields:[field('property','Information to insert','select',{options:[['shortcut','Shortcut'],['label','Label'],['id','Snippet ID']]})] },
 'Note': { kind:'note', fields:[field('body','Editor note','textarea',{required:true})], help:'Visible while editing. This note is not inserted when the snippet expands.' },
 'Website': { kind:'site', defaults:{property:'domain'}, fields:[field('property','Page information','select',{options:[['domain','Website domain'],['url','Full page address'],['path','Page path'],['title','Page title'],['selection','Selected text']]})] },
};
const byKind = Object.fromEntries(Object.entries(COMMAND_SPECS).map(([label,spec])=>[spec.kind,label]));
export const escapeSetting = value => String(value ?? '').replace(/[\\{};="']/g, '\\$&');
const yes = value => value ? 'yes' : 'no';
export function buildCommand(label, v) {
 const spec=COMMAND_SPECS[label], kind=spec.kind;
 if (kind==='field')return `{field: ${escapeSetting(v.field)}}`;
 if (kind==='value')return `{value: ${escapeSetting(v.value)}}`;
 const pair = (k,value) => `${k}=${escapeSetting(value)}`;
 const form = positional => `{${kind}: ${[...positional,...['name','default','placeholder','cols','rows','required','multiple'].filter(k=>v[k] !== undefined && (v[k] !== '' || k === 'default')).map(k=>pair(k,typeof v[k]==='boolean'?yes(v[k]):v[k]))].join('; ')}}`;
 if (['formtext','formparagraph'].includes(kind)) return form([]);
 if (kind==='formmenu') return form(v.options.map(escapeSetting));
 if (kind==='formdate') return form([v.format]);
 if (kind==='formtoggle') return `${form([])}${v.body || ''}{endformtoggle}`;
 if (kind==='time') return `{time: ${v.format}${v.preset?`; preset=${v.preset}`:''}${Number(v.shift)?`; shift=${Number(v.shift)>0?'+':''}${Number(v.shift)} ${v.unit}`:''}}`;
 if (kind==='clipboard'||kind==='cursor') return `{${kind}}`;
 if (kind==='click') return `{click: ${pair('selector',v.selector)}}`;
 if (kind==='key') return `{key: ${v.key}}`;
 if (kind==='wait') return `{wait: ${v.delay}s}`;
 if (kind==='=') return `{= ${v.expression || `${v.left} ${v.operator} ${v.right}`}${v.format?`; format=${v.format}`:''}}`;
 if (kind==='if') { const right=/^-?\d+(\.\d+)?$/.test(v.right)?v.right:JSON.stringify(v.right); return `{if: ${v.expression || `${v.left} ${v.operator} ${right}`}}${v.body || ''}{else}${v.otherwise || ''}{endif}`; }
 if (kind==='repeat') return `{repeat: ${v.count}}${v.body || ''}{endrepeat}`;
 if (kind==='error') return `{error: ${escapeSetting(v.message)}; block=${yes(v.block)}}`;
 if (kind==='import') return `{import: ${escapeSetting(v.snippet)}}`;
 if (kind==='snippet'||kind==='site') return `{${kind}: ${v.property}}`;
 if (kind==='note') return `{note}${v.body || ''}{endnote}`;
}
// Locate complete commands, including nested blocks, without altering literal text.
export function commandRanges(text) {
 const all=[];
 for(let i=0;i<text.length;i++) {
  if(text[i]==='\\'){i++;continue;} if(text[i]!=='{')continue;
  const start=i;let depth=1,quote=null,j=i+1;
  for(;j<text.length;j++){const c=text[j];if(c==='\\'){j++;continue;}if(quote){if(c===quote)quote=null;continue;}if(c==='"'||c==="'"){quote=c;continue;}if(c==='{')depth++;if(c==='}'&&!--depth)break;}
  if(depth)continue;
  const header=text.slice(start+1,j),m=header.match(/^(=|[a-z]+)(?:\s*:\s*|\s+)?([\s\S]*)$/i);
  if(m)all.push({from:start,to:j+1,kind:m[1].toLowerCase(),raw:m[2],syntax:text.slice(start,j+1)});i=j;
 }
 const result=[];
 for(let i=0;i<all.length;i++){
  const t=all[i];if(!byKind[t.kind])continue;
  if(['formtoggle','if','repeat','note'].includes(t.kind)){
   let depth=1,close=-1,elseAt=null;
   for(let j=i+1;j<all.length;j++){if(all[j].kind===t.kind)depth++;if(all[j].kind==='end'+t.kind&&!--depth){close=j;break;}if(depth===1&&all[j].kind==='else')elseAt=all[j];}
   if(close<0)continue;
   const end=all[close];t.body=text.slice(t.to,elseAt?.from??end.from);t.otherwise=elseAt?text.slice(elseAt.to,end.from):'';t.to=end.to;t.syntax=text.slice(t.from,t.to);i=close;
  }
  result.push(t);
 }
 return result;
}
export function readCommand(syntax) {
 const t=commandRanges(syntax)[0];if(!t)return null;
 const label=byKind[t.kind],spec=COMMAND_SPECS[label],s=parseSettings(t.raw),v={...spec.defaults,...s.named};
 for(const k of ['required','multiple','block'])if(k in v)v[k]=/^(yes|true|1)$/.test(String(v[k]));
 if(t.body!==undefined){v.body=t.body;v.otherwise=t.otherwise;}
 if(t.kind==='formtoggle')v.default=/^(yes|true|1)$/.test(String(v.default));
 if(t.kind==='formmenu')v.options=s.positional;
 if(t.kind==='time'){v.format=s.positional[0];const m=(s.named.shift||'').match(/([+-]?\d+)\s*(\w+)/);if(m){v.shift=Number(m[1]);v.unit=m[2];}}
 if(t.kind==='formdate')v.format=s.positional[0]||'YYYY-MM-DD';
 if(t.kind==='field')v.field=s.positional[0];
 if(t.kind==='value')v.value=s.positional[0];
 if(t.kind==='key')v.key=s.positional[0];
 if(t.kind==='wait')v.delay=parseFloat(s.positional[0]);
 if(t.kind==='repeat')v.count=s.positional[0];
 if(t.kind==='error')v.message=s.positional[0];
 if(t.kind==='import')v.snippet=s.positional[0];
 if(t.kind==='snippet'||t.kind==='site')v.property=s.positional[0];
 if(t.kind==='='||t.kind==='if'){
  const expr=t.raw.split(';')[0].trim(),m=expr.match(/^(`[^`]+`|[\w .]+?)\s*(==|!=|>=|<=|>|<|\+|-|\*|\/)\s*(`[^`]+`|[\w .]+|"[^"]*")$/);
  if(m){v.left=m[1].replace(/^`|`$/g,'');v.operator=m[2];v.right=m[3].replace(/^["`]|["`]$/g,'');}else v.expression=expr;
 }
 return {label,values:v};
}
export function commandLabel(syntax) {
 const parsed=readCommand(syntax);if(!parsed)return 'Command';const {label,values:v}=parsed;
 const detail=v.name || v.field || v.value || v.property || v.snippet || v.message || v.format || (v.body? v.body.slice(0,24):'');
 return `${label}${detail?' · '+detail:''}${v.default && typeof v.default==='string'?' · '+v.default:''}${v.cols?' · width '+v.cols:''}`;
}
