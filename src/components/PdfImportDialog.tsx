import { useEffect, useMemo, useRef, useState } from 'react'
import { FileUp, X } from 'lucide-react'
import {
  extractPdfText,
  extractPdfTextWithOcr,
  parseResumeText,
  ScannedPdfError,
  type OcrProgress,
} from '../pdfImport'
import type { ResumeFile } from '../schema'
import ResumePage from './Preview/ResumePage'
import './pdfImport.css'

type Props = {
  initialFile?: File
  hasResume: boolean
  onClose: () => void
  onImport: (file: ResumeFile) => void
}

export default function PdfImportDialog({ initialFile, hasResume, onClose, onImport }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const ocrDialog = useRef<HTMLDialogElement>(null)
  const request = useRef({ id: 0 })
  const abortOcr = useRef<AbortController | null>(null)
  const [scannedFile, setScannedFile] = useState<File | null>(null)
  const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null)
  const [ocrBusy, setOcrBusy] = useState(false)
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(Boolean(initialFile))
  const [error, setError] = useState('')
  const parsed = useMemo(() => {
    if (!text.trim()) return { file: null, error: '' }
    try {
      return { file: parseResumeText(text), error: '' }
    } catch (error) {
      return { file: null, error: (error as Error).message }
    }
  }, [text])

  useEffect(() => {
    const element = dialog.current
    const pending = request.current
    element?.showModal()
    return () => {
      pending.id++
      abortOcr.current?.abort()
      element?.close()
    }
  }, [])

  useEffect(() => {
    const element = ocrDialog.current
    if (scannedFile && element && !element.open) element.showModal()
    else if (!scannedFile && element?.open) element.close()
  }, [scannedFile])

  useEffect(() => {
    if (!initialFile) return
    let cancelled = false
    void extractPdfText(initialFile)
      .then((result) => {
        if (!cancelled) {
          setText(result)
          setFileName(initialFile.name)
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return
        if (error instanceof ScannedPdfError) setScannedFile(initialFile)
        else setError(error instanceof Error ? error.message : 'Could not read this PDF.')
      })
      .finally(() => {
        if (!cancelled) setBusy(false)
      })
    return () => {
      cancelled = true
    }
  }, [initialFile])

  async function readFile(file: File) {
    const id = ++request.current.id
    setBusy(true)
    setError('')
    setText('')
    setFileName(file.name)
    setScannedFile(null)
    try {
      const result = await extractPdfText(file)
      if (request.current.id === id) setText(result)
    } catch (error) {
      if (request.current.id === id && error instanceof ScannedPdfError) {
        setScannedFile(file)
      } else if (request.current.id === id) {
        setError(error instanceof Error ? error.message : 'Could not read this PDF.')
      }
    } finally {
      if (request.current.id === id) setBusy(false)
    }
  }

  async function runOcr() {
    if (!scannedFile) return
    const file = scannedFile
    const controller = new AbortController()
    abortOcr.current = controller
    setOcrBusy(true)
    setError('')
    setScannedFile(null)
    setOcrProgress({ page: 1, totalPages: 1, progress: 0, status: 'Preparing text extraction' })
    try {
      const result = await extractPdfTextWithOcr(
        file,
        (progress) => setOcrProgress(progress),
        controller.signal,
      )
      setText(result)
      setFileName(file.name)
    } catch (error) {
      if (!controller.signal.aborted)
        setError(error instanceof Error ? error.message : 'Could not extract text from this PDF.')
    } finally {
      if (abortOcr.current === controller) abortOcr.current = null
      setOcrBusy(false)
      setOcrProgress(null)
    }
  }

  function cancelOcr() {
    abortOcr.current?.abort()
    abortOcr.current = null
    setOcrBusy(false)
    setOcrProgress(null)
  }

  return (
    <dialog
      ref={dialog}
      className="pdf-import-dialog"
      aria-labelledby="pdf-import-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <header className="pdf-import-head">
        <div>
          <p className="eyebrow">START FROM YOUR RESUME</p>
          <h2 id="pdf-import-title">Import PDF</h2>
        </div>
        <button className="iconbtn" onClick={onClose} aria-label="Close PDF import">
          <X size={18} />
        </button>
      </header>
      <p className="pdf-import-intro">
        Fill your resume fields from a PDF. Your file stays in this browser.
      </p>
      <label className="pdf-file-label">
        <span>
          {fileName || 'Choose a PDF'} <small>Up to 10 MB and 20 pages</small>
        </span>
        <span className="button secondary pdf-file-button">
          <FileUp size={15} /> Browse files
        </span>
        <input
          className="pdf-file-input"
          type="file"
          accept=".pdf,application/pdf"
          disabled={busy || ocrBusy}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void readFile(file)
            event.currentTarget.value = ''
          }}
        />
      </label>
      {(busy || (initialFile && !fileName && !error)) && (
        <p className="pdf-import-status" role="status">
          Reading your PDF...
        </p>
      )}
      {ocrBusy && (
        <div className="pdf-ocr-progress" role="status" aria-live="polite">
          <span className="pdf-ocr-spinner" aria-hidden="true" />
          <div>
            <strong>Extracting text from scanned PDF</strong>
            <p>
              {ocrProgress?.status === 'recognizing text'
                ? `Page ${ocrProgress.page} of ${ocrProgress.totalPages}`
                : 'Getting the pages ready...'}
            </p>
          </div>
          <button className="button secondary" onClick={cancelOcr}>
            Cancel
          </button>
        </div>
      )}
      {(error || parsed.error) && (
        <p className="pdf-import-error" role="alert">
          {error || parsed.error}
        </p>
      )}
      {text && (
        <>
          <div className="pdf-import-review-head">
            <div>
              <h3>Review your import</h3>
              <p>
                Check the extracted text and the fields it fills. You can edit every field after
                importing.
              </p>
            </div>
            <span>{parsed.file?.master.sections.length ?? 0} sections found</span>
          </div>
          {!parsed.file?.master.sections.length && (
            <p className="pdf-import-error" role="status">
              No resume sections were detected. Edit the extracted text to add recognizable section
              headings.
            </p>
          )}
          <div className="pdf-import-review">
            <label>
              <span>
                Extracted text <small>{fileName}</small>
              </span>
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                spellCheck={false}
              />
            </label>
            <div className="pdf-import-preview" aria-label="Imported resume preview">
              <ResumePage page={parsed.file?.master ?? null} />
            </div>
          </div>
        </>
      )}
      <footer className="pdf-import-footer">
        <p>
          {hasResume
            ? 'Importing replaces your current resume and variants.'
            : 'Image-based PDFs can have their text extracted before importing.'}
        </p>
        <button className="button secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          className="button primary"
          disabled={!parsed.file || busy}
          onClick={() => {
            if (parsed.file) onImport(parsed.file)
          }}
        >
          <FileUp size={16} />
          {hasResume ? 'Replace with imported resume' : 'Use imported resume'}
        </button>
      </footer>
      <dialog
        ref={ocrDialog}
        className="pdf-ocr-dialog"
        aria-labelledby="pdf-ocr-title"
        onCancel={(event) => {
          event.preventDefault()
          setScannedFile(null)
        }}
      >
        <div className="pdf-ocr-icon">
          <FileUp size={21} />
        </div>
        <p className="eyebrow">PDF MADE OF IMAGES</p>
        <h2 id="pdf-ocr-title">This PDF seems to be made of images</h2>
        <p>
          Would you like Tailor to find and extract text from its pages? This happens on your device
          and may take a little while.
        </p>
        <div className="pdf-ocr-actions">
          <button className="button secondary" onClick={() => setScannedFile(null)}>
            Not now
          </button>
          <button className="button primary" onClick={() => void runOcr()}>
            Extract text
          </button>
        </div>
      </dialog>
    </dialog>
  )
}
