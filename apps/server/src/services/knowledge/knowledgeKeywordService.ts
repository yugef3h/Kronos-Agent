const ENGLISH_STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'are', 'was', 'were', 'have', 'has', 'had', 'will', 'would', 'shall', 'should', 'could', 'can', 'your', 'you', 'our', 'their', 'them', 'they', 'his', 'her', 'its', 'not', 'but', 'about', 'after', 'before', 'then', 'than', 'when', 'where', 'what', 'which', 'while', 'also', 'through', 'using', 'used', 'use', 'onto', 'over', 'under', 'each', 'per', 'via',
])

const CHINESE_STOP_WORDS = new Set([
  '我们', '你们', '他们', '以及', '或者', '如果', '因为', '所以', '需要', '可以', '进行', '已经', '当前', '这个', '那个', '一个', '一些', '没有', '不是', '然后', '其中', '相关', '通过', '根据', '用于', '支持', '文件', '文档', '内容', '说明', '处理', '操作', '系统', '页面', '这里', '那里', '本次', '导入', '知识库', '用户', '信息',
])

const normalizeKeyword = (value: string) => value.trim().replace(/\s+/g, ' ')

export const normalizeKeywords = (keywords: string[]) => {
  const seen = new Set<string>()
  const nextKeywords: string[] = []

  keywords.forEach((keyword) => {
    const normalized = normalizeKeyword(keyword)
    const lookupKey = normalized.toLowerCase()
    if (!normalized || seen.has(lookupKey)) {
      return
    }

    seen.add(lookupKey)
    nextKeywords.push(normalized)
  })

  return nextKeywords.slice(0, 12)
}

export const extractKnowledgeKeywords = (text: string, limit = 8) => {
  const candidateScores = new Map<string, { score: number; firstIndex: number; display: string }>()
  const normalizedText = text.replace(/\s+/g, ' ').trim()

  if (!normalizedText) {
    return []
  }

  const englishMatches = normalizedText.match(/[A-Za-z][A-Za-z0-9_-]{2,}/g) ?? []
  englishMatches.forEach((word, index) => {
    const lowered = word.toLowerCase()
    if (ENGLISH_STOP_WORDS.has(lowered)) {
      return
    }

    const existing = candidateScores.get(lowered)
    candidateScores.set(lowered, {
      score: (existing?.score ?? 0) + word.length + 2,
      firstIndex: existing?.firstIndex ?? index,
      display: existing?.display ?? word,
    })
  })

  const chineseMatches = normalizedText.match(/[\u4e00-\u9fff]{2,24}/g) ?? []
  chineseMatches.forEach((segment, index) => {
    const trimmed = segment.trim()
    if (CHINESE_STOP_WORDS.has(trimmed)) {
      return
    }

    const existing = candidateScores.get(trimmed)
    candidateScores.set(trimmed, {
      score: (existing?.score ?? 0) + trimmed.length + 3,
      firstIndex: existing?.firstIndex ?? englishMatches.length + index,
      display: trimmed,
    })
  })

  return normalizeKeywords(
    [...candidateScores.entries()]
      .sort((left, right) => {
        if (right[1].score === left[1].score) {
          return left[1].firstIndex - right[1].firstIndex
        }

        return right[1].score - left[1].score
      })
      .slice(0, limit)
      .map((item) => item[1].display),
  )
}