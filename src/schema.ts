import { z } from 'zod'
import { getResumeLinkHref } from './resumeLinks'

export const MAX_BACKUP_BYTES = 1024 * 1024
const idSchema = z.string().max(128)
const shortText = z.string().max(500)

export const bulletSchema = z.object({
  id: idSchema,
  text: z.string().max(10000),
  tags: z.array(z.string().max(100)).max(30).default([]),
})
export const itemSchema = z.object({
  id: idSchema,
  heading: shortText,
  subheading: shortText.optional(),
  location: shortText.optional(),
  dateStart: shortText.optional(),
  dateEnd: shortText.optional(),
  bullets: z.array(bulletSchema).max(100),
})
export const sectionFormatSchema = z.enum(['bullets', 'skills', 'summary'])
export const sectionSchema = z.object({
  id: idSchema,
  type: z.enum(['summary', 'experience', 'projects', 'education', 'skills', 'custom']),
  title: shortText,
  format: sectionFormatSchema.optional(),
  items: z.array(itemSchema).max(100),
})
export const resumeSchema = z.object({
  app: z.literal('resume-tailor'),
  version: z.number(),
  master: z.object({
    profile: z.object({
      name: shortText,
      email: shortText,
      phone: shortText.optional(),
      location: shortText.optional(),
      links: z
        .array(
          z.object({
            id: idSchema,
            label: shortText,
            url: z
              .string()
              .max(2000)
              .refine((value) => getResumeLinkHref(value) !== null, {
                message:
                  'Links must be valid HTTP or HTTPS website URLs without embedded credentials.',
              }),
          }),
        )
        .max(20),
    }),
    sections: z
      .array(sectionSchema)
      .max(30)
      .superRefine((sections, context) => {
        const items = sections.flatMap((section) => section.items)
        const bulletCount = items.reduce((count, item) => count + item.bullets.length, 0)
        if (items.length > 200 || bulletCount > 1000)
          context.addIssue({
            code: 'custom',
            message: 'Backups support up to 200 items and 1,000 bullets.',
          })
      }),
  }),
  variants: z
    .array(
      z.object({
        id: idSchema,
        name: shortText,
        excluded: z.array(idSchema).max(2000),
      }),
    )
    .max(50),
  activeVariantId: idSchema,
})
export type ResumeFile = z.infer<typeof resumeSchema>
export type Section = ResumeFile['master']['sections'][number]
export type Item = Section['items'][number]
export type Bullet = Item['bullets'][number]
