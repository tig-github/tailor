import { useEffect, useState } from 'react'
import { Copy, Plus, X } from 'lucide-react'
import { nanoid } from 'nanoid'
import type { ResumeFile } from '../schema'

type VariantManagerProps = {
  file: ResumeFile
  mutate: (change: (file: ResumeFile) => void) => void
  onClose: () => void
  onMessage: (message: string) => void
}

export default function VariantManager({ file, mutate, onClose, onMessage }: VariantManagerProps) {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newName, setNewName] = useState(`Variant ${file.variants.length + 1}`)
  const [copySelection, setCopySelection] = useState(true)
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({})
  const [error, setError] = useState('')

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  const createVariant = () => {
    const name = newName.trim()
    if (!name) {
      setError('Enter a name for this variant.')
      return
    }
    if (file.variants.some((variant) => variant.name.trim().toLowerCase() === name.toLowerCase())) {
      setError('A variant already uses that name.')
      return
    }
    mutate((current) => {
      const active = current.variants.find((variant) => variant.id === current.activeVariantId)
      const variant = {
        id: nanoid(8),
        name,
        excluded: copySelection ? [...(active?.excluded ?? [])] : [],
      }
      current.variants.push(variant)
      current.activeVariantId = variant.id
    })
    onClose()
  }

  const saveName = (id: string) => {
    const name = nameDrafts[id]?.trim()
    if (!name) {
      setError('Variant names cannot be empty.')
      return
    }
    if (
      file.variants.some(
        (variant) => variant.id !== id && variant.name.trim().toLowerCase() === name.toLowerCase(),
      )
    ) {
      setError('A variant already uses that name.')
      return
    }
    mutate((current) => {
      const variant = current.variants.find((entry) => entry.id === id)
      if (variant) variant.name = name
    })
    setNameDrafts((drafts) => ({ ...drafts, [id]: name }))
    setError('')
  }

  const duplicateVariant = (id: string) => {
    mutate((current) => {
      const original = current.variants.find((variant) => variant.id === id)
      if (!original) return
      const copy = { ...structuredClone(original), id: nanoid(8), name: `${original.name} copy` }
      current.variants.push(copy)
      current.activeVariantId = copy.id
    })
    onClose()
  }

  const deleteVariant = (id: string) => {
    if (file.variants.length < 2) {
      onMessage('Keep at least one variant.')
      return
    }
    const variant = file.variants.find((entry) => entry.id === id)
    if (!variant || !window.confirm(`Delete the "${variant.name}" variant?`)) return
    mutate((current) => {
      current.variants = current.variants.filter((entry) => entry.id !== id)
      if (current.activeVariantId === id) current.activeVariantId = current.variants[0].id
    })
  }

  return (
    <div
      className="dialog-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="variant-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="variant-dialog-title"
      >
        <header className="variant-dialog-head">
          <div>
            <p className="eyebrow">RESUME VERSIONS</p>
            <h2 id="variant-dialog-title">Manage variants</h2>
            <p className="muted">Create focused versions from the same master resume.</p>
          </div>
          <button className="iconbtn" onClick={onClose} aria-label="Close variant manager">
            <X size={18} />
          </button>
        </header>

        {showCreateForm ? (
          <div className="variant-create-form">
            <label>
              Variant name
              <input
                autoFocus
                value={newName}
                onChange={(event) => {
                  setNewName(event.target.value)
                  setError('')
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') createVariant()
                }}
                placeholder="e.g. Product Engineer"
              />
            </label>
            <label className="copy-selection-option">
              <input
                type="checkbox"
                checked={copySelection}
                onChange={(event) => setCopySelection(event.target.checked)}
              />
              Copy the current visibility selection
            </label>
            {error && (
              <p className="variant-error" role="alert">
                {error}
              </p>
            )}
            <div className="variant-form-actions">
              <button className="button secondary" onClick={() => setShowCreateForm(false)}>
                Back
              </button>
              <button className="button primary" onClick={createVariant}>
                <Plus size={15} /> Create variant
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              className="button primary variant-add-button"
              onClick={() => {
                setNewName(`Variant ${file.variants.length + 1}`)
                setError('')
                setShowCreateForm(true)
              }}
            >
              <Plus size={15} /> New variant
            </button>
            {error && (
              <p className="variant-error" role="alert">
                {error}
              </p>
            )}
            <div className="variant-list" role="radiogroup" aria-label="Active variant">
              {file.variants.map((variant) => (
                <div className="variant-row" key={variant.id}>
                  <label className="variant-choice">
                    <input
                      type="radio"
                      name="active-variant"
                      checked={variant.id === file.activeVariantId}
                      onChange={() => mutate((current) => (current.activeVariantId = variant.id))}
                    />
                  </label>
                  <input
                    className="variant-name-input"
                    aria-label={`Name for ${variant.name}`}
                    value={nameDrafts[variant.id] ?? variant.name}
                    onChange={(event) => {
                      setNameDrafts((drafts) => ({ ...drafts, [variant.id]: event.target.value }))
                      setError('')
                    }}
                    onBlur={() => {
                      const draft = nameDrafts[variant.id]
                      if (draft !== undefined && draft.trim() && draft.trim() !== variant.name)
                        saveName(variant.id)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') saveName(variant.id)
                    }}
                  />
                  <div className="variant-row-actions">
                    {variant.id === file.activeVariantId && (
                      <span className="active-variant-label">Active</span>
                    )}
                    <button className="variant-action" onClick={() => duplicateVariant(variant.id)}>
                      <Copy size={14} /> Duplicate
                    </button>
                    <button
                      className="variant-action variant-delete"
                      onClick={() => deleteVariant(variant.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
