export const COMMANDS = [
  {cat:"Reusable",name:"Reuse field",help:"Ask once, use anywhere",syntax:""},
  {cat:"Reusable",name:"Shared value",help:"Use a value from your library",syntax:""},
  { cat: "Basic", name: "Date/Time", syntax: "{time: MMMM D, YYYY}", help: "Insert date and time" },
  { cat: "Basic", name: "Clipboard", syntax: "{clipboard}", help: "Insert clipboard content" },
  { cat: "Basic", name: "Place cursor", syntax: "{cursor}", help: "Cursor location after insertion" },
  { cat: "Forms", name: "Text field", syntax: "{formtext: name=name; default=; placeholder=}", help: "Single line text field" },
  { cat: "Forms", name: "Paragraph field", syntax: "{formparagraph: name=notes}", help: "Multi line text field" },
  { cat: "Forms", name: "Dropdown menu", syntax: "{formmenu: Option 1; Option 2; name=choice}", help: "Options in a menu" },
  { cat: "Forms", name: "Toggle field", syntax: "{formtoggle: name=include; default=no}Optional text{endformtoggle}", help: "Toggle snippet sections" },
  { cat: "Forms", name: "Date/Time field", syntax: "{formdate: YYYY-MM-DD; name=when}", help: "Date/Time chooser" },
  { cat: "Autopilot", name: "Click element", syntax: "{click: selector=#submit}", help: "Click any element on any browser tab" },
  { cat: "Autopilot", name: "Key press", syntax: "{key: tab}", help: "Simulate keyboard presses" },
  { cat: "Autopilot", name: "Wait", syntax: "{wait: 1s}", help: "Pause snippet execution" },
  { cat: "Dynamic logic", name: "Formula", syntax: "{= expression}", help: "Dynamic calculation" },
  { cat: "Dynamic logic", name: "If/Else", syntax: "{if: condition}Yes{else}No{endif}", help: "Hide/show contents" },
  { cat: "Dynamic logic", name: "Repeat", syntax: "{repeat: 3}Item {= index}\n{endrepeat}", help: "Repeat multiple times" },
  { cat: "Dynamic logic", name: "Error Message", syntax: "{error: Message; block=yes}", help: "Show an error message" },
  { cat: "Miscellaneous", name: "Import snippet", syntax: "{import: /sig}", help: "Embed another snippet" },
  { cat: "Miscellaneous", name: "Snippet properties", syntax: "{snippet: shortcut}", help: "Insert snippet information" },
  { cat: "Miscellaneous", name: "Note", syntax: "{note}Not inserted{endnote}", help: "Note that is not inserted" },
  { cat: "Miscellaneous", name: "Website", syntax: "{site: domain}", help: "Insert website information" },
];

export const SEED = {
  user: { name: "Alex Rivera", email: "alex@example.com", title: "Account Lead" },
  settings: { trigger: "boundary", caseSensitive: false },
  stats: { inserts: 0, chars: 0 },
  folders: [
    { id: "f1", name: "My Sample Snippets", shared: false },
    { id: "f2", name: "Clinical", shared: true },
  ],
  snippets: [
    { id: "s1", folderId: "f1", label: "Signature", shortcut: "/sig", content: "Best,\n{user: name}\n{user: title}\n{time: MMMM D, YYYY}" },
    { id: "s2", folderId: "f1", label: "Demo - Plain text", shortcut: "/ty", content: "Thanks for the note — I’ll follow up by {time: dddd, MMMM D}.\n{cursor}" },
    { id: "s3", folderId: "f1", label: "Demo - Forms", shortcut: "/form", content: "Hi {formtext: name=name; default=Jordan},\n\nGood speaking about {formtext: name=topic; default=the proposal}. Next step: {formmenu: Send recap; Book a demo; Share pricing; name=next}.\n\n{formtoggle: name=include; default=yes}I’ll send materials by {formdate: YYYY-MM-DD; name=when}.{endformtoggle}\n\n{import: /sig}" },
    { id: "s4", folderId: "f2", label: "Additional Biopsy/PGT Costs", shortcut: "/pgt+", content: "Hello, {formtext: name=patient name; default=}\n\nI was advised you had {formtext: name=# of embryos to blastocysts; default=} embryos make it to blastocyst stage (biopsy stage). As advised in the financial agreement, the amount you previously paid covered up to 8 embryos. You currently have {= `# of embryos to blastocysts` - 8} additional embryos (over the 8).\n\nAs a reminder each embryo over 8 has an additional fee:\n\nFor the biopsy- As stated in the financial agreement, ALL embryos will be biopsied. You had {formtext: name=# of embryos to blastocysts} embryos, since 8 is covered in your cost, you will have cost for the {= greaterthan8} additional embryos biopsied.\n\n$150 x {= greaterthan8} = $ {= 150 * greaterthan8}\n\n{formtoggle: name=ICSI used?; default=no}I also wanted to advise ICSI was used for the insemination process. This additional cost is $600, and will be due prior to your transfer as well.{endformtoggle}" },
    { id: "s5", folderId: "f2", label: "PGT with some growing", shortcut: "/pgtgrow", content: "Hello,\nYou currently have {formtext: name=#embryos; default=} embryos that made it to blastocyst stage, and {formtext: name=#extraembryos; default=} still growing. Since you have more than average, we wanted to review your biopsy/testing options and possible costs.\n\nYou have 3 options:\n\nOption 1: Stop Biopsing Embryos, and send a Limited Number\n\nYour payment covers a set number of embryos for biopsy and PGT-A testing. If more than that were biopsied already, additional biopsy fees will apply. The remaining embryos will be frozen, and you can choose to test them later.\n\nOption 2: Biopsy All, Test a Limited Number\n\nAll embryos will be biopsied, but you’ll only send a select number for PGT-A now. Biopsy fees apply for embryos beyond what’s covered.\n\nOption 3: Biopsy and Test All Embryos\n\nAll embryos will be biopsied and sent for PGT-A testing. Additional biopsy and testing fees apply beyond what’s covered in your original payment." },
  ],
};

export function loadDb() {
  try { return JSON.parse(localStorage.getItem("tb-pro")) || structuredClone(SEED); }
  catch { return structuredClone(SEED); }
}
