# Resume Tailor: Prototype Implementation Plan

## 1. Summary

A frontend-only web app where a user keeps one **master resume** (all their bullets, jobs, skills) and creates named **variants** that show only a selected subset. Variants are exported as ATS-friendly PDFs. Nothing is stored on a server or in the browser. Users save and reopen their work as a backup file.

**Prototype goals**

- Works with no account, no database, no backend.
- Two views: **Edit** (plain structured text editing) and **Tailor** (toggle what shows).
- Live preview in a single ATS-safe template.
- PDF export.
- Save/open backup file (JSON inside, never called "JSON" in the UI).
- Warn on tab close when there are unsaved changes.

**Non-goals for the prototype**

- Accounts, sync, hosting any user data.
- localStorage / IndexedDB persistence (strictly ephemeral by decision).
- Multiple templates, template designer, AI features, DOCX export.

---

## 2. Tech Stack

| Concern | Choice | Notes |
|---|---|---|
| Build | Vite | Static output, Vercel auto-detects it |
| UI | React + TypeScript | Best AI-assist reliability |
| State | Zustand | One store holding the whole file |
| Styling | Tailwind CSS (+ optional shadcn/ui) | Fast, clean defaults |
| Drag reorder | dnd-kit | Bullets within an item; items within a section |
| Validation | Zod | Validates opened backup files |
| IDs | `nanoid` | Stable ids for every node |
| PDF (v1) | Browser print with print CSS | Same HTML for preview and export |
| PDF (later) | `@react-pdf/renderer` | Only if one-click download is wanted |
| Hosting | Vercel, static | No server functions needed |

---

## 3. Data Model

The master resume is structured data. A variant is only a set of visibility choices over it, so it never copies text. Fixing a typo in the master updates every variant.

```ts
// Top-level file == in-memory store state == backup file contents
interface ResumeFile {
  app: "resume-tailor";
  version: 1;                 // bump + migrate when schema changes
  master: Master;
  variants: Variant[];
  activeVariantId: string;
}

interface Master {
  profile: Profile;
  sections: Section[];        // order here = order on the resume
}

interface Profile {
  name: string;
  email: string;
  phone?: string;
  location?: string;
  links: { id: string; label: string; url: string }[];
}

type SectionType =
  | "summary" | "experience" | "projects"
  | "education" | "skills" | "custom";

interface Section {
  id: string;
  type: SectionType;
  title: string;              // standard headings by default: "Experience", etc.
  items: Item[];
}

// Generic enough to cover a job, project, degree, or skill group
interface Item {
  id: string;
  heading: string;            // company / project / school / skill category
  subheading?: string;        // title / degree
  location?: string;
  dateStart?: string;         // "2022-03" (rendered as "Mar 2022")
  dateEnd?: string;           // "2024-06" or "Present"
  bullets: Bullet[];
}

interface Bullet {
  id: string;
  text: string;
  tags: string[];             // "frontend", "backend", "leadership"
}

interface Variant {
  id: string;
  name: string;               // "Frontend - Stripe"
  excluded: string[];         // ids of bullets/items/sections that are hidden
  maxBulletsPerItem?: number; // optional soft cap used by the Tailor view
}
```

**Design notes**

- **Skills** use the same `Item`/`Bullet` shape: one item per category ("Languages"), one bullet per skill, rendered as a comma-joined line. This makes every individual skill toggleable with no extra code.
- **Summary** is a section with one item and one bullet. It gets toggle treatment like everything else, and users can add several summary bullets and pick one per variant.
- **`excluded` rather than `included`**: new content appears by default in existing variants. If this feels wrong in testing, flipping it is a small change.
- **Visibility rules**: hiding an item hides its bullets. A section with nothing visible does not render its heading.
- **Tag filtering is not stored.** It is a UI helper that sets `excluded` in bulk, and the user can adjust afterward.

### Derived selector

One pure function is the heart of the app and is used by the preview, the PDF, and the counts:

```ts
getVisibleResume(file: ResumeFile, variantId: string): ResolvedResume
```

It returns the master with excluded nodes stripped. Unit test this first.

---

## 4. Backup File (the "no JSON" JSON)

**UI wording:** "Save backup" / "Open backup". Never mention JSON.

- **Extension:** `.resume` (contents are JSON, MIME `application/json`). Accept `.json` on open too.
- **Save:**
  - Use the File System Access API where available (Chrome/Edge) so repeat saves overwrite the same file.
  - Fall back to a Blob download elsewhere (Safari/Firefox).
  - Suggested filename: `firstname-lastname-resume.resume`.
  - On success, set `dirty = false`.
- **Open:**
  - Button plus drag-and-drop anywhere on the page.
  - Parse, validate with Zod, then run `migrate(file)` if `version` is older.
  - On failure, show a friendly message ("This doesn't look like a Resume Tailor backup file"), never a stack trace.
  - If `dirty`, confirm first: "Replace what's here? You have unsaved changes."
- **Everything in one file:** master plus all variants.

---

## 5. App State and Dirty Tracking

Zustand store:

```ts
{
  file: ResumeFile,
  mode: "edit" | "tailor",
  dirty: boolean,
  fileHandle?: FileSystemFileHandle,   // for overwrite-in-place saves
  // actions: updateProfile, addItem, updateBullet, reorder, toggle(id),
  //          applyTag(tag), createVariant, duplicateVariant, renameVariant,
  //          deleteVariant, loadFile, loadSample, reset
}
```

- Every mutating action sets `dirty = true`.
- Successful save sets `dirty = false`.
- **PDF export does not clear `dirty`** (a PDF can't be reopened for editing).
- Register `beforeunload` only while `dirty` is true:

```ts
useEffect(() => {
  if (!dirty) return;
  const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
  window.addEventListener("beforeunload", handler);
  return () => window.removeEventListener("beforeunload", handler);
}, [dirty]);
```

Browser dialog text can't be customized. The in-app cues below do the real work.

---

## 6. UI Layout

One screen, split pane, light mode only.

**Top bar**
- App name (left)
- Variant dropdown with "New variant" and "Duplicate"
- **Edit | Tailor** segmented toggle
- Right side: dirty indicator ("Unsaved changes" / "All changes saved"), **Open backup**, **Save backup**, **Export PDF**

**Left pane (view-dependent)**
- **Edit view:** simple forms. Profile fields, then sections with collapsible items, bullets as single/multi-line text inputs, tag input per bullet, add/delete/drag-reorder everywhere. No formatting controls.
- **Tailor view:** read-mostly outline of the same content.
  - Checkbox beside every section, item, and bullet.
  - Tag chips across the top: clicking "backend" selects all bullets with that tag and deselects the rest (with a "Add to selection" modifier or secondary chip behavior, decided during build).
  - Per item: "3 of 10 shown" counter.
  - Optional "Max bullets per job" control that applies a cap, preferring the top-ordered bullets.
  - Drag to reorder bullets (reorders in the master, noted in UI).

**Right pane**
- White US Letter page on a light gray background, scaled to fit.
- On narrow screens, collapse into a **Preview** tab alongside Edit/Tailor.

**Empty state (first load)**
- One line: "Nothing is stored. Your resume lives only in this tab until you save a backup file."
- Buttons: **Start from scratch**, **Try with a sample resume**, **Open backup**.

**Nudges**
- After PDF export: "Want to save a backup so you can tweak this later?" with a Save button.

**Style:** Inter or system font, one accent color, generous whitespace, no dark mode yet.

---

## 7. ATS-Safe Template Spec

Single fixed template rendered as semantic HTML, used for both preview and print.

- Single column, no tables, no icons, no images, no text boxes.
- Standard headings: Summary, Experience, Projects, Education, Skills.
- Name as `h1`, section titles as `h2`, simple `ul/li` bullets.
- One standard font stack (e.g. Arial/Helvetica/Calibri-like fallback), 10-11pt body.
- Consistent date format ("Mar 2022 - Jun 2024"), right-aligned via flex, not tables.
- Contact line: email, phone, location, links as plain text URLs (clickable but visible).
- Margins around 0.5-0.75 in.
- Output must be a **text-based PDF** (selectable text). Browser print-to-PDF satisfies this.

---

## 8. PDF Export (print CSS route)

1. Preview is a `<ResumePage />` component rendering `getVisibleResume(...)`.
2. `@media print`:
   - Hide everything except the resume (`body > *:not(#print-root) { display: none }`, or render resume into a dedicated print root).
   - `@page { size: Letter; margin: 0.5in; }`
   - Remove preview scaling, shadows, and gray background.
   - Use `break-inside: avoid` on items and bullets to prevent ugly splits.
3. **Export PDF** button calls `window.print()`. A small hint under the button: "Choose 'Save as PDF' and set margins to Default."
4. Set `document.title` to e.g. `Jane-Doe-Resume` just before printing so the default filename is sensible, then restore it.

**One-page indicator (heuristic first):** measure the preview container's rendered height against one Letter page's pixel height and show "Fits on 1 page" / "Spills onto page 2". This is a DOM measurement, not a prediction, so it is reliable enough for v1. Do not build a fancy auto-fit.

**Known tradeoff:** the user goes through the browser print dialog, and results vary slightly by browser. If that hurts in testing, swap the export to `@react-pdf/renderer` later. The template is simple and the data model is unchanged, so the swap is contained.

---

## 9. Suggested File Structure

```
src/
  main.tsx
  App.tsx
  store/
    useResumeStore.ts
    selectors.ts            // getVisibleResume, counts
  schema/
    resumeFile.ts           // zod schemas + types
    migrate.ts              // version migrations
    sample.ts               // sample resume data
  lib/
    fileIO.ts               // save/open, File System Access + fallback
    dates.ts
  components/
    TopBar.tsx
    EditView/
      EditView.tsx
      ProfileForm.tsx
      SectionEditor.tsx
      ItemEditor.tsx
      BulletRow.tsx
    TailorView/
      TailorView.tsx
      TagFilterBar.tsx
      TailorItem.tsx
    Preview/
      ResumePage.tsx        // the single ATS template
      PreviewPane.tsx
      print.css
    common/
      EmptyState.tsx
      ConfirmDialog.tsx
      DropZone.tsx
```

---

## 10. Build Order

Each milestone is shippable and testable on its own.

**M0: Scaffold**
- Vite + React + TS + Tailwind, deploy to Vercel to confirm the pipeline.

**M1: Schema, store, selector**
- Zod schemas, types, `sample.ts`, Zustand store with `dirty`.
- `getVisibleResume` with unit tests (Vitest): excluded bullet, excluded item, empty section, empty variant.

**M2: Preview**
- `ResumePage` rendering the sample through the selector. Style to match the ATS spec.
- Hardcode a variant at this point.

**M3: Edit view**
- Profile form, add/edit/delete sections, items, and bullets, tags input.
- Preview updates live.

**M4: Tailor view and variants**
- Checkbox toggles at all three levels, variant dropdown, create/duplicate/rename/delete.
- Tag chips, per-item counters, max-bullets cap.
- Drag-reorder with dnd-kit.

**M5: Backup file**
- Save/open with File System Access plus fallback, Zod validation, migration stub, drag-and-drop open, replace-confirm.

**M6: Dirty tracking and guardrails**
- `beforeunload` handler, status label, post-export nudge, empty state with sample button.

**M7: PDF export**
- Print CSS, Export button, document title trick, one-page indicator.

**M8: Polish and test with real people**
- Mobile layout (Preview tab), keyboard accessibility, copy review, error messages.

---

## 11. Edge Cases to Handle

- Opening a backup from a newer `version` than the app knows: show "This file was made with a newer version" and refuse.
- Variant deleted while active: switch to the first remaining variant. Never allow zero variants (auto-create "Default").
- Deleting a bullet/item in the master: also prune its id from every variant's `excluded`, or ignore stale ids in the selector. Pick one, ideally both.
- Very long bullets or headings: wrap, never clip, in preview and print.
- Empty fields: omit their separators (no stray " - " when a date is missing).
- Pasted text with weird characters or smart bullets: strip leading bullet glyphs on input.
- Tag normalization: lowercase, trimmed, deduplicated.
- File System Access permission denied or cancelled: treat as a no-op, not an error.

---

## 12. Test Checklist (manual, for the prototype)

- [ ] Load sample, switch variants, preview changes correctly.
- [ ] Edit a bullet in the master and see it update in all variants.
- [ ] Tag filter selects expected bullets.
- [ ] Export PDF: text is selectable, copies cleanly, single column.
- [ ] Paste the PDF text into an ATS-style parser or resume checker (e.g. a free online one) and confirm sections are detected.
- [ ] Save, refresh, open backup, state matches exactly.
- [ ] Close tab with unsaved changes triggers the browser prompt. After saving, it does not.
- [ ] Open a corrupted/random file: friendly error, no crash.
- [ ] Works in Chrome, Safari, and Firefox (print output especially).
- [ ] Usable on a phone-sized viewport.

---

## 13. After the Prototype

In rough priority order:

1. **Resume import:** paste text or upload an existing resume, parse it into the schema (LLM-assisted; needs a thin serverless function, so privacy messaging must be explicit).
2. **Job description matching:** paste a JD, suggest which bullets to enable, show keyword coverage.
3. **Alternate phrasings per bullet** (e.g. metrics-heavy vs. short), with the variant choosing which to use.
4. **Accounts without hosting resumes:** Google sign-in storing the backup file in the user's own Drive app-data folder, so sync works while you never hold their data.
5. **One-click PDF** via `@react-pdf/renderer`, plus DOCX and plain-text export.
6. A second template, if testers ask for it.

---

## 14. Open Questions to Settle During the Build

- Tag chip behavior: replace selection vs. add to selection?
- Should reordering bullets in the Tailor view be per-variant or master-wide? (Plan assumes master-wide for simplicity. Per-variant ordering would add an `order` map to `Variant`.)
- Should new bullets default to included or excluded in existing variants? (Plan assumes included.)
- Is the print dialog acceptable to testers, or does it justify moving to react-pdf sooner?
