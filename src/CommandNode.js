import { Node, mergeAttributes } from '@tiptap/core';
import { commandRanges, commandLabel } from './commandModel.js';
import DOMPurify from 'dompurify';
export const CommandNode = Node.create({
 name:'snippetCommand', group:'inline', inline:true, atom:true, selectable:true,
 addOptions(){return {onEdit:()=>{}};},
 addAttributes(){return {syntax:{default:'',parseHTML:el=>el.getAttribute('data-command'),renderHTML:attrs=>({'data-command':attrs.syntax})}};},
 parseHTML(){return [{tag:'span[data-command]'}];},
 renderHTML({node,HTMLAttributes}){return ['span',mergeAttributes(HTMLAttributes,{class:'snippet-command',role:'button',tabindex:'0','aria-label':`Edit ${commandLabel(node.attrs.syntax)}`}),commandLabel(node.attrs.syntax)];},
 renderText({node}){return node.attrs.syntax;},
 addNodeView(){return ({node,getPos})=>{
  const dom=document.createElement('span');dom.className='snippet-command';dom.contentEditable='false';dom.tabIndex=0;dom.setAttribute('role','button');
  const update=n=>{dom.textContent=commandLabel(n.attrs.syntax);dom.setAttribute('aria-label',`Edit ${commandLabel(n.attrs.syntax)}`);dom.title='Click to edit command';};update(node);
  const open=e=>{e.preventDefault();e.stopPropagation();this.options.onEdit(node.attrs.syntax,getPos());};
  dom.addEventListener('click',open);dom.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')open(e);});
  return {dom,stopEvent:()=>true,update(next){if(next.type!==node.type)return false;node=next;update(node);return true;}};
 };}
});
export function commandHTML(html) {
 const body=new DOMParser().parseFromString(DOMPurify.sanitize(html),'text/html').body;
 const walker=document.createTreeWalker(body,4);const nodes=[];while(walker.nextNode())if(!walker.currentNode.parentElement.closest('[data-command]'))nodes.push(walker.currentNode);
 for(const node of nodes){const text=node.textContent,ranges=commandRanges(text);if(!ranges.length)continue;const frag=document.createDocumentFragment();let pos=0;
  for(const r of ranges){frag.append(document.createTextNode(text.slice(pos,r.from)));const chip=document.createElement('span');chip.setAttribute('data-command',r.syntax);chip.textContent=commandLabel(r.syntax);frag.append(chip);pos=r.to;}frag.append(document.createTextNode(text.slice(pos)));node.replaceWith(frag);
 }
 return body.innerHTML;
}
