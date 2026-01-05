const TAG_SEPARATOR_PATTERN = /[\n,，]+/

export const normalizeTagInput = (value: string) => value.trim().replace(/\s+/g, ' ')

export const appendTagItems = (currentTags: string[], rawValue: string) => {
  const seen = new Set<string>()
  const nextTags: string[] = []

  const pushTag = (candidate: string) => {
    const normalized = normalizeTagInput(candidate)
    const lookupKey = normalized.toLowerCase()
    if (!normalized || seen.has(lookupKey)) {
      return
    }

    seen.add(lookupKey)
    nextTags.push(normalized)
  }

  currentTags.forEach(pushTag)
  rawValue.split(TAG_SEPARATOR_PATTERN).forEach(pushTag)

  return nextTags
}