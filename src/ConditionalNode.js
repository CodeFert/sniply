import { Node, mergeAttributes } from '@tiptap/core';
import { attachNodeInteractions, nodeEventHandled } from './nodeInteractions.js';
import { nodePlain } from './workflows.js';
export const ConditionalNode = Node.create({
 name:'conditionalSection', group:'block', content:'block+', defining:true, draggable:true,
 addOptions(){return {onEdit:()=>{}};},
 addAttributes(){return {rules:{default:[],parseHTML:el=>{try{return JSON.parse(el.getAttribute('data-rules')||'[]');}catch{return [];}},renderHTML:a=>({'data-rules':JSON.stringify(a.rules)})},mode:{default:'all',parseHTML:el=>el.getAttribute('data-mode')||'all',renderHTML:a=>({'data-mode':a.mode})}};},
 parseHTML(){return [{tag:'section[data-conditional]'}];},
 renderHTML({HTMLAttributes}){return ['section',mergeAttributes(HTMLAttributes,{'data-conditional':'true'}),0];},
 renderText({node}){return nodePlain(node);},
 addNodeView(){return ({node,getPos,editor})=>{const dom=document.createElement('section');dom.className='conditional-editor';const bar=document.createElement('button');bar.type='button';bar.contentEditable='false';bar.className='condition-bar';const contentDOM=document.createElement('div');contentDOM.className='condition-content';const refresh=()=>{bar.textContent=`Show when ${node.attrs.mode==='any'?'any':'all'} of ${node.attrs.rules.length} conditions match · Edit rules`;};refresh();bar.title='Drag to move this section · Right-click for actions';const destroy=attachNodeInteractions({handle:bar,editor,getPos,getNode:()=>node,onEdit:()=>this.options.onEdit(node.attrs,getPos())});dom.append(bar,contentDOM);return {dom,contentDOM,destroy,update(next){if(next.type!==node.type)return false;node=next;refresh();return true;},stopEvent:event=>bar.contains(event.target)&&nodeEventHandled(event)};};}
});
