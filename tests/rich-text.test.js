import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://example.test' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
const { Editor } = await import('@tiptap/core');
const { default: StarterKit } = await import('@tiptap/starter-kit');
const { default: Underline } = await import('@tiptap/extension-underline');
const { default: TextStyle } = await import('@tiptap/extension-text-style');
const { default: Color } = await import('@tiptap/extension-color');
const { richPreview, plainHTML } = await import('../src/richText.js');
const context = { fields: {}, vars: {}, user: {}, lookup: () => null };

test('legacy plain snippets remain literal, with line breaks', () => {
  const html = richPreview({ content: 'A < B\nSecond line' }, context);
  assert.equal(html, '<p>A &lt; B</p><p>Second line</p>');
});
test('formatting persists in saved content and survives reload', () => {
  const make = content => new Editor({ extensions: [StarterKit, Underline, TextStyle, Color], content });
  const editor = make(plainHTML('Hello world'));
  editor.commands.setTextSelection({ from: 1, to: 6 });
  editor.commands.toggleBold();
  editor.commands.toggleUnderline();
  editor.commands.setColor('#608474');
  const saved = JSON.parse(JSON.stringify({ content: editor.getText(), richContent: editor.getHTML() }));
  assert.equal(saved.content, 'Hello world');
  assert.match(saved.richContent, /<strong>/);
  assert.match(saved.richContent, /<u>/);
  assert.match(saved.richContent, /color:/);
  const restored = make(saved.richContent);
  assert.equal(restored.getHTML(), saved.richContent);
  assert.equal(restored.getText(), 'Hello world');
  editor.destroy(); restored.destroy();
});
test('dynamic fields render inside formatting without injecting HTML', () => {
  const snippet = { content: 'Hello {formtext: name=person}', richContent: '<p><strong>Hello {formtext: name=person}</strong></p>' };
  const html = richPreview(snippet, { ...context, fields: { person: '<img src=x onerror=alert(1)>' } });
  assert.match(html, /<strong>Hello &lt;img/);
  assert.equal(new DOMParser().parseFromString(html, 'text/html').querySelector('img'), null);
});
test('conditions and formulas work with rich text markup', () => {
  const html = richPreview({ richContent: '<p>{if: qty &gt; 5}<strong>Bulk</strong>{else}Standard{endif}</p><p>Total: {= qty * 2}</p>' }, { ...context, fields: { qty: '6' } });
  assert.match(html, /<strong>Bulk<\/strong>/);
  assert.match(html, /Total: 12/);
  assert.doesNotMatch(html, /Standard/);
});
test('imported rich snippets preserve their formatting', () => {
  const html = richPreview({ richContent: '<p>{import: /sig}</p>' }, { ...context, lookup: () => ({ content: 'Best', richContent: '<p><em>Best</em></p>' }) });
  assert.match(html, /<em>Best<\/em>/);
});
test('unsafe imported HTML is removed', () => {
  const html = richPreview({ richContent: '<p onclick="alert(1)">Safe<script>alert(1)</script><a href="javascript:alert(1)">link</a></p>' }, context);
  assert.doesNotMatch(html, /onclick|script|javascript:/);
});
const { COMMAND_SPECS, buildCommand, readCommand, commandRanges } = await import('../src/commandModel.js');
const { CommandNode, commandHTML } = await import('../src/CommandNode.js');
const { fieldsFor, expand } = await import('../src/engine.js');
test('all 19 palette commands round-trip through the GUI model', () => {
 const values={name:'test',default:'Hello',body:'Some text',selector:'#submit',message:'Please enter a name',snippet:'/sig',left:'price',right:'2'};
 for(const [label,spec] of Object.entries(COMMAND_SPECS)) {
  const syntax=buildCommand(label,{...values,...spec.defaults});
  const parsed=readCommand(syntax);
  assert.equal(parsed?.label,label,syntax);
  assert.equal(buildCommand(label,parsed.values),syntax,label);
 }
});
test('text field preserves punctuation, default and dimensions', () => {
 const value='Say "hello"; A=B {literal}';
 const syntax=buildCommand('Text field',{name:'test',default:value,cols:30,required:true});
 const fields=fieldsFor(syntax);
 assert.equal(fields[0].default,value);
 assert.equal(fields[0].cols,30);
 assert.equal(fields[0].required,true);
 assert.equal(expand(syntax,context).text,value);
});
test('nested block commands stay together', () => {
 const s='{if: qty > 2}Yes {formtext: name=name}{else}No{endif}';
 assert.equal(commandRanges(s).length,1);
 assert.equal(readCommand(s).values.body,'Yes {formtext: name=name}');
});
test('chips save underlying syntax, reopen, update and expand in preview', () => {
 const syntax=buildCommand('Text field',{name:'test',default:'say hello',cols:30});
 const editor=new Editor({extensions:[StarterKit,CommandNode],content:commandHTML(`<p>Hi ${syntax}</p>`)});
 assert.equal(editor.getText(),`Hi ${syntax}`);
 assert.equal(editor.getJSON().content[0].content[1].type,'snippetCommand');
 const saved={content:editor.getText(),richContent:editor.getHTML()};
 assert.match(richPreview(saved,{...context,fields:{test:'Jordan'}}),/Hi Jordan/);
 const restored=new Editor({extensions:[StarterKit,CommandNode],content:saved.richContent});
 assert.equal(restored.getText(),saved.content);
 restored.commands.setNodeSelection(4);
 const changed=buildCommand('Text field',{name:'test',default:'Updated',cols:40});
 restored.commands.updateAttributes('snippetCommand',{syntax:changed});
 assert.equal(restored.getText(),`Hi ${changed}`);
 editor.destroy();restored.destroy();
});
test('multi-select output and date output use requested formats', () => {
 const syntax=buildCommand('Dropdown menu',{name:'choice',options:['A','B'],multiple:true,default:'A'});
 assert.equal(fieldsFor(syntax)[0].multiple,true);
 assert.equal(expand(syntax,{...context,fields:{choice:['A','B']}}).text,'A, B');
 const date=buildCommand('Date/Time field',{name:'date',format:'MM/DD/YYYY'});
 assert.equal(expand(date,{...context,fields:{date:'2026-10-10'}}).text,'10/10/2026');
});
test('dropdown can have no default selection', () => {
 const syntax=buildCommand('Dropdown menu',{name:'choice',options:['A','B'],default:''});
 assert.equal(fieldsFor(syntax)[0].default,'');
});
test('legacy multiline snippets keep their line breaks during conversion', () => {
 const editor=new Editor({extensions:[StarterKit,CommandNode],parseOptions:{preserveWhitespace:'full'},content:commandHTML('<p>Hello\n\n{formtext: name=name}\nGoodbye</p>')});
 assert.equal(editor.getText(),'Hello\n\n{formtext: name=name}\nGoodbye');
 editor.destroy();
});
const W=await import('../src/workflows.js');
const {ConditionalNode}=await import('../src/ConditionalNode.js');
const sampleDb=()=>W.normalizeDb({folders:[{id:'f',name:'Examples'}],user:{},values:[{key:'unit_price',value:'120'}],snippets:[{id:'s',folderId:'f',label:'Quote',shortcut:'/quote',content:'{formtext: name=quantity; default=3} items for {= `quantity` * `unit_price`; format=$,.2f}'},{id:'other',folderId:'f',label:'Greeting',shortcut:'/hi',content:'{formtext: name=person} Hello {field: person}'}]});
test('reusable fields prompt once and calculations use shared values',()=>{
 const db=sampleDb();assert.equal(W.allFields(db.snippets[1],db).length,1);
 assert.equal(W.evaluateSnippet(db.snippets[1],db,{person:'Jordan'},'').text,'Jordan Hello Jordan');
 assert.equal(W.evaluateSnippet(db.snippets[0],db,{},'').text,'3 items for $360.00');
 db.values[0].value='125';assert.equal(W.evaluateSnippet(db.snippets[0],db,{},'').text,'3 items for $375.00');
 assert.deepEqual(W.valueDependents('unit_price',db).map(s=>s.id),['s']);
});
test('multi-condition rules compare distinct strings and consume every branch',()=>{
 const rules=[{field:'status',operator:'==',value:'ready'},{field:'count',operator:'>',value:'2'}];
 const expression=W.ruleExpression(rules,'all');
 assert.equal(expand(`{if: ${expression}}Yes{else}No{endif}`,{...context,fields:{status:'other',count:3}}).text,'No');
 assert.equal(expand(`{if: ${expression}}Yes{else}No{endif}`,{...context,fields:{status:'ready',count:3}}).text,'Yes');
 const any=W.ruleExpression(rules,'any');assert.equal(expand(`{if: ${any}}Yes{else}No{endif}`,{...context,fields:{status:'ready',count:0}}).text,'Yes');
});
test('visual conditional sections preserve formatting, serialize and preview',()=>{
 const rules=[{field:'qty',operator:'>',value:'5'}];
 const ed=new Editor({extensions:[StarterKit,CommandNode,ConditionalNode],content:{type:'doc',content:[{type:'conditionalSection',attrs:{rules,mode:'all'},content:[{type:'paragraph',content:[{type:'text',text:'Volume discount',marks:[{type:'bold'}]}]}]}]}});
 const snippet={content:W.nodePlain(ed.getJSON()),richContent:ed.getHTML()};
 assert.match(snippet.content,/\{if:/);
 assert.match(richPreview(snippet,{...context,fields:{qty:6}}),/<strong>Volume discount<\/strong>/);
 assert.doesNotMatch(richPreview(snippet,{...context,fields:{qty:2}}),/Volume discount/);
 ed.destroy();
});
test('health checks missing references, duplicates and circular imports',()=>{
 const db=sampleDb();db.snippets.push({id:'bad',label:'Broken',shortcut:'/hi',sites:[],content:'{field: missing}{value: absent}{import: /loop}'},{id:'loop',label:'Loop',shortcut:'/loop',sites:[],content:'{import: /loop}'});
 const codes=new Set(W.healthCheck(db).map(i=>i.code));for(const code of ['duplicate','field','value','cycle'])assert.ok(codes.has(code),code);
 assert.equal(W.allFields(db.snippets.at(-1),db).length,0);
});
test('history checkpoints capture previous contents and explicit saves survive',()=>{
 let db=sampleDb();db=W.updateSnippet(db,'s',{content:'Changed'});assert.equal(db.snippets[0].history[0].snapshot.content,sampleDb().snippets[0].content);
 const version=W.checkpoint(db.snippets[0],'Named version');db=W.updateSnippet(db,'s',{history:[...db.snippets[0].history,version]});assert.equal(db.snippets[0].history.at(-1).reason,'Named version');
 db=W.updateSnippet(db,'s',version.snapshot,'Before restore');assert.equal(db.snippets[0].content,'Changed');
});
test('website rules match exact domains and their subdomains only',()=>{
 const s={sites:['example.com']};assert.ok(W.siteAllowed(s,'https://mail.example.com/path'));assert.ok(W.siteAllowed(s,'https://example.com'));assert.equal(W.siteAllowed(s,'https://notexample.com'),false);assert.equal(W.siteAllowed(s,'https://example.com.evil.test'),false);
});
test('saved test dates are repeatable and business-day presets skip weekends',()=>{
 const now='2026-10-09T12:00:00';const s={id:'date',content:'{time: YYYY-MM-DD; preset=business}'};const db=sampleDb();
 assert.equal(W.evaluateSnippet(s,db,{},'',now).text,'2026-10-12');
 assert.equal(W.datePreset('business',new Date(now)).getDay(),1);
 assert.equal(W.evaluateSnippet({id:'zero',content:'{= 4 / 0}'},db,{},'').errors[0],'Cannot divide by zero.');
});
test('rich preview can identify the source command without rendering injected HTML',()=>{
 const syntax='{formtext: name=person}';const editor=new Editor({extensions:[StarterKit,CommandNode],content:commandHTML(`<p>${syntax}</p>`)});
 const html=richPreview({richContent:editor.getHTML()},{...context,fields:{person:'<script>bad</script>'}},true);
 assert.match(html,/data-source=/);assert.doesNotMatch(html,/<script>/);editor.destroy();
});
