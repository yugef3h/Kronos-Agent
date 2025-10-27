import { useCallback, useEffect, useState } from 'react'
import {
  requestCreateKnowledgeDataset,
  requestDeleteKnowledgeDataset,
  requestDevToken,
  requestKnowledgeDatasets,
  requestUpdateKnowledgeDataset,
  type KnowledgeDatasetMutationInput,
  type KnowledgeDatasetResponseItem,
} from '../../../../lib/api'
import { usePlaygroundStore } from '../../../../store/playgroundStore'
import type { KnowledgeDatasetDetail, KnowledgeMetadataField } from './types'

const KNOWLEDGE_DATASETS_UPDATED_EVENT = 'kronos:workflow:knowledge-datasets-updated'
const KNOWLEDGE_DATASETS_UPDATED_AT_STORAGE_KEY = 'kronos:workflow:knowledge-datasets-updated-at'
const KNOWLEDGE_DATASET_AUTH_ERROR = '知识库接口需要 JWT 鉴权'

let knowledgeDatasetCache: KnowledgeDatasetDetail[] = []
let authTokenRequest: Promise<string> | null = null

const cloneMetadataFields = (fields: KnowledgeMetadataField[]) => {
  return fields.map(field => ({ ...field }))
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
    documentExtensions: Array.isArray(raw.documentExtensions)
      ? raw.documentExtensions.filter((item): item is string => typeof item === 'string')
      : [],
    indexing_technique: raw.indexing_technique === 'economy' ? 'economy' : 'high_quality',
    embedding_model: typeof raw.embedding_model === 'string' ? raw.embedding_model : 'default-embedding',
    embedding_model_provider: typeof raw.embedding_model_provider === 'string' ? raw.embedding_model_provider : 'default',
    retrieval_model: raw.retrieval_model && typeof raw.retrieval_model === 'object'
      ? raw.retrieval_model as KnowledgeDatasetDetail['retrieval_model']
      : undefined,
    process_rule: raw.process_rule && typeof raw.process_rule === 'object'
      ? raw.process_rule as KnowledgeDatasetDetail['process_rule']
      : undefined,
    summary_index_setting: raw.summary_index_setting && typeof raw.summary_index_setting === 'object'
      ? raw.summary_index_setting as KnowledgeDatasetDetail['summary_index_setting']
      : undefined,
    doc_form: raw.doc_form === 'qa_model' || raw.doc_form === 'hierarchical_model' ? raw.doc_form : 'text_model',
    doc_language: typeof raw.doc_language === 'string' ? raw.doc_language : 'Chinese Simplified',
    documentCount: typeof raw.documentCount === 'number' ? raw.documentCount : undefined,
    chunkCount: typeof raw.chunkCount === 'number' ? raw.chunkCount : undefined,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : undefined,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : undefined,
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

const cloneDataset = (dataset: KnowledgeDatasetDetail): KnowledgeDatasetDetail => ({
  ...dataset,
  doc_metadata: cloneMetadataFields(dataset.doc_metadata),
  documentExtensions: [...(dataset.documentExtensions ?? [])],
})

const sortDatasets = (datasets: KnowledgeDatasetDetail[]) => {
  return [...datasets].sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
}

const buildDatasetSignature = (datasets: KnowledgeDatasetDetail[]) => {
  return JSON.stringify(sortDatasets(datasets).map(dataset => ({
    id: dataset.id,
    name: dataset.name,
    description: dataset.description,
    is_multimodal: dataset.is_multimodal,
    indexing_technique: dataset.indexing_technique,
    embedding_model: dataset.embedding_model,
    embedding_model_provider: dataset.embedding_model_provider,
    retrieval_model: dataset.retrieval_model,
    process_rule: dataset.process_rule,
    summary_index_setting: dataset.summary_index_setting,
    doc_form: dataset.doc_form,
    doc_language: dataset.doc_language,
    documentCount: dataset.documentCount ?? 0,
    chunkCount: dataset.chunkCount ?? 0,
    documentExtensions: dataset.documentExtensions ?? [],
    updatedAt: dataset.updatedAt ?? 0,
    doc_metadata: dataset.doc_metadata,
  })))
}

const publishKnowledgeDatasetsUpdate = () => {
  if (typeof window === 'undefined')
    return

  try {
    window.localStorage.setItem(KNOWLEDGE_DATASETS_UPDATED_AT_STORAGE_KEY, String(Date.now()))
  }
  catch {
    // Ignore localStorage failures and keep same-tab updates working.
  }

  window.dispatchEvent(new Event(KNOWLEDGE_DATASETS_UPDATED_EVENT))
}

const setKnowledgeDatasetCache = (datasets: KnowledgeDatasetDetail[]) => {
  const normalized = datasets
    .map(dataset => normalizeDataset(dataset))
    .filter((dataset): dataset is KnowledgeDatasetDetail => dataset !== null)

  const nextDatasets = sortDatasets(normalized)
  if (buildDatasetSignature(knowledgeDatasetCache) === buildDatasetSignature(nextDatasets)) {
    return listKnowledgeDatasets()
  }

  knowledgeDatasetCache = nextDatasets.map(cloneDataset)
  publishKnowledgeDatasetsUpdate()
  return listKnowledgeDatasets()
}

const normalizeKnowledgeDatasetsResponse = (items: KnowledgeDatasetResponseItem[]) => {
  return setKnowledgeDatasetCache(items)
}

const getErrorMessage = (error: unknown, fallback: string) => {
  return error instanceof Error && error.message.trim() ? error.message : fallback
}

export const ensureKnowledgeDatasetAuthToken = async () => {
  const currentToken = usePlaygroundStore.getState().authToken.trim()
  if (currentToken) {
    return currentToken
  }

  if (!authTokenRequest) {
    authTokenRequest = requestDevToken()
      .then((result: { token: string }) => {
        usePlaygroundStore.getState().setAuthToken(result.token)
        return result.token
      })
      .catch(() => '')
      .finally(() => {
        authTokenRequest = null
      })
  }

  const token = await authTokenRequest
  return (token || '').trim()
}

const fetchKnowledgeDatasets = async () => {
  const authToken = await ensureKnowledgeDatasetAuthToken()
  if (!authToken) {
    throw new Error(KNOWLEDGE_DATASET_AUTH_ERROR)
  }

  const response = await requestKnowledgeDatasets({ authToken })
  return normalizeKnowledgeDatasetsResponse(response.items)
}

const createRemoteKnowledgeDataset = async (input: KnowledgeDatasetMutationInput) => {
  const authToken = await ensureKnowledgeDatasetAuthToken()
  if (!authToken) {
    throw new Error(KNOWLEDGE_DATASET_AUTH_ERROR)
  }

  const response = await requestCreateKnowledgeDataset({ authToken, input })
  const nextItem = normalizeDataset(response.item)
  if (!nextItem) {
    throw new Error('知识库创建返回了无效数据')
  }

  setKnowledgeDatasetCache([...listKnowledgeDatasets().filter(dataset => dataset.id !== nextItem.id), nextItem])
  return nextItem
}

const updateRemoteKnowledgeDataset = async (datasetId: string, input: KnowledgeDatasetMutationInput) => {
  const authToken = await ensureKnowledgeDatasetAuthToken()
  if (!authToken) {
    throw new Error(KNOWLEDGE_DATASET_AUTH_ERROR)
  }

  const response = await requestUpdateKnowledgeDataset({ authToken, datasetId, input })
  const nextItem = normalizeDataset(response.item)
  if (!nextItem) {
    throw new Error('知识库更新返回了无效数据')
  }

  setKnowledgeDatasetCache([...listKnowledgeDatasets().filter(dataset => dataset.id !== nextItem.id), nextItem])
  return nextItem
}

const deleteRemoteKnowledgeDataset = async (datasetId: string) => {
  const authToken = await ensureKnowledgeDatasetAuthToken()
  if (!authToken) {
    throw new Error(KNOWLEDGE_DATASET_AUTH_ERROR)
  }

  await requestDeleteKnowledgeDataset({ authToken, datasetId })
  setKnowledgeDatasetCache(listKnowledgeDatasets().filter(dataset => dataset.id !== datasetId))
}

export const listKnowledgeDatasets = (): KnowledgeDatasetDetail[] => {
  return knowledgeDatasetCache.map(cloneDataset)
}

export const getKnowledgeDatasetsByIds = (datasetIds: string[]) => {
  const idSet = new Set(datasetIds)
  return listKnowledgeDatasets().filter(dataset => idSet.has(dataset.id))
}

export const useKnowledgeDatasets = () => {
  const [datasets, setDatasets] = useState<KnowledgeDatasetDetail[]>(() => listKnowledgeDatasets())
  const [isLoading, setIsLoading] = useState(false)
  const [isMutating, setIsMutating] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const syncFromCache = useCallback(() => {
    setDatasets(listKnowledgeDatasets())
  }, [])

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage('')

    try {
      const nextDatasets = await fetchKnowledgeDatasets()
      setDatasets(nextDatasets)
      return nextDatasets
    }
    catch (error) {
      const fallback = listKnowledgeDatasets()
      setDatasets(fallback)
      setErrorMessage(getErrorMessage(error, '知识库列表加载失败'))
      return fallback
    }
    finally {
      setIsLoading(false)
    }
  }, [])

  const createDataset = useCallback(async (input: KnowledgeDatasetMutationInput) => {
    setIsMutating(true)
    setErrorMessage('')

    try {
      const nextDataset = await createRemoteKnowledgeDataset(input)
      setDatasets(listKnowledgeDatasets())
      return nextDataset
    }
    catch (error) {
      const message = getErrorMessage(error, '知识库创建失败')
      setErrorMessage(message)
      throw new Error(message)
    }
    finally {
      setIsMutating(false)
    }
  }, [])

  const updateDataset = useCallback(async (datasetId: string, input: KnowledgeDatasetMutationInput) => {
    setIsMutating(true)
    setErrorMessage('')

    try {
      const nextDataset = await updateRemoteKnowledgeDataset(datasetId, input)
      setDatasets(listKnowledgeDatasets())
      return nextDataset
    }
    catch (error) {
      const message = getErrorMessage(error, '知识库更新失败')
      setErrorMessage(message)
      throw new Error(message)
    }
    finally {
      setIsMutating(false)
    }
  }, [])

  const deleteDataset = useCallback(async (datasetId: string) => {
    setIsMutating(true)
    setErrorMessage('')

    try {
      await deleteRemoteKnowledgeDataset(datasetId)
      setDatasets(listKnowledgeDatasets())
    }
    catch (error) {
      const message = getErrorMessage(error, '知识库删除失败')
      setErrorMessage(message)
      throw new Error(message)
    }
    finally {
      setIsMutating(false)
    }
  }, [])

  useEffect(() => {
    syncFromCache()
    void refresh()

    if (typeof window === 'undefined')
      return undefined

    const handleUpdate = () => syncFromCache()
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== KNOWLEDGE_DATASETS_UPDATED_AT_STORAGE_KEY || !event.newValue)
        return

      void refresh()
    }

    window.addEventListener(KNOWLEDGE_DATASETS_UPDATED_EVENT, handleUpdate)
    window.addEventListener('storage', handleStorage)

    return () => {
      window.removeEventListener(KNOWLEDGE_DATASETS_UPDATED_EVENT, handleUpdate)
      window.removeEventListener('storage', handleStorage)
    }
  }, [refresh, syncFromCache])

  return {
    datasets,
    isLoading,
    isMutating,
    errorMessage,
    refresh,
    createDataset,
    updateDataset,
    deleteDataset,
  }
}
