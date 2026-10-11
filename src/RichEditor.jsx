import { forwardRef, useImperativeHandle, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import FontFamily from "@tiptap/extension-font-family";
import DOMPurify from "dompurify";
import { Bold, Italic, Underline as UnderlineIcon, Strikethrough, Link as LinkIcon, Unlink, AlignLeft, AlignCenter, AlignRight, List, ListOrdered, Undo2, Redo2, RemoveFormatting, Highlighter, Trash2 } from "lucide-react";
import { ConditionalNode } from "./ConditionalNode.js";
import RuleDialog from "./RuleDialog.jsx";
import { nodePlain, ruleExpression } from "./workflows.js";
import { CommandNode, commandHTML } from "./CommandNode.js";
import CommandDialog from "./CommandDialog.jsx";
import { fieldsFor } from "./engine.js";
import { COMMAND_SPECS } from "./commandModel.js";
import { readCommand } from "./commandModel.js";
import { escapeHTML } from "./richText.js";
import { plainHTML } from "./richText.js";

const RichEditor = forwardRef(function RichEditor({ snippet, snippets, fields = [], sharedValues = [], pageMappings = [], answers = {}, onChange, onDelete }, ref) {
  const [condition, setCondition] = useState(null);
  const [command, setCommand] = useState(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [linkError, setLinkError] = useState("");
  const editor = useEditor({
    extensions: [ConditionalNode.configure({ onEdit: (attrs,pos) => setCondition({ ...attrs, pos }) }), CommandNode.configure({ onEdit: (syntax, pos) => { const parsed = readCommand(syntax); if (parsed) setCommand({ ...parsed, pos }); } }), StarterKit, Underline, Link.configure({ openOnClick: false, autolink: false }), TextStyle, Color, Highlight.configure({ multicolor: true }), TextAlign.configure({ types: ["heading", "paragraph"] }), FontFamily],
    parseOptions: { preserveWhitespace: "full" },
    content: commandHTML(snippet.richContent || `<p>${escapeHTML(snippet.content)}</p>`),
    editorProps: { attributes: { class: "rich-editor", "aria-label": "Snippet content", role: "textbox", "aria-multiline": "true" } },
    onCreate: ({ editor }) => { if (editor.getHTML() !== snippet.richContent) onChange({ content: nodePlain(editor.getJSON()), richContent: editor.getHTML() }); },
    onUpdate: ({ editor }) => onChange({ content: nodePlain(editor.getJSON()), richContent: editor.getHTML() }),
  });
  useImperativeHandle(ref, () => ({
    editCommand: syntax => { let pos=null;editor.state.doc.descendants((node,p)=>{if(pos===null&&node.type.name==='snippetCommand'&&node.attrs.syntax===syntax)pos=p;});const parsed=readCommand(syntax);if(pos!==null&&parsed)setCommand({...parsed,pos}); },
    focusCommand: syntax => { let pos=null;editor.state.doc.descendants((node,p)=>{if(pos===null&&(node.type.name==='snippetCommand'&&node.attrs.syntax===syntax||node.type.name==='conditionalSection'&&`{if: ${ruleExpression(node.attrs.rules,node.attrs.mode)}}{endif}`===syntax))pos=p;});if(pos!==null)editor.chain().focus().setNodeSelection(pos).scrollIntoView().run(); },
    reuse: name => editor.chain().focus().insertContent({type:'snippetCommand',attrs:{syntax:`{field: ${name}}`}}).run(),
    insert: label => { const { from, to } = editor.state.selection; const base = COMMAND_SPECS[label]?.defaults?.name;
      const existing = new Set(fieldsFor(editor.getText()).map(f => f.name));
      let name = base, suffix = 2;
      while (name && existing.has(name)) name = base + suffix++;
      setCommand({ label, from, to, suggested: name ? { ...COMMAND_SPECS[label].defaults, name } : undefined }); } }), [editor]);
  if (!editor) return null;
  const button = (label, Icon, action, active = false, disabled = false) => <button type="button" title={label} aria-label={label} aria-pressed={active} disabled={disabled} className={active ? "active" : ""} onMouseDown={e => e.preventDefault()} onClick={action}><Icon size={17} strokeWidth={1.8} /></button>;
  const mark = name => () => editor.chain().focus()[name]().run();
  function saveLink(e) {
    e.preventDefault();
    const value = url.trim();
    if (!/^(https?:\/\/|mailto:)/i.test(value)) { setLinkError("Use an https://, http://, or mailto: link."); return; }
    editor.chain().focus().extendMarkRange("link").setLink({ href: value }).run();
    setLinkOpen(false);
  }
  return <>
    <div className="editor-actions"><button type="button" className="ghost" onMouseDown={e=>e.preventDefault()} onClick={()=>setCondition({selection:{from:editor.state.selection.from,to:editor.state.selection.to}})}>Show selected paragraphs when…</button><span className="hint">Select text or place your cursor in a paragraph.</span></div>
    <div className="toolbar" role="toolbar" aria-label="Text formatting">
      <div className="tool-group">
        {button("Bold (⌘/Ctrl B)", Bold, mark("toggleBold"), editor.isActive("bold"))}
        {button("Italic (⌘/Ctrl I)", Italic, mark("toggleItalic"), editor.isActive("italic"))}
        {button("Underline (⌘/Ctrl U)", UnderlineIcon, mark("toggleUnderline"), editor.isActive("underline"))}
        {button("Strikethrough", Strikethrough, mark("toggleStrike"), editor.isActive("strike"))}
      </div>
      <div className="tool-group">
        {button("Add or edit link", LinkIcon, () => { setUrl(editor.getAttributes("link").href || "https://"); setLinkError(""); setLinkOpen(true); }, editor.isActive("link"), editor.state.selection.empty && !editor.isActive("link"))}
        {button("Remove link", Unlink, () => editor.chain().focus().extendMarkRange("link").unsetLink().run(), false, !editor.isActive("link"))}
        <label className="color-tool" title="Text color"><span aria-hidden="true">A</span><input type="color" aria-label="Text color" value={editor.getAttributes("textStyle").color || "#252827"} onChange={e => editor.chain().focus().setColor(e.target.value).run()} /></label>
        {button("Highlight", Highlighter, () => editor.chain().focus().toggleHighlight({ color: "#fef3c7" }).run(), editor.isActive("highlight"))}
      </div>
      <div className="tool-group">
        <select aria-label="Font family" value={editor.getAttributes("textStyle").fontFamily || ""} onChange={e => e.target.value ? editor.chain().focus().setFontFamily(e.target.value).run() : editor.chain().focus().unsetFontFamily().run()}><option value="">Default font</option><option value="Arial">Arial</option><option value="Georgia">Georgia</option><option value="Verdana">Verdana</option><option value="monospace">Monospace</option></select>
        <select aria-label="Paragraph style" value={editor.isActive("heading", { level: 1 }) ? "1" : editor.isActive("heading", { level: 2 }) ? "2" : editor.isActive("heading", { level: 3 }) ? "3" : "0"} onChange={e => e.target.value === "0" ? editor.chain().focus().setParagraph().run() : editor.chain().focus().setHeading({ level: Number(e.target.value) }).run()}><option value="0">Normal</option><option value="1">Heading 1</option><option value="2">Heading 2</option><option value="3">Heading 3</option></select>
      </div>
      <div className="tool-group">
        {button("Align left", AlignLeft, () => editor.chain().focus().setTextAlign("left").run(), editor.isActive({ textAlign: "left" }))}
        {button("Align center", AlignCenter, () => editor.chain().focus().setTextAlign("center").run(), editor.isActive({ textAlign: "center" }))}
        {button("Align right", AlignRight, () => editor.chain().focus().setTextAlign("right").run(), editor.isActive({ textAlign: "right" }))}
        {button("Bullet list", List, mark("toggleBulletList"), editor.isActive("bulletList"))}
        {button("Numbered list", ListOrdered, mark("toggleOrderedList"), editor.isActive("orderedList"))}
      </div>
      <div className="tool-group">
        {button("Clear formatting", RemoveFormatting, () => editor.chain().focus().unsetAllMarks().clearNodes().unsetTextAlign().run())}
        {button("Undo", Undo2, mark("undo"), false, !editor.can().undo())}
        {button("Redo", Redo2, mark("redo"), false, !editor.can().redo())}
      </div>
      <div className="tool-group tool-delete">{button("Delete snippet", Trash2, onDelete)}</div>
    </div>
    <div className="sheet"><EditorContent editor={editor} /></div>
    {condition && <RuleDialog fields={[...fields,...sharedValues.map(v=>({name:v.key,label:v.key}))]} initial={condition.rules ? condition : null} onCancel={()=>setCondition(null)} onSave={attrs=>{if(condition.pos!=null)editor.chain().focus().setNodeSelection(condition.pos).updateAttributes('conditionalSection',attrs).run();else editor.chain().focus().setTextSelection(condition.selection).wrapIn('conditionalSection',attrs).run();setCondition(null);}} onRemove={condition.pos!=null?()=>{editor.chain().focus().setTextSelection(condition.pos+1).lift('conditionalSection').run();setCondition(null);}:undefined} />}
    {command && <CommandDialog key={`${command.label}-${command.pos ?? "new"}`} fields={fields} sharedValues={sharedValues} pageMappings={pageMappings} answers={answers} label={command.label} initial={command.values} defaults={command.suggested} snippets={snippets.filter(s => s.id !== snippet.id)} onCancel={() => { setCommand(null); editor.commands.focus(); }} onSave={syntax => {
      const range = command.pos != null ? { from: command.pos, to: command.pos + 1 } : { from: command.from, to: command.to };
      editor.chain().focus().insertContentAt(range, { type: "snippetCommand", attrs: { syntax } }).run();
      setCommand(null);
    }} onRemove={command.pos != null ? () => { editor.chain().focus().deleteRange({ from: command.pos, to: command.pos + 1 }).run(); setCommand(null); } : undefined} />}
    {linkOpen && <div className="modal-back"><form className="modal" onSubmit={saveLink} role="dialog" aria-modal="true" aria-label="Edit link"><h3>Add a link</h3><label className="field"><span>Link address</span><input autoFocus value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com" /></label>{linkError && <p className="err">{linkError}</p>}<div className="actions"><button type="button" className="ghost" onClick={() => setLinkOpen(false)}>Cancel</button><button className="btn accent" type="submit">Apply link</button></div></form></div>}
  </>;
});
export default RichEditor;
