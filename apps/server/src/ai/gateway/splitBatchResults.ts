/** M-07: 批量响应按 section 拆条 */
export const splitBatchResults = (raw: string, ids: string[]): Record<string, string> => {
  const result: Record<string, string> = {};

  for (const id of ids) {
    const marker = `[${id}]`;
    const start = raw.indexOf(marker);
    if (start < 0) {
      result[id] = '';
      continue;
    }

    const bodyStart = start + marker.length;
    const nextMarkers = ids
      .filter((other) => other !== id)
      .map((other) => raw.indexOf(`[${other}]`, bodyStart))
      .filter((index) => index >= 0);
    const bodyEnd = nextMarkers.length ? Math.min(...nextMarkers) : raw.length;

    result[id] = raw.slice(bodyStart, bodyEnd).trim();
  }

  return result;
};
