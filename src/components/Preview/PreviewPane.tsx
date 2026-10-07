import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { Printer } from 'lucide-react'
import type { visible } from '../../store'
import ResumePage from './ResumePage'

const LETTER_WIDTH = 816
const LETTER_HEIGHT = 1056

export default function PreviewPane({
  page,
  hiddenOnMobile,
}: {
  page: ReturnType<typeof visible> | null
  hiddenOnMobile: boolean
}) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef<HTMLElement>(null)
  const [dimensions, setDimensions] = useState({ scale: 1, height: LETTER_HEIGHT })
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current
    const resume = pageRef.current
    if (!wrapper || !resume) return
    const measure = () => {
      const style = getComputedStyle(wrapper)
      const available =
        wrapper.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      const next = {
        scale: Math.min(1, Math.max(0.1, available / LETTER_WIDTH)),
        height: resume.scrollHeight,
      }
      setDimensions((previous) =>
        previous.scale === next.scale && previous.height === next.height ? previous : next,
      )
    }
    const observer = new ResizeObserver(measure)
    observer.observe(wrapper)
    observer.observe(resume)
    return () => observer.disconnect()
  }, [])
  const canvasStyle = {
    '--preview-scale': dimensions.scale,
    '--resume-height': `${dimensions.height}px`,
  } as CSSProperties
  const pages = Math.max(1, Math.ceil(dimensions.height / LETTER_HEIGHT))
  return (
    <aside className={`preview panel ${hiddenOnMobile ? 'hide-mobile' : ''}`}>
      <div className="previewhead">
        <div>
          <p className="eyebrow">LIVE PREVIEW</p>
          <h2>Your resume</h2>
        </div>
        <div className={`pagefit ${pages > 1 ? 'pagefit-overflow' : ''}`}>
          {pages === 1 ? 'Fits on 1 page' : `Spills onto page ${pages}`}
          <span> / US Letter</span>
        </div>
      </div>
      <div className="paperwrap" ref={wrapperRef}>
        <div className="resume-canvas" style={canvasStyle}>
          <ResumePage page={page} pageRef={pageRef} />
        </div>
      </div>
      <div className="printtip">
        <Printer size={14} />
        <span>Choose 'Save as PDF' and turn off headers and footers.</span>
      </div>
    </aside>
  )
}
