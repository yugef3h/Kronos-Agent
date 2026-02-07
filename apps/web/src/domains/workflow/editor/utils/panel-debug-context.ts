export const parsePanelDebugContextJson = (
  raw: string,
): { ok: true; value: Record<string, unknown> } | { ok: false; message: string } => {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { ok: true, value: {} }
  }

  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { ok: false, message: 'Mock 上下文必须是 JSON 对象。' }
    }

    return { ok: true, value: parsed as Record<string, unknown> }
  } catch {
    return { ok: false, message: 'Mock 上下文 JSON 格式无效。' }
  }
}
