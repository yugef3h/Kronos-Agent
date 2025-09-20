export const buildKnowledgeDatasetPagePath = (datasetId?: string) => {
  const nextDatasetId = datasetId?.trim()
  if (!nextDatasetId)
    return '/rag'

  return `/rag?dataset=${encodeURIComponent(nextDatasetId)}`
}
