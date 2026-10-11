import { DOMSerializer, Fragment } from '@tiptap/pm/model';
import { NodeSelection } from '@tiptap/pm/state';
import { nodePlain } from './workflows.js';

let activeMenu = null;
// Let ProseMirror own dragging, dropping and history so a move remains one undoable edit.
export function nodeEventHandled(event) {
  return !['mousedown', 'mouseup', 'dragstart', 'dragover', 'dragenter', 'dragleave', 'dragend', 'drop'].includes(event.type);
}
export function attachNodeInteractions({ handle, editor, getPos, getNode, onEdit }) {
  let dragFinished = 0, menuCleanup = null;
  const select = () => {
    const pos = getPos();
    if (typeof pos !== 'number') return null;
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos)));
    return pos;
  };
  const onMouseDown = event => { if (event.button === 0) select(); };
  const onDragStart = () => { select(); menuCleanup?.(); };
  const onDragEnd = () => { dragFinished = Date.now(); };
  const onClick = event => {
    event.preventDefault(); event.stopPropagation();
    if (Date.now() - dragFinished > 250) onEdit();
  };
  const contextMenu = event => {
    event.preventDefault(); event.stopPropagation();
    if (select() === null) return;
    activeMenu?.();
    const doc = handle.ownerDocument;
    const menu = doc.createElement('div');
    menu.className = 'command-context-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Command actions');
    const close = (focus = false) => {
      menu.remove();
      doc.removeEventListener('pointerdown', outside, true);
      doc.removeEventListener('keydown', keys, true);
      doc.removeEventListener('scroll', scroll, true);
      if (activeMenu === close) activeMenu = null;
      menuCleanup = null;
      if (focus && !editor.isDestroyed) editor.view.focus();
    };
    const outside = e => { if (!menu.contains(e.target)) close(); };
    const scroll = e => { if (!menu.contains(e.target)) close(); };
    const keys = e => {
      if (e.key === 'Escape' || e.key === 'Tab') { if (e.key === 'Escape') e.preventDefault(); close(true); }
      if (['ArrowDown','ArrowUp','Home','End'].includes(e.key)) {
        e.preventDefault();
        const items = [...menu.querySelectorAll('[role=menuitem]')];
        let index = items.indexOf(doc.activeElement);
        index = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items[index].focus();
      }
    };
    function item(label, action) {
      const button = doc.createElement('button');
      button.type = 'button'; button.setAttribute('role','menuitem'); button.textContent = label;
      button.onclick = action; menu.append(button); return button;
    }
    item('Edit command', () => { close(); onEdit(); });
    const copy = item('Copy command', async () => {
      const node = getNode();
      const wrapper = doc.createElement('div');
      wrapper.append(DOMSerializer.fromSchema(editor.schema).serializeFragment(Fragment.from(node), { document: doc }));
      const text = nodePlain(node);
      try {
        if (globalThis.ClipboardItem && navigator.clipboard?.write) {
          await navigator.clipboard.write([new ClipboardItem({
            'text/html': new Blob([wrapper.innerHTML], { type:'text/html' }),
            'text/plain': new Blob([text], { type:'text/plain' }),
          })]);
        } else {
          if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
          await navigator.clipboard.writeText(text);
        }
        close(true);
      } catch {
        copy.textContent = 'Copy unavailable — press ⌘/Ctrl+C';
        editor.view.focus();
      }
    });
    item('Delete command', () => {
      const pos = getPos(), node = getNode();
      close();
      if (typeof pos === 'number') editor.chain().focus().deleteRange({ from:pos, to:pos + node.nodeSize }).run();
    }).className = 'delete-command';
    doc.body.append(menu);
    const bounds = handle.getBoundingClientRect();
    const x = event.clientX || bounds.left, y = event.clientY || bounds.bottom;
    menu.style.left = Math.max(8, Math.min(x, doc.defaultView.innerWidth - menu.offsetWidth - 8)) + 'px';
    menu.style.top = Math.max(8, Math.min(y, doc.defaultView.innerHeight - menu.offsetHeight - 8)) + 'px';
    doc.addEventListener('pointerdown', outside, true);
    doc.addEventListener('keydown', keys, true);
    doc.addEventListener('scroll', scroll, true);
    activeMenu = close; menuCleanup = close;
    menu.querySelector('button').focus();
  };
  const onKeyDown = event => {
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) contextMenu(event);
    else if (event.key === 'Enter' || event.key === ' ') onClick(event);
  };
  handle.draggable = true;
  handle.addEventListener('mousedown', onMouseDown);
  handle.addEventListener('dragstart', onDragStart);
  handle.addEventListener('dragend', onDragEnd);
  handle.addEventListener('click', onClick);
  handle.addEventListener('contextmenu', contextMenu);
  handle.addEventListener('keydown', onKeyDown);
  return () => {
    menuCleanup?.();
    for (const [name,fn] of [['mousedown',onMouseDown],['dragstart',onDragStart],['dragend',onDragEnd],['click',onClick],['contextmenu',contextMenu],['keydown',onKeyDown]]) handle.removeEventListener(name,fn);
  };
}
