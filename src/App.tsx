import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus,
  Trash2,
  FileUp,
  Save,
  Printer,
  Eye,
  Pencil,
  Check,
  ChevronDown,
  X,
  GripVertical,
  SlidersHorizontal,
} from 'lucide-react'
import { nanoid } from 'nanoid'
import { useStore, visible } from './store'
import { MAX_BACKUP_BYTES, resumeSchema, type Section, type Item } from './schema'
import { getResumeLinkHref } from './resumeLinks'
import { sample } from './sample'
import PreviewPane from './components/Preview/PreviewPane'
import LandingPage from './components/LandingPage'
import TailorIcon from './components/TailorIcon'
import VariantManager from './components/VariantManager'
import PdfImportDialog from './components/PdfImportDialog'

const uid = () => nanoid(8)
const clean = (s: string) => s.replace(/^\s*[•●▪◦*-]\s*/, '')
function App() {
  const {
    file,
    mode,
    dirty,
    backupUpToDate,
    mutate,
    load,
    importResume,
    newFile,
    setMode,
    setSaved,
  } = useStore()
  const [msg, setMsg] = useState('')
  const [showNudge, setShowNudge] = useState(false)
  const [showLanding, setShowLanding] = useState(false)
  const [showVariantManager, setShowVariantManager] = useState(false)
  const [pdfImport, setPdfImport] = useState<{ initialFile?: File } | null>(null)
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit')
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const page = useMemo(() => (file ? visible(file) : null), [file])
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])
  const editProfile = (key: string, value: string) =>
    mutate((f) => {
      ;(f.master.profile as Record<string, unknown>)[key] = value
    })
  const addSection = (type: Section['type'] = 'experience') =>
    mutate((f) =>
      f.master.sections.push({
        id: uid(),
        type,
        title: type === 'custom' ? 'New section' : type[0].toUpperCase() + type.slice(1),
        items: [],
      }),
    )
  const updateSec = (sid: string, fn: (s: Section) => void) =>
    mutate((f) => {
      const s = f.master.sections.find((x) => x.id === sid)
      if (s) fn(s)
    })
  const reorderSections = (sourceId: string, targetId: string) =>
    mutate((f) => {
      const from = f.master.sections.findIndex((section) => section.id === sourceId)
      const to = f.master.sections.findIndex((section) => section.id === targetId)
      if (from < 0 || to < 0 || from === to) return
      const [section] = f.master.sections.splice(from, 1)
      f.master.sections.splice(to, 0, section)
    })
  const updateItem = (sid: string, iid: string, fn: (i: Item) => void) =>
    updateSec(sid, (s) => {
      const i = s.items.find((x) => x.id === iid)
      if (i) fn(i)
    })
  const remove = (id: string) =>
    mutate((f) => {
      f.master.sections = f.master.sections.filter((s) => s.id !== id)
      for (const s of f.master.sections)
        s.items = s.items
          .filter((i) => i.id !== id)
          .map((i) => ({ ...i, bullets: i.bullets.filter((b) => b.id !== id) }))
      f.variants.forEach((v) => (v.excluded = v.excluded.filter((x) => x !== id)))
    })
  const toggle = (id: string) =>
    mutate((f) => {
      let v = f.variants.find((x) => x.id === f.activeVariantId)
      if (!v) {
        v = { id: uid(), name: 'Default', excluded: [] }
        f.variants.push(v)
        f.activeVariantId = v.id
      }
      v.excluded = v.excluded.includes(id)
        ? v.excluded.filter((x) => x !== id)
        : [...v.excluded, id]
    })
  const save = async () => {
    if (!file) return
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
    const name =
      (file.master.profile.name || 'resume').toLowerCase().trim().replace(/\s+/g, '-') + '.resume'
    try {
      const picker = (
        window as Window & {
          showSaveFilePicker?: (o: unknown) => Promise<{
            createWritable: () => Promise<{
              write: (b: Blob) => Promise<void>
              close: () => Promise<void>
            }>
          }>
        }
      ).showSaveFilePicker
      if (picker) {
        const handle = await picker({
          suggestedName: name,
          types: [
            {
              description: 'Resume Tailor backup',
              accept: { 'application/json': ['.resume', '.json'] },
            },
          ],
        })
        const w = await handle.createWritable()
        await w.write(blob)
        await w.close()
      } else {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = name
        a.click()
        URL.revokeObjectURL(a.href)
      }
      setSaved()
      setMsg('Backup saved.')
      setTimeout(() => setMsg(''), 3000)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setMsg('Could not save the backup. Please try again.')
    }
  }
  const openFile = async (fileObj: File) => {
    if (fileObj.size > MAX_BACKUP_BYTES) {
      setMsg('This backup is too large. Choose a file smaller than 1 MB.')
      return
    }
    if (dirty && !window.confirm("Replace what's here? You have unsaved changes.")) return
    try {
      const raw = JSON.parse(await fileObj.text())
      if (raw?.version > 1) throw new Error('newer')
      const result = resumeSchema.safeParse(raw)
      if (!result.success) {
        const issues = result.error.issues
        setMsg(
          issues.some((issue) => issue.path.includes('url'))
            ? 'This backup contains an invalid link. Use HTTP or HTTPS website URLs without embedded credentials.'
            : issues.some((issue) => issue.code === 'too_big' || issue.code === 'custom')
              ? 'This backup exceeds the supported content limits. Reduce its text, sections, items, bullets, or variants.'
              : 'This is not a Tailor backup file.',
        )
        return
      }
      const parsed = result.data
      if (!parsed.variants.length) parsed.variants = [{ id: uid(), name: 'Default', excluded: [] }]
      if (!parsed.variants.some((v) => v.id === parsed.activeVariantId))
        parsed.activeVariantId = parsed.variants[0].id
      load(parsed, true)
      setShowLanding(false)
      setMsg('Backup opened.')
    } catch (e) {
      setMsg(
        (e as Error).message === 'newer'
          ? 'This file was made with a newer version.'
          : 'This is not a Tailor backup file.',
      )
    }
  }
  const addBullet = (sid: string, iid: string) =>
    updateItem(sid, iid, (i) => i.bullets.push({ id: uid(), text: '', tags: [] }))
  const variants = file?.variants ?? []
  const active = variants.find((v) => v.id === file?.activeVariantId)
  return (
    <div
      className="app"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        const f = e.dataTransfer.files[0]
        if (f) {
          if (/\.pdf$/i.test(f.name) || f.type === 'application/pdf')
            setPdfImport({ initialFile: f })
          else void openFile(f)
        }
      }}
    >
      <header className="topbar">
        <a
          className="brand"
          href="/"
          aria-label="Go to Tailor home"
          onClick={(event) => {
            event.preventDefault()
            setShowLanding(true)
          }}
        >
          <span className="brandmark">
            <TailorIcon />
          </span>
          <span>Tailor</span>
        </a>
        {file && !showLanding && (
          <>
            <div className="variant">
              <select
                value={active?.id ?? ''}
                onChange={(e) => mutate((f) => (f.activeVariantId = e.target.value))}
              >
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
              <button
                className="button secondary manage-variants"
                onClick={() => setShowVariantManager(true)}
              >
                <SlidersHorizontal size={15} /> Manage
              </button>
            </div>
            <div className="modeSwitch">
              <button className={mode === 'edit' ? 'selected' : ''} onClick={() => setMode('edit')}>
                <Pencil size={14} /> Edit
              </button>
              <button
                className={mode === 'tailor' ? 'selected' : ''}
                onClick={() => setMode('tailor')}
              >
                <Check size={14} /> Tailor
              </button>
            </div>
            <div className="topactions">
              <span className={dirty ? 'dirty' : 'saved'}>
                <i />
                {dirty ? 'Unsaved changes' : backupUpToDate ? 'Backup up to date' : 'Not backed up'}
              </span>
              <button
                className="button secondary"
                title="Only open backups you trust. Imported resumes can contain external links."
                onClick={() => fileInput.current?.click()}
              >
                <FileUp size={15} /> Open backup
              </button>
              <button className="button secondary" onClick={() => void save()}>
                <Save size={15} /> Save backup
              </button>
              <button
                className="button primary"
                onClick={() => {
                  document.title =
                    (file.master.profile.name || 'Resume').replace(/\s+/g, '-') + '-Resume'
                  setShowNudge(true)
                  window.print()
                  setTimeout(() => (document.title = 'Tailor'), 1000)
                }}
              >
                <Printer size={15} /> Export PDF
              </button>
            </div>
          </>
        )}
        <input
          ref={fileInput}
          hidden
          type="file"
          accept=".resume,.json,application/json"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void openFile(f)
            e.currentTarget.value = ''
          }}
        />
      </header>
      {pdfImport && (
        <PdfImportDialog
          initialFile={pdfImport.initialFile}
          hasResume={Boolean(file)}
          onClose={() => setPdfImport(null)}
          onImport={(imported) => {
            importResume(imported)
            setMode('edit')
            setMobileTab('edit')
            setShowLanding(false)
            setShowVariantManager(false)
            setPdfImport(null)
            setMsg('PDF imported. Review your fields, then save a backup.')
          }}
        />
      )}
      {showVariantManager && file && (
        <VariantManager
          file={file}
          mutate={mutate}
          onClose={() => setShowVariantManager(false)}
          onMessage={setMsg}
        />
      )}
      {msg && (
        <div className="toast" role="status">
          {msg}
          <button onClick={() => setMsg('')}>
            <X size={15} />
          </button>
        </div>
      )}
      {showNudge && file && (
        <div className="nudge">
          Your PDF is ready. Want to save a backup so you can tweak this later?{' '}
          <button onClick={() => void save()}>Save backup</button>
          <button onClick={() => setShowNudge(false)} aria-label="Dismiss">
            <X size={15} />
          </button>
        </div>
      )}
      {!file || showLanding ? (
        <LandingPage
          hasResume={Boolean(file)}
          onContinue={() => setShowLanding(false)}
          onCreate={() => {
            if (file && dirty && !window.confirm('Discard unsaved changes and start a new resume?'))
              return
            newFile()
            setShowLanding(false)
          }}
          onTrySample={() => {
            if (file && dirty && !window.confirm('Discard unsaved changes and load the sample?'))
              return
            load(structuredClone(sample))
            setShowLanding(false)
          }}
          onOpenBackup={() => fileInput.current?.click()}
          onImportPdf={() => setPdfImport({})}
        />
      ) : (
        <>
          <div className="mobiletabs">
            <button
              className={mobileTab === 'edit' ? 'selected' : ''}
              onClick={() => setMobileTab('edit')}
            >
              {mode === 'edit' ? 'Edit' : 'Tailor'}
            </button>
            <button
              className={mobileTab === 'preview' ? 'selected' : ''}
              onClick={() => setMobileTab('preview')}
            >
              <Eye size={15} /> Preview
            </button>
          </div>
          <main className="workspace">
            <section className={`editor panel ${mobileTab === 'preview' ? 'hide-mobile' : ''}`}>
              {mode === 'edit' ? (
                <>
                  <div className="panelhead">
                    <div>
                      <p className="eyebrow">MASTER RESUME</p>
                      <h2>Edit your content</h2>
                      <p className="muted">
                        Everything lives here. Variants only change what shows.
                      </p>
                    </div>
                  </div>
                  <div className="formblock">
                    <h3>Personal details</h3>
                    <div className="grid">
                      <label className="wide">
                        Full name
                        <input
                          placeholder="Your name"
                          value={file.master.profile.name}
                          onChange={(e) => editProfile('name', e.target.value)}
                        />
                      </label>
                      <label>
                        Email
                        <input
                          placeholder="you@email.com"
                          value={file.master.profile.email}
                          onChange={(e) => editProfile('email', e.target.value)}
                        />
                      </label>
                      <label>
                        Phone
                        <input
                          placeholder="(555) 555-5555"
                          value={file.master.profile.phone ?? ''}
                          onChange={(e) => editProfile('phone', e.target.value)}
                        />
                      </label>
                      <label>
                        Location
                        <input
                          placeholder="City, State"
                          value={file.master.profile.location ?? ''}
                          onChange={(e) => editProfile('location', e.target.value)}
                        />
                      </label>
                      <label>
                        Links
                        <input
                          placeholder="linkedin.com/in/you, site.com"
                          value={file.master.profile.links.map((l) => l.url).join(', ')}
                          onChange={(e) =>
                            mutate(
                              (f) =>
                                (f.master.profile.links = e.target.value
                                  .split(',')
                                  .map((s) => s.trim())
                                  .filter(Boolean)
                                  .map((url, n) => ({
                                    id: f.master.profile.links[n]?.id ?? uid(),
                                    label: url.includes('linkedin') ? 'LinkedIn' : 'Website',
                                    url,
                                  }))),
                            )
                          }
                        />
                        {file.master.profile.links.some((link) => !getResumeLinkHref(link.url)) && (
                          <small className="link-warning">
                            Use valid HTTP or HTTPS website links. Invalid links appear as plain
                            text.
                          </small>
                        )}
                      </label>
                    </div>
                  </div>
                  <div className="sectionList">
                    <div className="sectionTitle">
                      <h3>
                        Resume sections <span>{file.master.sections.length}</span>
                      </h3>
                    </div>
                    {file.master.sections.map((s, index) => (
                      <details
                        className={`sectionCard${draggedSectionId === s.id ? ' isDragging' : ''}`}
                        key={s.id}
                        open
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          const sourceId = e.dataTransfer.getData('text/plain') || draggedSectionId
                          if (sourceId) reorderSections(sourceId, s.id)
                          setDraggedSectionId(null)
                        }}
                        onDragEnd={() => setDraggedSectionId(null)}
                      >
                        <summary>
                          <span
                            className="sectionDragHandle"
                            draggable
                            title="Drag to reorder section"
                            aria-label={`Drag ${s.title} to reorder`}
                            onClick={(e) => e.stopPropagation()}
                            onDragStart={(e) => {
                              e.stopPropagation()
                              e.dataTransfer.setData('text/plain', s.id)
                              e.dataTransfer.effectAllowed = 'move'
                              setDraggedSectionId(s.id)
                            }}
                          >
                            <GripVertical size={14} />
                          </span>
                          <span className="order">{String(index + 1).padStart(2, '0')}</span>
                          <input
                            aria-label="Section title"
                            value={s.title}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => updateSec(s.id, (x) => (x.title = e.target.value))}
                          />
                          {s.type === 'custom' && (
                            <select
                              className="sectionFormat"
                              aria-label="Custom section format"
                              title="Section format"
                              value={s.format ?? 'bullets'}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) =>
                                updateSec(
                                  s.id,
                                  (x) =>
                                    (x.format = e.target.value as NonNullable<Section['format']>),
                                )
                              }
                            >
                              <option value="bullets">Bullets</option>
                              <option value="skills">Skills</option>
                              <option value="summary">Summary</option>
                            </select>
                          )}
                          <button
                            className="iconbtn danger"
                            onClick={(e) => {
                              e.preventDefault()
                              remove(s.id)
                            }}
                            title="Delete section"
                          >
                            <Trash2 size={14} />
                          </button>
                          <ChevronDown size={15} />
                        </summary>
                        <div className="cardbody">
                          {s.items.map((it) => (
                            <div className="itemEditor" key={it.id}>
                              <div className="itemheading">
                                {s.type !== 'summary' &&
                                  !(s.type === 'custom' && s.format === 'summary') && (
                                    <label>
                                      {s.type === 'custom' && s.format === 'skills'
                                        ? 'Skill category'
                                        : 'Heading'}
                                      <input
                                        placeholder={
                                          s.type === 'experience'
                                            ? 'Company name'
                                            : s.type === 'custom' && s.format === 'skills'
                                              ? 'e.g. Languages'
                                              : 'Organization or category'
                                        }
                                        value={it.heading}
                                        onChange={(e) =>
                                          updateItem(
                                            s.id,
                                            it.id,
                                            (x) => (x.heading = e.target.value),
                                          )
                                        }
                                      />
                                    </label>
                                  )}
                                <button
                                  className="iconbtn danger"
                                  onClick={() => remove(it.id)}
                                  title="Delete item"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                              {s.type !== 'summary' &&
                                (s.type !== 'custom' || (s.format ?? 'bullets') === 'bullets') && (
                                  <div className="grid four">
                                    <label>
                                      Role / detail
                                      <input
                                        placeholder="Job title, degree..."
                                        value={it.subheading ?? ''}
                                        onChange={(e) =>
                                          updateItem(
                                            s.id,
                                            it.id,
                                            (x) => (x.subheading = e.target.value),
                                          )
                                        }
                                      />
                                    </label>
                                    <label>
                                      Location
                                      <input
                                        placeholder="City, State"
                                        value={it.location ?? ''}
                                        onChange={(e) =>
                                          updateItem(
                                            s.id,
                                            it.id,
                                            (x) => (x.location = e.target.value),
                                          )
                                        }
                                      />
                                    </label>
                                    <label>
                                      Start date
                                      <input
                                        placeholder="2022-03"
                                        value={it.dateStart ?? ''}
                                        onChange={(e) =>
                                          updateItem(
                                            s.id,
                                            it.id,
                                            (x) => (x.dateStart = e.target.value),
                                          )
                                        }
                                      />
                                    </label>
                                    <label>
                                      End date
                                      <input
                                        placeholder="Present"
                                        value={it.dateEnd ?? ''}
                                        onChange={(e) =>
                                          updateItem(
                                            s.id,
                                            it.id,
                                            (x) => (x.dateEnd = e.target.value),
                                          )
                                        }
                                      />
                                    </label>
                                  </div>
                                )}
                              {it.bullets.map((b) => (
                                <div className="bulletedit" key={b.id}>
                                  <textarea
                                    placeholder={
                                      s.type === 'custom' && s.format === 'summary'
                                        ? 'Write a summary paragraph'
                                        : s.type === 'custom' && s.format === 'skills'
                                          ? 'Add a skill or technology'
                                          : 'Describe an impact or add a skill'
                                    }
                                    value={b.text}
                                    onChange={(e) =>
                                      updateItem(s.id, it.id, (x) => {
                                        const row = x.bullets.find((y) => y.id === b.id)
                                        if (row) row.text = clean(e.target.value)
                                      })
                                    }
                                  />
                                  <div className="bulletfoot">
                                    <input
                                      className="taginput"
                                      placeholder="+ Add tags, separated by commas"
                                      value={b.tags.join(', ')}
                                      onChange={(e) =>
                                        updateItem(s.id, it.id, (x) => {
                                          const row = x.bullets.find((y) => y.id === b.id)
                                          if (row)
                                            row.tags = [
                                              ...new Set(
                                                e.target.value
                                                  .split(',')
                                                  .map((t) => t.trim().toLowerCase())
                                                  .filter(Boolean),
                                              ),
                                            ]
                                        })
                                      }
                                    />
                                    <button
                                      className="iconbtn danger"
                                      onClick={() => remove(b.id)}
                                      title="Delete bullet"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                    <button
                                      className="iconbtn"
                                      title="Move bullet up"
                                      onClick={() =>
                                        updateItem(s.id, it.id, (x) => {
                                          const n = x.bullets.findIndex((y) => y.id === b.id)
                                          if (n > 0)
                                            [x.bullets[n - 1], x.bullets[n]] = [
                                              x.bullets[n],
                                              x.bullets[n - 1],
                                            ]
                                        })
                                      }
                                    >
                                      ↑
                                    </button>
                                    <button
                                      className="iconbtn"
                                      title="Move bullet down"
                                      onClick={() =>
                                        updateItem(s.id, it.id, (x) => {
                                          const n = x.bullets.findIndex((y) => y.id === b.id)
                                          if (n < x.bullets.length - 1)
                                            [x.bullets[n + 1], x.bullets[n]] = [
                                              x.bullets[n],
                                              x.bullets[n + 1],
                                            ]
                                        })
                                      }
                                    >
                                      ↓
                                    </button>
                                  </div>
                                </div>
                              ))}
                              <button className="addinline" onClick={() => addBullet(s.id, it.id)}>
                                <Plus size={14} />
                                {s.type === 'custom' && s.format === 'summary'
                                  ? 'Add paragraph'
                                  : s.type === 'custom' && s.format === 'skills'
                                    ? 'Add skill'
                                    : 'Add bullet or skill'}
                              </button>
                            </div>
                          ))}
                          <button
                            className="addinline"
                            onClick={() =>
                              updateSec(s.id, (x) =>
                                x.items.push({ id: uid(), heading: '', bullets: [] }),
                              )
                            }
                          >
                            <Plus size={14} /> Add item
                          </button>
                        </div>
                      </details>
                    ))}
                  </div>
                  <div className="addsection">
                    {(
                      [
                        'experience',
                        'projects',
                        'education',
                        'skills',
                        'summary',
                        'custom',
                      ] as const
                    ).map((t) => (
                      <button key={t} onClick={() => addSection(t)}>
                        <Plus size={14} />
                        {t === 'custom' ? 'Custom section' : t[0].toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="panelhead">
                    <div>
                      <p className="eyebrow">MAKE IT RELEVANT</p>
                      <h2>Tailor this version</h2>
                      <p className="muted">
                        Choose what to include. Changes stay linked to your master.
                      </p>
                    </div>
                  </div>
                  <div className="variantName">
                    <label>
                      Variant name
                      <input
                        value={active?.name ?? ''}
                        onChange={(e) =>
                          mutate((f) => {
                            const v = f.variants.find((x) => x.id === f.activeVariantId)
                            if (v) v.name = e.target.value
                          })
                        }
                      />
                    </label>
                  </div>
                  <TagBar file={file} mutate={mutate} />
                  <div className="tailorList">
                    {file.master.sections.map((s) => (
                      <div className="tailorSection" key={s.id}>
                        <label className="checkrow sectioncheck">
                          <input
                            type="checkbox"
                            checked={!active?.excluded.includes(s.id)}
                            onChange={() => toggle(s.id)}
                          />
                          <strong>{s.title}</strong>
                        </label>
                        {s.items.map((i) => (
                          <div className="tailorItem" key={i.id}>
                            <label className="checkrow">
                              <input
                                type="checkbox"
                                checked={!active?.excluded.includes(i.id)}
                                onChange={() => toggle(i.id)}
                              />
                              <b>
                                {s.type === 'summary' ||
                                (s.type === 'custom' && s.format === 'summary')
                                  ? 'Summary paragraph'
                                  : i.heading || 'Untitled item'}
                              </b>
                            </label>
                            {i.bullets.map((b) => (
                              <label className="checkrow bulletcheck" key={b.id}>
                                <input
                                  type="checkbox"
                                  checked={
                                    !active?.excluded.includes(b.id) &&
                                    !active?.excluded.includes(i.id) &&
                                    !active?.excluded.includes(s.id)
                                  }
                                  onChange={() => toggle(b.id)}
                                />
                                <span>{b.text || 'Empty bullet'}</span>
                                {b.tags.map((t) => (
                                  <small key={t}>{t}</small>
                                ))}
                              </label>
                            ))}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
            <PreviewPane page={page} hiddenOnMobile={mobileTab === 'edit'} />
          </main>
        </>
      )}
    </div>
  )
}
function TagBar({
  file,
  mutate,
}: {
  file: NonNullable<ReturnType<typeof useStore.getState>['file']>
  mutate: ReturnType<typeof useStore.getState>['mutate']
}) {
  const tags = [
    ...new Set(
      file.master.sections.flatMap((s) => s.items.flatMap((i) => i.bullets.flatMap((b) => b.tags))),
    ),
  ]
  const activeVariant = file.variants.find((variant) => variant.id === file.activeVariantId)
  const bullets = file.master.sections.flatMap((s) => s.items.flatMap((i) => i.bullets))
  const isActive = (tag: string) =>
    bullets.length > 0 &&
    bullets.every(
      (bullet) =>
        (activeVariant?.excluded.includes(bullet.id) ?? false) !== bullet.tags.includes(tag),
    )
  const apply = (tag: string) =>
    mutate((f) => {
      const v = f.variants.find((x) => x.id === f.activeVariantId)
      if (!v) return
      const allBullets = f.master.sections.flatMap((section) =>
        section.items.flatMap((item) => item.bullets),
      )
      const selected =
        allBullets.length > 0 &&
        allBullets.every((b) => v.excluded.includes(b.id) !== b.tags.includes(tag))
      v.excluded = selected ? [] : allBullets.filter((b) => !b.tags.includes(tag)).map((b) => b.id)
    })
  return (
    <div className="tagbar">
      <span>QUICK SELECT</span>
      <div>
        {tags.length ? (
          tags.map((t) => (
            <button
              key={t}
              className={isActive(t) ? 'selected' : undefined}
              aria-pressed={isActive(t)}
              onClick={() => apply(t)}
            >
              #{t}
            </button>
          ))
        ) : (
          <small>Add tags in Edit to filter bullets</small>
        )}
        <button
          className="showall"
          onClick={() =>
            mutate((f) => {
              const v = f.variants.find((x) => x.id === f.activeVariantId)
              if (v) v.excluded = []
            })
          }
        >
          Show all
        </button>
      </div>
    </div>
  )
}
export default App
