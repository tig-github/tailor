import { ArrowRight, FileUp, Plus, Sparkles } from 'lucide-react'
import TailorIcon from './TailorIcon'

type LandingPageProps = {
  hasResume: boolean
  onContinue: () => void
  onCreate: () => void
  onTrySample: () => void
  onOpenBackup: () => void
  onImportPdf: () => void
}

export default function LandingPage({
  hasResume,
  onContinue,
  onCreate,
  onTrySample,
  onOpenBackup,
  onImportPdf,
}: LandingPageProps) {
  return (
    <main className="empty">
      <div className="emptyicon">
        <TailorIcon />
      </div>
      <p className="eyebrow">YOUR RESUME WORKSPACE</p>
      <h1>
        One master resume.
        <br />A focused version for every opportunity.
      </h1>
      <p className="muted">
        Keep one master resume, create focused versions for each opportunity, and export a clean
        PDF. Your work stays in this tab until you choose to save a backup.
      </p>
      <div className="emptybuttons">
        <button className="button secondary" onClick={onImportPdf}>
          <FileUp size={16} /> Import PDF
        </button>
        {hasResume ? (
          <button className="button primary" onClick={onContinue}>
            Continue editing <ArrowRight size={16} />
          </button>
        ) : (
          <button className="button primary" onClick={onCreate}>
            <Plus size={16} /> Start from scratch
          </button>
        )}
        <button className="button secondary" onClick={hasResume ? onCreate : onTrySample}>
          {hasResume ? <Plus size={16} /> : <Sparkles size={16} />}
          {hasResume ? 'Start a new resume' : 'Try a sample resume'}
        </button>
        {hasResume && (
          <button className="button textbutton" onClick={onTrySample}>
            <Sparkles size={16} /> Load sample
          </button>
        )}
        <button className="button textbutton" onClick={onOpenBackup}>
          <FileUp size={16} /> Open backup
        </button>
      </div>
      <p className="backup-hint">
        Only open backups you trust. Imported resumes can contain external links.
      </p>
    </main>
  )
}
