import { useEffect, useState } from 'react'
import { KNOWLEDGE_DATASET_CATALOG } from './catalog'
import type { KnowledgeDatasetDetail } from './types'

const KNOWLEDGE_DATASETS_STORAGE_KEY = 'kronos_workflow_knowledge_datasets_v1'
const KNOWLEDGE_DATASETS_UPDATED_EVENT = 'kronos:workflow:knowledge-datasets-updated'

const canUseLocalStorage = () => {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

const normalizeDataset = (value: unknown): KnowledgeDatasetDetail | null => {
  if (!value || typeof value !== 'object')
    return null

  const raw = value as Record<string, unknown>

  if (typeof raw.id !== 'string' || typeof raw.name !== 'string')
    return null

  return {
    id: raw.id,
    name: raw.name,
    description: typeof raw.description === 'string' ? raw.description : '',
    is_multimodal: Boolean(raw.is_multimodal),
    doc_metadata: Array.isArray(raw.doc_metadata)
      ? raw.doc_metadata
          .filter((item): item is { key: string; label: string } => {
            return Boolean(item && typeof item === 'object' && typeof (item as { key?: unknown }).key === 'string')
          })
          .map(item => ({
            key: item.key,
            label: typeof item.label === 'string' ? item.label : item.key,
          }))
      : [],
  }
}

export const listKnowledgeDatasets = (): KnowledgeDatasetDetail[] => {
  if (!canUseLocalStorage())
    return KNOWLEDGE_DATASET_CATALOG

  try {
    const raw = window.localStorage.getItem(KNOWLEDGE_DATASETS_STORAGE_KEY)
    if (!raw)
      return KNOWLEDGE_DATASET_CATALOG

    const parsed = JSON.parse(raw) as unknown[]
    if (!Array.isArray(parsed))
      return KNOWLEDGE_DATASET_CATALOG

    const normalized = parsed
      .map(item => normalizeDataset(item))
      .filter((item): item is KnowledgeDatasetDetail => item !== null)

    return normalized.length ? normalized : KNOWLEDGE_DATASET_CATALOG
  }
  catch {
    return KNOWLEDGE_DATASET_CATALOG
  }
}

export const ensureKnowledgeDatasetsSeeded = () => {
  if (!canUseLocalStorage())
    return KNOWLEDGE_DATASET_CATALOG

  const existing = listKnowledgeDatasets()
  if (existing.length)
    return existing

  window.localStorage.setItem(KNOWLEDGE_DATASETS_STORAGE_KEY, JSON.stringify(KNOWLEDGE_DATASET_CATALOG))
  return KNOWLEDGE_DATASET_CATALOG
}

export const getKnowledgeDatasetsByIds = (datasetIds: string[]) => {
  const idSet = new Set(datasetIds)
  return listKnowledgeDatasets().filter(dataset => idSet.has(dataset.id))
}

export const publishKnowledgeDatasetsUpdate = () => {
  if (typeof window === 'undefined')
    return

  window.dispatchEvent(new Event(KNOWLEDGE_DATASETS_UPDATED_EVENT))
}

export const useKnowledgeDatasets = () => {
  const [datasets, setDatasets] = useState<KnowledgeDatasetDetail[]>(() => ensureKnowledgeDatasetsSeeded())

  useEffect(() => {
    setDatasets(ensureKnowledgeDatasetsSeeded())

    const handleUpdate = () => setDatasets(listKnowledgeDatasets())

    window.addEventListener('storage', handleUpdate)
    window.addEventListener(KNOWLEDGE_DATASETS_UPDATED_EVENT, handleUpdate)

    return () => {
      window.removeEventListener('storage', handleUpdate)
      window.removeEventListener(KNOWLEDGE_DATASETS_UPDATED_EVENT, handleUpdate)
    }
  }, [])

  return datasets
}