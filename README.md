# Tailor

A private, browser-only resume editor. Your resume stays in the open tab until you save a `.resume` backup. There is no account, server storage, or browser persistence.

## Run locally

```sh
npm install
npm run dev
```

To create a static production build, run `npm run build`.

## Use

- Start from scratch or load the sample resume.
- Import PDF from the home page (or drop a PDF into the app). Review and correct the extracted text, then apply it to fill contact details and resume sections. Applying an import replaces the current resume and variants; cancel keeps existing work.
- PDF import runs in the browser using PDF.js and supports PDFs up to 10 MB and 20 pages. Scanned PDFs prompt before browser-based OCR; OCR language data downloads on first use. Complex columns and unfamiliar headings may require corrections; unclassified content is retained for review. Save a backup after importing.
- Edit your master resume, then switch to Tailor to manage visibility by variant.
- Save/Open backup to preserve or restore all content and variants.
- Export PDF opens the browser print dialog; select �Save as PDF�.

Backups are validated when opened. Files from a newer app version are refused.
