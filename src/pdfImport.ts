import { nanoid } from 'nanoid'
import { resumeSchema, type Item, type ResumeFile, type Section } from './schema'
import { getResumeLinkHref } from './resumeLinks'

export const MAX_PDF_BYTES = 10 * 1024 * 1024
const MAX_TEXT_LENGTH = 100000

export class ScannedPdfError extends Error {
  constructor() {
    super('This PDF appears to contain scanned images.')
    this.name = 'ScannedPdfError'
  }
}

export type OcrProgress = {
  page: number
  totalPages: number
  progress: number
  status: string
}
const headings: Record<string, Section['type']> = {
  summary: 'summary',
  'professional summary': 'summary',
  'career summary': 'summary',
  profile: 'summary',
  objective: 'summary',
  experience: 'experience',
  'work experience': 'experience',
  'professional experience': 'experience',
  'relevant experience': 'experience',
  'career history': 'experience',
  employment: 'experience',
  'employment history': 'experience',
  'work history': 'experience',
  education: 'education',
  'academic background': 'education',
  'education and training': 'education',
  skills: 'skills',
  'technical skills': 'skills',
  'core competencies': 'skills',
  competencies: 'skills',
  'areas of expertise': 'skills',
  'technical expertise': 'skills',
  'tools and technologies': 'skills',
  projects: 'projects',
  'personal projects': 'projects',
  'selected projects': 'projects',
  certifications: 'custom',
  'licenses and certifications': 'custom',
  'licenses & certifications': 'custom',
  awards: 'custom',
  'honors and awards': 'custom',
  'honors & awards': 'custom',
  publications: 'custom',
  languages: 'custom',
  interests: 'custom',
  volunteering: 'custom',
  'volunteer experience': 'custom',
  'community involvement': 'custom',
  'leadership experience': 'custom',
  leadership: 'custom',
  research: 'custom',
  'research experience': 'custom',
  'professional development': 'custom',
  'additional experience': 'custom',
  'additional information': 'custom',
  'selected accomplishments': 'custom',
  'extracurricular activities': 'custom',
  'military service': 'custom',
  patents: 'custom',
}
const bulletPrefix = /^\s*[•●▪◦‣\-–*]\s*/
const dateRange =
  /((?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+)?(?:19|20)\d{2}(?:[-/]\d{1,2})?|\d{1,2}[/](?:19|20)\d{2}|Present|Current|Now)\s*(?:[-–—]|to)\s*((?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+)?(?:19|20)\d{2}(?:[-/]\d{1,2})?|\d{1,2}[/](?:19|20)\d{2}|Present|Current|Now)/i
const normalizeHeading = (line: string) =>
  line
    .trim()
    .replace(/^[\s\d.):-]+|[:\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
const sectionType = (line: string) => headings[normalizeHeading(line)]
const isCustomHeading = (line: string, nextLine = '') => {
  const normalized = normalizeHeading(line)
  const words = normalized.split(/\s+/)
  const letters = line.replace(/[^A-Za-z]/g, '')
  const isUppercase = letters.length >= 3 && letters === letters.toUpperCase()
  const sectionWords =
    /\b(?:additional|affiliation|affiliations|award|awards|board|certificate|certificates|certification|certifications|community|coursework|development|honor|honors|interest|interests|language|languages|leadership|membership|memberships|patent|patents|project|projects|publication|publications|research|service|skills|training|volunteer|volunteering)\b/.test(
      normalized,
    )
  return Boolean(
    normalized &&
    words.length <= 5 &&
    normalized.length <= 45 &&
    !/[.!?]$/.test(line) &&
    !dateRange.test(line) &&
    !bulletPrefix.test(line) &&
    (line.trim().endsWith(':') ||
      (isUppercase && (bulletPrefix.test(nextLine) || sectionWords || !dateRange.test(nextLine)))),
  )
}
const newItem = (heading = ''): Item => ({ id: nanoid(8), heading, bullets: [] })
const splitLocation = (value: string) => {
  const columns = value.split(/\s{2,}|\s*\|\s*/).filter(Boolean)
  const candidate = columns.at(-1)?.trim() ?? ''
  const looksLikeLocation =
    /^(?:remote|hybrid|on[- ]site|[\p{L}][\p{L} .'-]*,\s*(?:[A-Z]{2}(?:\s+\d{5}(?:-\d{4})?)?|[\p{Lu}][\p{L} .'-]{1,40}))$/u.test(
      candidate,
    )
  if (columns.length < 2 || !looksLikeLocation) return { heading: value.trim(), location: '' }
  return { heading: columns.slice(0, -1).join(' ').trim(), location: candidate }
}
const addBullet = (item: Item, text: string) => {
  if (text.trim()) item.bullets.push({ id: nanoid(8), text: text.trim(), tags: [] })
}

/** Deterministic mapping: uncertain content stays editable instead of being discarded. */
export function parseResumeText(text: string): ResumeFile {
  if (text.length > MAX_TEXT_LENGTH)
    throw new Error('This resume has too much text. Import a shorter PDF.')
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (!lines.length)
    throw new Error('No readable text found. Scanned PDFs need OCR before importing.')
  const firstSection = lines.findIndex(
    (line, index) => sectionType(line) || isCustomHeading(line, lines[index + 1] ?? ''),
  )
  const header = lines.slice(0, firstSection < 0 ? Math.min(lines.length, 5) : firstSection)
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? ''
  const phonePattern = /(?:\+\d{1,3}[ .-]?)?(?:\(\d{3}\)|\d{3})[ .-]\d{3}[ .-]\d{4}\b/
  const phone = header.join(' ').match(phonePattern)?.[0] ?? ''
  const links = [
    ...new Set(
      header.join(' ').match(/(?:https?:\/\/|www\.|(?:linkedin\.com|github\.com)\/)[^\s|<>]+/gi) ??
        [],
    ),
  ]
    .map((url) => url.replace(/[),;.]+$/, ''))
    .filter((url) => getResumeLinkHref(url))
    .map((url) => ({
      id: nanoid(8),
      label: /linkedin/i.test(url) ? 'LinkedIn' : /github/i.test(url) ? 'GitHub' : 'Website',
      url,
    }))
  const nameLine = header.find(
    (line) =>
      !line.includes('@') &&
      !phonePattern.test(line) &&
      !/https?:|www\.|linkedin\.com|github\.com/i.test(line),
  )
  const name = nameLine?.split(/\s*[|]\s*|\s{2,}/)[0] ?? ''
  const remainingHeader = header
    .flatMap((line) => line.split(/\s*[|•]\s*|\s{2,}/))
    .map((part) => part.replace(email, '').replace(phone, '').trim())
    .filter(
      (part) =>
        part &&
        part !== name &&
        !links.some((link) => part.includes(link.url)) &&
        !/https?:|www\.|linkedin\.com|github\.com/i.test(part),
    )
  const locationIndex = remainingHeader.findIndex((part) =>
    /^[\p{L} .'-]+,\s*[\p{L} .'-]+$/u.test(part),
  )
  const location = locationIndex >= 0 ? remainingHeader.splice(locationIndex, 1)[0] : ''
  const sections: Section[] = []
  let section: Section | undefined
  let item: Item | undefined
  let lastWasBullet = false
  const content =
    firstSection < 0 ? lines.filter((line) => !header.includes(line)) : lines.slice(firstSection)
  for (const [index, line] of content.entries()) {
    const nextLine = content[index + 1] ?? ''
    const type = sectionType(line) ?? (isCustomHeading(line, nextLine) ? 'custom' : undefined)
    if (type) {
      section = { id: nanoid(8), type, title: line.replace(/:$/, ''), items: [] }
      sections.push(section)
      item = undefined
      lastWasBullet = false
      continue
    }
    if (!section) {
      section = { id: nanoid(8), type: 'custom', title: 'Imported content', items: [] }
      sections.push(section)
    }
    if (section.type === 'summary') {
      if (!item) {
        item = newItem()
        section.items.push(item)
      }
      if (item.bullets.length) item.bullets[0].text += ` ${line.replace(bulletPrefix, '')}`
      else addBullet(item, line.replace(bulletPrefix, ''))
    } else if (section.type === 'skills') {
      const colon = line.indexOf(':')
      item = newItem(colon >= 0 ? line.slice(0, colon) : '')
      addBullet(item, (colon >= 0 ? line.slice(colon + 1) : line).replace(bulletPrefix, ''))
      section.items.push(item)
    } else if (bulletPrefix.test(line)) {
      if (!item) {
        item = newItem()
        section.items.push(item)
      }
      addBullet(item, line.replace(bulletPrefix, ''))
      lastWasBullet = true
    } else {
      const dates = line.match(dateRange)
      const label = dates
        ? line
            .replace(dates[0], '')
            .replace(/\s*[|,]\s*$/, '')
            .trim()
        : line
      const nextHasDates = dateRange.test(nextLine)
      const { heading, location } = splitLocation(label)
      if (!item || (lastWasBullet && (dates || nextHasDates))) {
        item = newItem(heading)
        section.items.push(item)
        lastWasBullet = false
      } else if (!item.subheading && !lastWasBullet && label) {
        const detail = splitLocation(label)
        item.subheading = detail.heading
        if (detail.location) item.location = detail.location
      } else if (lastWasBullet && !dates && item.bullets.length) {
        item.bullets[item.bullets.length - 1].text += ` ${line}`
      } else if (label) addBullet(item, label)
      if (dates) {
        item.dateStart = dates[1]
        item.dateEnd = dates[2]
      }
      if (location) item.location = location
    }
  }
  const filledSections = sections.filter((candidate) =>
    candidate.items.some(
      (entry) =>
        entry.heading.trim() ||
        entry.subheading?.trim() ||
        entry.bullets.some((bullet) => bullet.text.trim()),
    ),
  )
  const id = nanoid(8)
  const result = resumeSchema.safeParse({
    app: 'resume-tailor',
    version: 1,
    master: { profile: { name, email, phone, location, links }, sections: filledSections },
    variants: [{ id, name: 'Default', excluded: [] }],
    activeVariantId: id,
  })
  if (!result.success)
    throw new Error(
      'The extracted content exceeds supported field limits. Shorten or split the text before importing.',
    )
  return result.data
}

export async function extractPdfText(file: File): Promise<string> {
  if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf')
    throw new Error('Choose a PDF file.')
  if (file.size > MAX_PDF_BYTES) throw new Error('Choose a PDF smaller than 10 MB.')
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist')
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  GlobalWorkerOptions.workerSrc = workerUrl
  const task = getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    isEvalSupported: false,
  })
  try {
    const pdf = await task.promise
    if (pdf.numPages > 20) throw new Error('Choose a resume PDF with 20 pages or fewer.')
    const pages: string[] = []
    let length = 0
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()
      // Group fragments by their baseline, then read left to right.
      const rows: { y: number; fragments: { x: number; width: number; text: string }[] }[] = []
      for (const entry of content.items) {
        if (!('str' in entry) || !entry.str.trim()) continue
        const y = entry.transform[5]
        let row = rows.find((row) => Math.abs(row.y - y) < 3)
        if (!row) {
          row = { y, fragments: [] }
          rows.push(row)
        }
        row.fragments.push({ x: entry.transform[4], width: entry.width, text: entry.str })
      }
      const text = rows
        .sort((a, b) => b.y - a.y)
        .map((row) => {
          const fragments = row.fragments.sort((a, b) => a.x - b.x)
          return fragments
            .map((fragment, index) => {
              const previous = fragments[index - 1]
              const gap = previous ? fragment.x - previous.x - previous.width : 0
              return `${index ? (gap > 12 ? '  ' : ' ') : ''}${fragment.text}`
            })
            .join('')
        })
        .join('\n')
      length += text.length
      if (length > MAX_TEXT_LENGTH)
        throw new Error('This resume has too much text. Import a shorter PDF.')
      pages.push(text)
      page.cleanup()
    }
    const text = pages.join('\n')
    if (!text.trim()) throw new ScannedPdfError()
    return text
  } catch (error) {
    if (error instanceof Error && error.name === 'PasswordException')
      throw new Error('This PDF is password protected. Import an unlocked copy.')
    if (error instanceof Error && error.name === 'InvalidPDFException')
      throw new Error('This PDF could not be read. Choose a valid PDF file.')
    throw error
  } finally {
    await task.destroy()
  }
}

export async function extractPdfTextWithOcr(
  file: File,
  onProgress: (progress: OcrProgress) => void,
  signal: AbortSignal,
): Promise<string> {
  if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf')
    throw new Error('Choose a PDF file.')
  if (file.size > MAX_PDF_BYTES) throw new Error('Choose a PDF smaller than 10 MB.')
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist')
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  const { createWorker } = await import('tesseract.js')
  GlobalWorkerOptions.workerSrc = workerUrl
  const task = getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    isEvalSupported: false,
  })
  let worker: Awaited<ReturnType<typeof createWorker>> | undefined
  let activePage = 1
  const stopWorker = () => {
    void worker?.terminate()
  }
  try {
    const pdf = await task.promise
    if (pdf.numPages > 20) throw new Error('Choose a resume PDF with 20 pages or fewer.')
    worker = await createWorker('eng', 1, {
      logger: (message) => {
        if (message.status === 'recognizing text') {
          onProgress({
            page: activePage,
            totalPages: pdf.numPages,
            progress: message.progress ?? 0,
            status: message.status,
          })
        }
      },
    })
    if (signal.aborted) throw new DOMException('OCR cancelled.', 'AbortError')
    signal.addEventListener('abort', stopWorker, { once: true })
    const pages: string[] = []
    let length = 0
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      if (signal.aborted) throw new DOMException('OCR cancelled.', 'AbortError')
      activePage = pageNumber
      const page = await pdf.getPage(pageNumber)
      const viewport = page.getViewport({ scale: 2 })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Could not prepare this PDF page for text extraction.')
      await page.render({ canvas, canvasContext: context, viewport }).promise
      onProgress({
        page: pageNumber,
        totalPages: pdf.numPages,
        progress: 0,
        status: 'recognizing text',
      })
      const result = await worker.recognize(canvas)
      pages.push(result.data.text.trim())
      length += result.data.text.length
      canvas.width = 0
      canvas.height = 0
      page.cleanup()
      if (length > MAX_TEXT_LENGTH)
        throw new Error('This resume has too much text. Import a shorter PDF.')
    }
    const text = pages.join('\n\n')
    if (!text.trim()) throw new Error('No text could be extracted from these PDF images.')
    return text
  } finally {
    signal.removeEventListener('abort', stopWorker)
    try {
      await worker?.terminate()
    } finally {
      await task.destroy()
    }
  }
}
