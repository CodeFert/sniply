import DOMPurify from "dompurify";
import { ruleExpression } from "./workflows.js";
import { expand } from "./engine.js";
export const escapeHTML = (value = "") => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const plainHTML = (text = "") => text.split("\n").map(line => `<p>${escapeHTML(line) || "<br>"}</p>`).join("");
export function richPreview(snippet, context, trace = false) {
  if (!snippet.richContent) return plainHTML(expand(snippet.content, context).text);
  // Keep markup outside the command engine; escape all generated values before restoring tags.
  const tags = [];
  const token = html => { tags.push(html); return `\uE000${tags.length - 1}\uE001`; };
  function encode(html) {
    const body = new DOMParser().parseFromString(DOMPurify.sanitize(html), "text/html").body;
    function walk(node) {
      if (node.nodeType === 3) return node.textContent.replace(/[\uE000\uE001]/g, "");
      if (node.nodeType !== 1) return "";
      if (node.hasAttribute("data-command")) {
        const syntax=node.getAttribute("data-command");
        if(!trace)return syntax;
        return token(`<mark class="output-source" data-source="${escapeHTML(syntax)}" title="Click to find its command">`) + syntax + token('</mark>');
      }
      if (node.hasAttribute("data-conditional")) {
        let rules=[];try{rules=JSON.parse(node.getAttribute("data-rules")||'[]');}catch{}
        return `{if: ${ruleExpression(rules,node.getAttribute("data-mode"))}}` + [...node.childNodes].map(walk).join('') + '{endif}';
      }
      const clone = node.cloneNode(false);
      const outer = clone.outerHTML;
      const open = outer.slice(0, outer.indexOf(">") + 1);
      return token(open) + [...node.childNodes].map(walk).join("") + (node.tagName === "BR" ? "" : token(`</${node.tagName.toLowerCase()}>`));
    }
    return [...body.childNodes].map(walk).join("");
  }
  const lookup = key => {
    const found = context.lookup?.(key);
    return found ? { ...found, content: found.richContent ? encode(found.richContent) : found.content } : null;
  };
  const result = expand(encode(snippet.richContent), { ...context, lookup });
  return DOMPurify.sanitize(escapeHTML(result.text).replace(/\uE000(\d+)\uE001/g, (_, index) => tags[Number(index)] || ""));
}
