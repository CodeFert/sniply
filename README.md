# Sniply

Local snippet editor and Chrome extension with rich text, reusable fields, visual rules, shared values, live preview, history and saved tests. No AI writing service is used.

## Start

- Install dependencies: `npm install`
- Run the development app: `npm run dev`
- Build the standalone app: `npm run build`
- Build the extension, including its dashboard: `npm run build:extension`
- Run the automated checks: `npm test`

## Explore the new workspace

Click **Try an example** in the header. The sample quote uses a name twice, multiplies quantity by a shared price, and shows a formatted section when quantity is at least five.

- **Preview:** change sample answers beside the editor. Click highlighted generated text or conditional sections to see an explanation and locate the source. Sample page titles, selections and mapped values are available under Sample page context. Copy the finished text or save an example as a test.
- **Move and reuse commands:** drag a chip to a new position, or drag a conditional section by its header. Right-click for Edit, Copy or Delete. Paste copied commands into the editor; Undo restores moves and deletions. Shift+F10 opens the same menu from a focused chip.
- **Commands:** search and insert configured commands. Formula operands can be named fields or numbers. Date formats show real examples, and relative presets include tomorrow, next Monday, next business day (weekends excluded), and next month.
- **Fields:** define a field once, then insert references to it. Editing its original definition changes the prompt used for its references.
- **Show selected paragraphs when…:** select formatted paragraphs, choose one or more conditions, and choose All or Any. The section remains editable in place.
- **Shared values:** maintain prices, addresses and standard wording. The editor lists affected snippets before you apply a change. “Shared” means reused within this local library, not cloud collaboration.
- **Health:** review conflicting shortcuts, missing references, circular imports, conflicting field definitions and incomplete commands. Shortcut fixes assign a unique name.
- **History:** automatic checkpoints are retained locally (up to 50 per snippet). Save named versions, compare them and restore one. Restoration first saves the current version. It does not roll back shared values or tests.
- **Tests:** save example inputs with their expected text and formatting. Run tests again after changes; dates use the saved test timestamp. Inspect changed output before accepting a new expected result.
- **Variations:** create named alternate wording under one shortcut. Each variation retains its own rich text and fields. Changing a shortcut in the editor updates the group.
- **Settings:** set a test website, select a folder for suggestions, choose library and per-snippet triggers, allowed/blocked domains, global exclusions, path prefixes, defaults linked to Shared values, and export/import library backups. Archived snippets can be restored here.

## Chrome extension

1. Build the extension or unzip the supplied extension package.
2. In Chrome, open `chrome://extensions`, enable Developer mode, and use **Load unpacked** to select the extension folder containing `manifest.json`.
3. Click the Sniply extension icon to open its dashboard.
4. In the standalone dashboard, export the library from Settings; import it in the extension dashboard. They use separate storage and do not automatically sync.
5. On a permitted website, type a shortcut in a text field or rich editor. Or press **Alt + /** while editing to see website-filtered suggestions, then select a folder or search.

The extension uses the same field, shared-value and conditional engine as the standalone app. It inserts plain text into ordinary text fields and formatted output into editable HTML. It asks for required field values, honors website rules, and supports clipboard reads when permitted. Click and wait actions execute only during extension insertion; the dashboard preview does not execute them. Synthetic key automation is not implemented. Chrome-protected pages do not allow content scripts.

## Prepare, preview and insert

- Field snippets open a compact popover beside the destination with live formatted output. Required inputs block insertion until completed. Change answers to update conditional sections. Tab navigates controls; Escape cancels without removing your shortcut. If the destination changes while you prepare, insertion stops so your text is not overwritten.
- Settings offers immediate, Space, Tab or Enter expansion. A delimiter confirms insertion and is consumed. Existing libraries retain immediate expansion. Website exclusions override allowed domains. Paths are literal prefixes, not wildcard patterns.
- Shared-value defaults are linked in Settings. They are starting values; answers remain editable, including clearing an optional default.
- Variations use an arrow-key chooser when their shortcut is typed. Alt + / can select a specific variation directly.
- In Alt + /, **Save selection / clipboard** captures literal text as a new snippet after you provide a name and shortcut. Clipboard reads happen only when requested. If browser clipboard access fails during expansion, you can paste the intended text manually.
- The Website command includes **Selected text**. Select text in the destination before opening Alt + /; the selection is captured before the popover takes focus.
- **Remember a page value** in Alt + / lets you click an element and give it a name. The element location and exact domain are saved; its captured value is not stored. Choose the named value in the Website command. Every insertion previews its current value; missing, empty or ambiguous mappings block insertion. Page redesigns may require remapping. This does not fill multiple webpage fields.
- The extension dashboard receives library changes made by quick capture or page mapping. The standalone app still uses a separate library; transfer it with export/import.

## Reviewed imports

Settings accepts Sniply JSON backups and CSV files with `label`, `shortcut`, `content` columns and an optional `folder` column. Quoted commas, quotes and multiline content are supported. Review before importing; either skip duplicates or create copies with unique shortcuts. Existing snippets and shared values are preserved. Imported copies keep embedded snippet references, which should be reviewed when shortcuts change.

CSV content is imported as literal text. Foreign commands are flagged for manual conversion, never executed as Sniply commands automatically. Native Espanso YAML and TextExpander files are not supported yet; export CSV first. Cloud synchronization, automatic multi-field filling, passive clipboard history, analytics and AI remain deferred.

## Validation and limits

Automated checks cover the editor’s DOM behavior, persistence, conditional output, shared calculations, library health, history, deterministic tests, and extension insertion/suggestions in a simulated DOM. The unpacked extension still needs a real Chrome smoke test on the websites you intend to use. Data stays in browser/extension local storage; export backups to retain a separate copy. The test suite is functional verification, not a compliance certification.
