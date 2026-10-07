/** Normalize website links while refusing executable schemes and embedded credentials. */
export function getResumeLinkHref(value: string): string | null {
  const input = value.trim()
  if (!input || input.length > 2000 || /[\s\\]/.test(input)) return null
  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(input)
  if (hasScheme && !/^https?:\/\//i.test(input)) return null
  if (input.startsWith('//')) return null
  try {
    const url = new URL(hasScheme ? input : `https://${input}`)
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      !url.hostname ||
      url.username ||
      url.password
    )
      return null
    return url.href
  } catch {
    return null
  }
}
