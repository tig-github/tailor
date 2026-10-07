import { Fragment, type Ref } from 'react'
import type { Item } from '../../schema'
import type { visible } from '../../store'
import './resume.css'
import { getResumeLinkHref } from '../../resumeLinks'

function formatDate(value?: string) {
  if (!value) return ''
  if (value.toLowerCase() === 'present') return 'Present'
  if (!/^\d{4}-\d{2}$/.test(value)) return value
  const date = new Date(`${value}-01T12:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function ResumeEntry({ item, format }: { item: Item; format: 'summary' | 'skills' | 'bullets' }) {
  const bullets = item.bullets.filter((bullet) => bullet.text.trim())
  if (format === 'summary') {
    return (
      <div className="resume-summary">
        {bullets.map((bullet) => (
          <p key={bullet.id}>{bullet.text}</p>
        ))}
      </div>
    )
  }
  if (format === 'skills') {
    return (
      <p className="resume-skill">
        {item.heading && <strong>{item.heading}: </strong>}
        {bullets.map((bullet) => bullet.text).join(', ')}
      </p>
    )
  }
  const dates = [formatDate(item.dateStart), formatDate(item.dateEnd)].filter(Boolean).join(' - ')
  return (
    <div className="resumeitem">
      <div className="resumeitemhead">
        <strong>{item.heading}</strong>
        {dates && <span>{dates}</span>}
      </div>
      {(item.subheading || item.location) && (
        <div className="resumeitemdetail">
          <span>{item.subheading}</span>
          <span>{item.location}</span>
        </div>
      )}
      {bullets.length > 0 && (
        <ul>
          {bullets.map((bullet) => (
            <li key={bullet.id}>• {bullet.text}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function ResumePage({
  page,
  pageRef,
}: {
  page: ReturnType<typeof visible> | null
  pageRef?: Ref<HTMLElement>
}) {
  if (!page)
    return (
      <article className="resume-page blank" ref={pageRef}>
        <p>Your resume preview will appear here.</p>
      </article>
    )
  const profile = page.profile
  const contact = [profile.location, profile.phone, profile.email].filter(Boolean)
  return (
    <article className="resume-page" ref={pageRef} aria-label="Resume preview">
      <header className="resumehead">
        <h1>{profile.name || 'Your Name'}</h1>
        {contact.length > 0 && <p>{contact.join(' | ')}</p>}
        {profile.links.length > 0 && (
          <p>
            {profile.links.map((link, index) => {
              const href = getResumeLinkHref(link.url)
              return (
                <Fragment key={link.id}>
                  {index > 0 && ' | '}
                  {href ? <a href={href}>{link.url}</a> : <span>{link.url}</span>}
                </Fragment>
              )
            })}
          </p>
        )}
      </header>
      {page.sections.map((section) => (
        <section className="resumesection" key={section.id}>
          <h2>{section.title}</h2>
          {section.items.map((item) => (
            <ResumeEntry
              key={item.id}
              item={item}
              format={
                section.type === 'custom'
                  ? (section.format ?? 'bullets')
                  : section.type === 'summary' || section.type === 'skills'
                    ? section.type
                    : 'bullets'
              }
            />
          ))}
        </section>
      ))}
    </article>
  )
}
