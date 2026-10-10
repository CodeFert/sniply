/* Text Blaze-compatible snippet engine. */
const BLOCKS = new Set(["if", "formtoggle", "link", "note", "repeat", "button"]);

export function parseSettings(raw) {
  const positional = [];
  const named = {};
  if (!raw || !String(raw).trim()) return { positional, named, raw: raw || "" };
  for (const part of splitSemi(raw)) {
    const eq = findEq(part);
    if (eq === -1) positional.push(unescape(part.trim()));
    else named[part.slice(0, eq).trim()] = unescape(part.slice(eq + 1).trim());
  }
  return { positional, named, raw };
}

function splitSemi(s) {
  const out = [];
  let cur = "", depth = 0, quote = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\" && i + 1 < s.length) { cur += c + s[++i]; continue; }
    if (quote) { cur += c; if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; cur += c; continue; }
    if (c === "{") depth++;
    if (c === "}") depth = Math.max(0, depth - 1);
    if (c === ";" && depth === 0) { out.push(cur); cur = ""; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur);
  return out;
}
function findEq(s) {
  let depth = 0, quote = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\" && i + 1 < s.length) { i++; continue; }
    if (quote) { if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === "{") depth++;
    if (c === "}") depth = Math.max(0, depth - 1);
    if (c === "=" && depth === 0) return i;
  }
  return -1;
}
function unescape(s) { return String(s).replace(/\\([{}=;"'\\\s])/g, "$1"); }

export function parse(src) {
  let i = 0;
  const s = String(src || "");
  function nodes(stop) {
    const list = [];
    let text = "";
    const flush = () => { if (text) list.push({ t: "text", v: text }); text = ""; };
    while (i < s.length) {
      if (s[i] === "\\" && "{}=;\\".includes(s[i + 1] || "")) { text += s[i + 1]; i += 2; continue; }
      if (s[i] !== "{") { text += s[i++]; continue; }
      const start = i;
      const cmd = read();
      if (!cmd) { text += "{"; i = start + 1; continue; }
      if (stop && stop.has(cmd.name)) { flush(); return { list, closer: cmd }; }
      flush();
      if (cmd.name === "if") {
        const branches = [];
        let closer = cmd;
        while (closer && closer.name !== "endif") {
          const inner = nodes(new Set(["else", "elseif", "endif"]));
          branches.push({ cond: closer, body: inner.list });
          closer = inner.closer;
          if (!closer) break;
          if (closer.name === "endif") break;
        }
        list.push({ t: "if", branches });
      } else if (BLOCKS.has(cmd.name)) {
        const inner = nodes(new Set(["end" + cmd.name]));
        list.push({ t: "block", name: cmd.name, settings: cmd.settings, body: inner.list });
      } else list.push({ t: "cmd", name: cmd.name, settings: cmd.settings });
    }
    flush();
    return { list, closer: null };
  }
  function read() {
    if (s[i] !== "{") return null;
    const start = i++;
    let name = "";
    while (i < s.length && /[a-zA-Z_=]/.test(s[i])) name += s[i++];
    if (!name) { i = start; return null; }
    let raw = "";
    const isAssign = name !== "=" && name.endsWith("=") && s[i] !== ":";
    if (name === "=" && s[i] !== "}") raw = readBody();
    else if (isAssign) { raw = readBody(); name = name.slice(0, -1); return finish(name, raw, true); }
    else if (s[i] === ":") { i++; raw = readBody(); }
    if (s[i] !== "}") { i = start; return null; }
    i++;
    return { name: name.toLowerCase(), settings: parseSettings(raw), assign: false };
    function readBody() {
      let out = "", depth = 1, quote = null;
      while (i < s.length && depth > 0) {
        const c = s[i];
        if (c === "\\" && i + 1 < s.length) { out += c + s[i + 1]; i += 2; continue; }
        if (quote) { out += c; if (c === quote) quote = null; i++; continue; }
        if (c === '"' || c === "'") quote = c;
        if (c === "{") depth++;
        if (c === "}") { depth--; if (depth === 0) break; }
        out += c; i++;
      }
      return out;
    }
    function finish(n, r, assign) {
      if (s[i] !== "}") { i = start; return null; }
      i++;
      return { name: n.toLowerCase(), settings: parseSettings(r), assign };
    }
  }
  return nodes(null).list;
}

export function fieldsFor(template) {
  return collect(parse(template), []);
}
function collect(nodes, acc) {
  for (const n of nodes) {
    if (n.t === "cmd") fieldFrom(n.name, n.settings, acc);
    if (n.t === "block") { fieldFrom(n.name, n.settings, acc); collect(n.body, acc); }
    if (n.t === "if") n.branches.forEach((b) => collect(b.body, acc));
  }
  return acc;
}
function fieldFrom(name, set, acc) {
  const kinds = ["formtext", "formparagraph", "formmenu", "formdate", "formtoggle"];
  if (!kinds.includes(name)) return;
  const id = set.named.name || auto(name, acc.length);
  if (acc.some((f) => f.name === id)) return;
  const field = {
    name: id, kind: name, label: set.named.label || human(id),
    default: set.named.default ?? "", placeholder: set.named.placeholder || "",
    required: /^(yes|true|1)$/i.test(set.named.required || ""),
    cols: Math.max(5, Math.min(100, Number(set.named.cols) || 30)),
    rows: Math.max(2, Math.min(20, Number(set.named.rows) || 4)),
    options: [], multiple: /^(yes|true|1)$/i.test(set.named.multiple || ""),
    format: set.positional[0] || set.named.format || "YYYY-MM-DD",
  };
  if (name === "formmenu") {
    field.options = set.positional.length ? set.positional : String(set.named.options || "").split("|").map((x) => x.trim()).filter(Boolean);
    if (set.named.default === undefined && field.options[0]) field.default = field.options[0];
  }
  if (name === "formtoggle") field.default = /^(yes|true|1|on)$/i.test(String(field.default)) ? "yes" : "no";
  if (name === "formdate" && !field.default) field.default = formatTime(new Date(), "YYYY-MM-DD");
  acc.push(field);
}
function auto(kind, n) { return kind.replace("form", "") + (n + 1); }
function human(s) { return String(s).replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase()); }

export function expand(template, ctx) {
  const state = { ...ctx, vars: { ...(ctx.vars || {}) }, errors: [], actions: [] };
  const result = render(parse(template), state);
  return { ...result, errors: state.errors, actions: state.actions };
}

function render(nodes, ctx) {
  let out = "", cursor = null;
  const keys = [];
  for (const n of nodes) {
    if (n.t === "text") { out += n.v; continue; }
    if (n.t === "if") {
      for (const b of n.branches) {
        const take = b.cond.name === "else" || truthy(evalMaybe(b.cond.settings.raw, ctx));
        if (!take) continue;
        const r = render(b.body, ctx);
        const base = out.length;
        out += r.text;
        if (cursor == null && r.cursor != null) cursor = base + r.cursor;
        keys.push(...r.keys);
        break;
      }
      continue;
    }
    if (n.t === "block") {
      if (n.name === "note") continue;
      if (n.name === "formtoggle") {
        const id = n.settings.named.name || "";
        if (!truthy(ctx.fields[id])) continue;
        const r = render(n.body, ctx);
        const base = out.length; out += r.text;
        if (cursor == null && r.cursor != null) cursor = base + r.cursor;
        keys.push(...r.keys);
        continue;
      }
      if (n.name === "link") {
        const url = resolve(n.settings.positional[0] || n.settings.named.url || "", ctx);
        const r = render(n.body, ctx);
        out += url ? `${r.text} (${url})` : r.text;
        keys.push(...r.keys);
        continue;
      }
      if (n.name === "repeat") {
        const count = Number(evalMaybe(n.settings.positional[0] || n.settings.named.count || n.settings.named.for || "1", ctx)) || 0;
        for (let k = 1; k <= Math.max(0, Math.min(100, count)); k++) {
          ctx.vars.index = k;
          const r = render(n.body, ctx);
          out += r.text; keys.push(...r.keys);
        }
        continue;
      }
      if (n.name === "button") {
        const r = render(n.body, ctx);
        out += `[${r.text || n.settings.named.label || "Button"}]`;
        continue;
      }
    }
    if (n.t === "cmd") {
      const piece = evalCmd(n, ctx);
      if (piece && piece.cursor) { if (cursor == null) cursor = out.length; }
      else if (piece && piece.key) keys.push(piece.key);
      else if (piece && piece.error) { ctx.errors.push(piece.error); if (piece.block) out += ""; else out += `[error: ${piece.error}]`; }
      else if (piece && piece.action) ctx.actions.push(piece.action);
      else out += piece == null ? "" : String(piece);
    }
  }
  return { text: tidy(out), cursor, keys };
}
function tidy(s) { return s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n"); }

function evalCmd(n, ctx) {
  const set = n.settings;
  if (n.assign || (n.name && set.raw && !["formtext","formparagraph","formmenu","formdate","formtoggle","time","site","if"].includes(n.name) && n.name !== "=" && !set.positional.length && findEq(set.raw) === -1 && ctx.vars)) {
    /* assignment handled below */
  }
  if (n.assign) { ctx.vars[n.name] = evalMaybe(set.raw, ctx); return set.named.trim === "yes" ? "" : ""; }
  if (n.name === "=") return formatNumber(evalMaybe(set.positional[0] || set.raw, ctx), set.named.format);
  if (n.name === "time") return formatTime(shiftDate(new Date(ctx.now || Date.now()), set), set.positional[0] || "MMMM D, YYYY");
  if (["formtext", "formparagraph", "formmenu", "formdate"].includes(n.name)) {
    const id = set.named.name || Object.keys(ctx.fields)[0] || "";
    const v = ctx.fields[id];
    return v == null || v === "" ? set.named.default || "" : Array.isArray(v) ? v.join(", ") : nameDate(v, n.name, set);
  }
  if (n.name === "site") {
    const p = (set.positional[0] || "url").toLowerCase();
    const site = ctx.site || {};
    return site[p] || (p === "domain" ? site.domain : site.url) || "";
  }
  if (n.name === "field") return ctx.fields?.[set.positional[0]] ?? "";
  if (n.name === "value") return ctx.values?.[set.positional[0]] ?? "";
  if (n.name === "user") return ctx.user?.[set.positional[0] || "name"] || "";
  if (n.name === "snippet") return ctx.snippet?.[(set.positional[0] || "shortcut").toLowerCase()] || "";
  if (n.name === "clipboard") return ctx.clipboard || "";
  if (n.name === "cursor") return { cursor: true };
  if (n.name === "key") return { key: (set.positional[0] || set.named.key || "enter").toLowerCase(), action: { type: "key", key: set.positional[0] || "enter" } };
  if (n.name === "click") { ctx.actions.push({ type: "click", selector: set.positional[0] || set.named.selector || "" }); return ""; }
  if (n.name === "wait") { ctx.actions.push({ type: "wait", delay: set.positional[0] || set.named.delay || "0" }); return ""; }
  if (n.name === "error") return { error: set.positional.join(" ") || set.named.message || "Invalid", block: /^(yes|true)$/i.test(set.named.block || "") };
  if (n.name === "import") {
    const key = set.positional[0] || "";
    const sn = (ctx.lookup || (() => null))(key);
    if (!sn || (ctx.depth || 0) > 8) return "";
    return expand(sn.content, { ...ctx, depth: (ctx.depth || 0) + 1, snippet: sn }).text;
  }
  return "";
}
function nameDate(value, kind, settings) {
  if (kind === "formdate" && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) return formatTime(new Date(String(value) + "T12:00:00"), settings.positional[0] || "YYYY-MM-DD");
  return String(value);
}
function resolve(raw, ctx) { return raw.includes("{") ? expand(raw, { ...ctx, depth: (ctx.depth || 0) + 1 }).text : raw; }
function evalMaybe(src, ctx) {
  const text = String(src || "").trim();
  if (!text) return "";
  if (text.includes("{")) return evalFormula(expand(text, { ...ctx, depth: (ctx.depth || 0) + 1 }).text, ctx);
  if (ctx.fields && Object.prototype.hasOwnProperty.call(ctx.fields, text)) return coerce(ctx.fields[text]);
  if (ctx.vars && Object.prototype.hasOwnProperty.call(ctx.vars, text)) return ctx.vars[text];
  try { return evalFormula(text, ctx); } catch { return text; }
}
function truthy(v) { if (v === false || v == null) return false; const s = String(v).trim().toLowerCase(); return !(s === "" || s === "0" || s === "false" || s === "no" || s === "off"); }
function shiftDate(d, set) {
  const shift = set.named.shift || set.named.at || "";
  if (set.named.preset) {
    const x = new Date(d); const p = set.named.preset;
    if (p === "tomorrow") x.setDate(x.getDate()+1);
    if (p === "business") { do { x.setDate(x.getDate()+1); } while ([0,6].includes(x.getDay())); }
    if (p === "monday") x.setDate(x.getDate()+((8-x.getDay())%7 || 7));
    if (p === "month") x.setMonth(x.getMonth()+1,1);
    return x;
  }
  if (!shift) return d;
  const m = String(shift).match(/([+-]?\d+)\s*(day|days|week|weeks|month|months|year|years|hour|hours|minute|minutes)/i);
  if (!m) return d;
  const n = Number(m[1]), x = new Date(d), u = m[2].toLowerCase();
  if (u.startsWith("day")) x.setDate(x.getDate() + n);
  else if (u.startsWith("week")) x.setDate(x.getDate() + n * 7);
  else if (u.startsWith("month")) x.setMonth(x.getMonth() + n);
  else if (u.startsWith("year")) x.setFullYear(x.getFullYear() + n);
  else if (u.startsWith("hour")) x.setHours(x.getHours() + n);
  else if (u.startsWith("minute")) x.setMinutes(x.getMinutes() + n);
  return x;
}
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
export function formatTime(d, fmt) {
  const pad = (n) => String(n).padStart(2, "0");
  const h24 = d.getHours(), h12 = h24 % 12 || 12;
  const map = { YYYY: d.getFullYear(), YY: String(d.getFullYear()).slice(2), MMMM: MONTHS[d.getMonth()], MMM: MONTHS[d.getMonth()].slice(0,3), MM: pad(d.getMonth()+1), M: d.getMonth()+1, DDDD: DAYS[d.getDay()], DDD: DAYS[d.getDay()].slice(0,3), DD: pad(d.getDate()), D: d.getDate(), HH: pad(h24), H: h24, hh: pad(h12), h: h12, mm: pad(d.getMinutes()), ss: pad(d.getSeconds()), A: h24>=12?"PM":"AM", a: h24>=12?"pm":"am" };
  const keys = Object.keys(map).sort((a,b)=>b.length-a.length);
  let out = "";
  for (let i = 0; i < fmt.length;) {
    const slice = fmt.slice(i);
    const hit = keys.find((k) => slice.toUpperCase().startsWith(k) && fmt.slice(i, i+k.length).toUpperCase() === k);
    if (hit) { out += map[hit]; i += hit.length; } else out += fmt[i++];
  }
  return out;
}
function formatNumber(v, fmt) {
  if (!fmt || typeof v !== "number") return v ?? "";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  if (fmt.includes("$")) return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: fmt.includes(".0") ? 0 : 2 });
  if (fmt.includes("%")) return (n * (fmt.includes("%%") ? 100 : 1)).toLocaleString() + "%";
  const m = fmt.match(/\.(\d+)f/);
  const digits = m ? Number(m[1]) : fmt.includes(",") ? 2 : 0;
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits || 2, useGrouping: fmt.includes(",") });
}
function evalFormula(src, ctx) {
  const tokens = tokenize(String(src));
  let p = 0;
  const peek = () => tokens[p];
  const eat = (k) => peek() && peek().k === k ? tokens[p++] : null;
  function or() { let v = and(); while (peek()?.k === "or") { p++; const r = and(); v = truthy(v) || truthy(r); } return v; }
  function and() { let v = not(); while (peek()?.k === "and") { p++; const r = not(); v = truthy(v) && truthy(r); } return v; }
  function not() { if (peek()?.k === "not") { p++; return !truthy(not()); } return cmp(); }
  function cmp() {
    let v = add();
    if (peek() && ["==","!=",">=","<=",">","<"].includes(peek().k)) {
      const op = tokens[p++].k, r = add();
      if (op === "==") return String(v) === String(r) || (String(v).trim() !== "" && String(r).trim() !== "" && Number.isFinite(Number(v)) && Number.isFinite(Number(r)) && Number(v) === Number(r));
      if (op === "!=") return String(v) !== String(r);
      if (op === ">") return num(v) > num(r);
      if (op === "<") return num(v) < num(r);
      if (op === ">=") return num(v) >= num(r);
      if (op === "<=") return num(v) <= num(r);
    }
    return v;
  }
  function add() { let v = mul(); while (peek() && ["+","-","&"].includes(peek().k)) { const op = tokens[p++].k, r = mul(); v = op === "&" ? String(v??"")+String(r??"") : op === "+" ? num(v)+num(r) : num(v)-num(r); } return v; }
  function mul() { let v = unary(); while (peek() && ["*","/","%"].includes(peek().k)) { const op = tokens[p++].k, r = unary(); if ((op === "/" || op === "%") && num(r) === 0) ctx.errors?.push("Cannot divide by zero."); v = op === "*" ? num(v)*num(r) : op === "/" ? (num(r)?num(v)/num(r):0) : num(v)%num(r); } return v; }
  function unary() { if (peek()?.k === "-") { p++; return -num(unary()); } return primary(); }
  function primary() {
    const t = peek(); if (!t) return "";
    if (t.k === "num") { p++; return t.v; }
    if (t.k === "str") { p++; return t.v; }
    if (t.k === "(") { p++; const v = or(); eat(")"); return v; }
    if (t.k === "id") {
      p++;
      if (peek()?.k === "(") {
        p++; const args = [];
        if (!eat(")")) { args.push(or()); while (eat(",")) args.push(or()); eat(")"); }
        return call(t.v, args);
      }
      return ident(t.v, ctx);
    }
    p++; return "";
  }
  const val = or();
  return typeof val === "number" && !Number.isInteger(val) ? Math.round(val * 1000) / 1000 : val;
}
function call(name, args) {
  const f = name.toLowerCase(), a = args[0];
  if (f === "upper") return String(a??"").toUpperCase();
  if (f === "lower") return String(a??"").toLowerCase();
  if (f === "trim") return String(a??"").trim();
  if (f === "len" || f === "length") return String(a??"").length;
  if (f === "round") return Math.round(num(a));
  if (f === "abs") return Math.abs(num(a));
  if (f === "sqrt") return Math.sqrt(num(a));
  if (f === "log") return Math.log10(num(a));
  if (f === "contains") return String(a??"").toLowerCase().includes(String(args[1]??"").toLowerCase());
  if (f === "left") return String(a??"").slice(0, num(args[1]));
  if (f === "right") return String(a??"").slice(-num(args[1]));
  if (f === "replace") return String(a??"").split(String(args[1]??"")).join(String(args[2]??""));
  if (f === "if") return truthy(a) ? args[1] : args[2];
  return "";
}
function ident(name, ctx) {
  if (ctx.fields && Object.prototype.hasOwnProperty.call(ctx.fields, name)) return coerce(ctx.fields[name]);
  if (ctx.vars && Object.prototype.hasOwnProperty.call(ctx.vars, name)) return ctx.vars[name];
  const low = name.toLowerCase();
  if (low === "true" || low === "yes") return true;
  if (low === "false" || low === "no") return false;
  return name;
}
function coerce(v) { return typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : v; }
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function tokenize(s) {
  const out = []; let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '"' || c === "'") { const q = c; let v = ""; i++; while (i < s.length && s[i] !== q) { if (s[i] === "\\" && i+1 < s.length) { v += s[++i]; i++; continue; } v += s[i++]; } i++; out.push({ k: "str", v }); continue; }
    if (c === "`") { let v = ""; i++; while (i < s.length && s[i] !== "`") v += s[i++]; i++; out.push({k:"id",v}); continue; }
    if (/[0-9.]/.test(c)) { let v = ""; while (i < s.length && /[0-9.]/.test(s[i])) v += s[i++]; out.push({ k: "num", v: Number(v) }); continue; }
    const two = s.slice(i, i+2);
    if (["==","!=",">=","<=","&&","||"].includes(two)) { out.push({ k: two === "&&" ? "and" : two === "||" ? "or" : two }); i += 2; continue; }
    if ("+-*/%()<>=,".includes(c)) { out.push({ k: c === "=" ? "==" : c }); i++; continue; }
    if (/[A-Za-z_]/.test(c)) { let v = ""; while (i < s.length && /[A-Za-z0-9_]/.test(s[i])) v += s[i++]; const low = v.toLowerCase(); out.push(low === "and" || low === "or" || low === "not" ? { k: low } : { k: "id", v }); continue; }
    i++;
  }
  return out;
}

export function matchShortcut(before, snippets) {
  const sorted = [...snippets].sort((a, b) => (b.shortcut||"").length - (a.shortcut||"").length);
  for (const sn of sorted) {
    const sc = sn.shortcut || "";
    if (!sc || !before.toLowerCase().endsWith(sc.toLowerCase())) continue;
    const idx = before.length - sc.length;
    const prev = idx === 0 ? "" : before[idx - 1];
    if (idx === 0 || /[\s([{\n]/.test(prev) || "/;\\.#".includes(sc[0])) return { snippet: sn, shortcut: sc };
  }
  return null;
}
