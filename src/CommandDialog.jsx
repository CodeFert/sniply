import { useEffect, useRef, useState } from 'react';
import { expand, formatTime } from './engine.js';
import { ref, datePreset } from './workflows.js';
import { COMMAND_SPECS, buildCommand } from './commandModel.js';
import CommandIcon from './CommandIcon.jsx';
import { COMMANDS } from './data.js';
export default function CommandDialog({ label, initial, defaults, snippets, fields = [], sharedValues = [], pageMappings = [], answers = {}, onSave, onCancel, onRemove }) {
 const spec=COMMAND_SPECS[label];
 const [values,setValues]=useState(()=>({...spec.defaults,...defaults,...initial}));
 const exampleContext={fields:answers,vars:Object.fromEntries(sharedValues.map(v=>[v.key,v.value])),errors:[]};
 const operand=x=>[...fields.map(f=>f.name),...sharedValues.map(v=>v.key)].includes(x)?ref(x):x;
 const example=label==='Formula'?expand(buildCommand(label,{...values,left:operand(values.left),right:operand(values.right)}),exampleContext):null;
 const missingOperands=label==='Formula'?['left','right'].filter(k=>fields.some(f=>f.name===values[k])&&(answers[values[k]]==null||answers[values[k]]==='')):[];
 const dialog=useRef(null);
 useEffect(()=>{dialog.current.showModal();return()=>dialog.current?.close();},[]);
 const set=(key,value)=>setValues(v=>({...v,[key]:value}));
 function submit(e){e.preventDefault();const v={...values};
 if(label==='Formula')for(const k of ['left','right'])if([...fields.map(f=>f.name),...sharedValues.map(s=>s.key)].includes(v[k]))v[k]=ref(v[k]);
 onSave(buildCommand(label,v));}
 return <dialog ref={dialog} className="command-dialog" onCancel={e=>{e.preventDefault();onCancel();}} aria-labelledby="command-title">
  <form onSubmit={submit}>
   <header className="command-dialog-header"><CommandIcon command={COMMANDS.find(c=>c.name===label)} /><h3 id="command-title">{initial?'Edit':'Insert'} {label.toLowerCase()}</h3><button type="button" className="dialog-close" aria-label="Close command settings" onClick={onCancel}>×</button></header>
   <div className="command-dialog-body">
    <p className="sub">{spec.help || 'Choose the settings below. Click the command in your snippet to change them later.'}</p>
    {spec.fields.filter(f=>!(values.expression&&['left','right','operator'].includes(f.key))).map(f=>{
      if(f.type==='checkbox')return <label className="check-field" key={f.key}><input type="checkbox" checked={!!values[f.key]} onChange={e=>set(f.key,e.target.checked)} />{f.label}</label>;
      if(f.type==='options')return <fieldset className="choice-builder" key={f.key}><legend>Choices <small>— select the default</small></legend>{(values.options||[]).map((option,i)=><div className="choice-row" key={i}><input type="radio" name="default-choice" aria-label={`Default choice ${i+1}`} checked={values.default===option} onChange={()=>set('default',option)} /><input aria-label={`Choice ${i+1}`} required value={option} onChange={e=>{const next=[...values.options];next[i]=e.target.value;setValues(v=>({...v,options:next,default:v.default===option?e.target.value:v.default}));}} /><button type="button" aria-label={`Remove choice ${i+1}`} disabled={values.options.length<=1} onClick={()=>setValues(v=>({...v,options:v.options.filter((_,n)=>n!==i),default:v.default===option?'':v.default}))}>×</button></div>)}<div className="choice-actions"><button type="button" className="ghost" onClick={()=>set('options',[...values.options,''])}>+ Add choice</button><button type="button" className="ghost" onClick={()=>set('default','')}>No default</button></div></fieldset>;
      let options=f.type==='existingField'?fields.map(f=>[f.name,f.label||f.name]):f.type==='sharedValue'?sharedValues.map(v=>[v.key,`${v.key} — ${v.value}`]):f.type==='snippet'?snippets.map(s=>[s.shortcut,`${s.label} (${s.shortcut})`]):f.options;
      if(label==='Website'&&f.key==='property')options=[...options,...[...new Set(pageMappings.map(m=>m.key))].map(key=>['mapped:'+key,'Page value: '+key])];
      return <label className="field parameter-field" key={f.key}><span>{f.label}{f.required?' *':''}</span>
        {f.type==='textarea'?<textarea rows={4} required={f.required} value={values[f.key]||''} onChange={e=>set(f.key,e.target.value)} />:
        options?<select required={f.required} value={values[f.key]??''} onChange={e=>set(f.key,e.target.value)}>{['snippet','existingField','sharedValue'].includes(f.type)&&<option value="">Choose an item</option>}{options.map(o=>{const [value,text]=Array.isArray(o)?o:[o,o];return <option key={value} value={value}>{f.key==='format' && label.includes('Date/Time') ? formatTime(new Date(), value) : text}</option>;})}</select>:
        <input list={label==="Formula"&&["left","right"].includes(f.key)?"calculation-fields":undefined} type={f.type} required={f.required} min={f.min} max={f.max} step={f.step} placeholder={f.placeholder} value={values[f.key]??''} onChange={e=>set(f.key,e.target.value)} />}
        {f.help&&<small>{f.help}</small>}
      </label>;
    })}
    {label==='Formula' && <><datalist id="calculation-fields">{[...fields.map(f=>f.name),...sharedValues.map(v=>v.key)].map(n=><option key={n} value={n}/>)}</datalist><div className="calculation-example"><b>Worked example</b><p>{String(answers[values.left] ?? sharedValues.find(v=>v.key===values.left)?.value ?? values.left ?? '?')} {values.operator} {String(answers[values.right] ?? sharedValues.find(v=>v.key===values.right)?.value ?? values.right ?? '?')} = {missingOperands.length?'Add sample answers':example?.text}</p>{example?.errors?.map((err,i)=><p className="err" key={i}>{err}</p>)}<small>Pick a named field or type a number. Fill sample answers in Live preview to see the result.</small></div></>}
    {label==='Date/Time' && <p className="calculation-example">Example: {expand(buildCommand('Date/Time',values),{fields:{},vars:{}}).text}</p>}
    {values.expression&&<p className="hint">This existing calculation uses an advanced expression. Its expression will be preserved. <button type="button" className="ghost" onClick={()=>set('expression','')}>Use simple builder</button></p>}
   </div>
   <footer className="actions command-dialog-footer">{onRemove&&<button type="button" className="ghost remove-command" onClick={onRemove}>Remove</button>}<button type="button" className="ghost" onClick={onCancel}>Cancel</button><button type="submit" className="btn accent">{initial?'Save changes':'Insert command'}</button></footer>
  </form>
 </dialog>;
}
