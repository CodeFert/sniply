import { CalendarDays, Clipboard, TextCursor, TextCursorInput, AlignLeft, ListFilter, ToggleRight, CalendarCheck, Mouse, Keyboard, Timer, Calculator, GitBranch, Repeat2, CircleAlert, FileInput, FileText, StickyNote, Globe } from "lucide-react";
const icons = { "Date/Time": CalendarDays, Clipboard, "Place cursor": TextCursor, "Text field": TextCursorInput, "Paragraph field": AlignLeft, "Dropdown menu": ListFilter, "Toggle field": ToggleRight, "Date/Time field": CalendarCheck, "Click element": Mouse, "Key press": Keyboard, Wait: Timer, Formula: Calculator, "If/Else": GitBranch, Repeat: Repeat2, "Error Message": CircleAlert, "Import snippet": FileInput, "Snippet properties": FileText, Note: StickyNote, Website: Globe };
const colors = { Basic: "sage", Forms: "blue", Autopilot: "clay", "Dynamic logic": "violet", Miscellaneous: "sage", Reusable: "blue" };
export default function CommandIcon({ command }) {
  const Icon = icons[command.name] || FileText;
  return <span className={`command-icon ${colors[command.cat]}`}><Icon size={21} strokeWidth={1.7} aria-hidden="true" /></span>;
}
