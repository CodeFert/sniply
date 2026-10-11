import { Plugin } from '@tiptap/pm/state';
import { Node, mergeAttributes } from '@tiptap/core';
import { commandRanges, commandLabel } from './commandModel.js';
import { attachNodeInteractions, nodeEventHandled } from './nodeInteractions.js';
import DOMPurify from 'dompurify';
export const CommandNode = Node.create({
 name:'snippetCommand', group:'inline', inline:true, atom:true, selectable:true, draggable:true,
 addOptions(){return {onEdit:()=>{}};},
 addAttributes(){return {syntax:{default:'',parseHTML:el=>el.getAttribute('data-command'),renderHTML:attrs=>({'data-command':attrs.syntax})}};},
 parseHTML(){return [{tag:'span[data-command]'}];},
 renderHTML({node,HTMLAttributes}){return ['span',mergeAttributes(HTMLAttributes,{class:'snippet-command',role:'button',tabindex:'0','aria-label':`Edit ${commandLabel(node.attrs.syntax)}`}),commandLabel(node.attrs.syntax)];},
 renderText({node}){return node.attrs.syntax;},
 addProseMirrorPlugins(){return [new Plugin({props:{handlePaste(view,event){
   const data=event.clipboardData;
   if(!data || data.getData('text/html'))return false;
   const text=data.getData('text/plain'),ranges=commandRanges(text);
   if(ranges.length!==1 || ranges[0].syntax!==text)return false;
   view.dispatch(view.state.tr.replaceSelectionWith(view.state.schema.nodes.snippetCommand.create({syntax:text})).scrollIntoView());
   return true;
 }}})];},
 addNodeView(){return ({node,getPos,editor})=>{
  const dom=document.createElement('span');dom.className='snippet-command';dom.contentEditable='false';dom.tabIndex=0;dom.setAttribute('role','button');
  const update=n=>{dom.textContent=commandLabel(n.attrs.syntax);dom.setAttribute('aria-label',`Edit ${commandLabel(n.attrs.syntax)}`);dom.title='Click to edit · Drag to move · Right-click for actions';};update(node);
  const destroy = attachNodeInteractions({handle:dom,editor,getPos,getNode:()=>node,onEdit:()=>this.options.onEdit(node.attrs.syntax,getPos())});
  return {dom,destroy,stopEvent:nodeEventHandled,update(next){if(next.type!==node.type)return false;node=next;update(node);return true;}};
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
