import { useMemo } from 'react'
import { produce } from 'immer'
import {
  getKnowledgeSelectedDatasets,
  normalizeKnowledgeRetrievalNodeConfig,
  shouldShowKnowledgeAttachmentSelector,
  syncKnowledgeTopK,
  validateKnowledgeRetrievalNodeConfig,
} from './schema'
import type { KnowledgeDatasetDetail } from './types'
import type {
  KnowledgeRetrievalMode,
  KnowledgeRetrievalNodeConfig,
} from './types'

type UseKnowledgeRetrievalPanelConfigOptions = {
  value: unknown
  onChange: (nextValue: KnowledgeRetrievalNodeConfig) => void
  datasets?: KnowledgeDatasetDetail[]
}

export const useKnowledgeRetrievalPanelConfig = ({ value, onChange, datasets }: UseKnowledgeRetrievalPanelConfigOptions) => {
  const config = useMemo(() => normalizeKnowledgeRetrievalNodeConfig(value), [value])
  const selectedDatasets = useMemo(() => getKnowledgeSelectedDatasets(config.dataset_ids, datasets), [config.dataset_ids, datasets])
  const showImageQueryVarSelector = useMemo(
    () => shouldShowKnowledgeAttachmentSelector(config.dataset_ids, datasets),
    [config.dataset_ids, datasets],
  )
  const issues = useMemo(() => validateKnowledgeRetrievalNodeConfig(config), [config])

  const update = (recipe: (draft: KnowledgeRetrievalNodeConfig) => void) => {
    const nextValue = produce(config, (draft) => {
      recipe(draft)

      if (!shouldShowKnowledgeAttachmentSelector(draft.dataset_ids, datasets)) {
        draft.query_attachment_selector = []
      }
    })

    onChange(nextValue)
  }

  const handleQueryVariableChange = (valueSelector: string[]) => {
    update((draft) => {
      draft.query_variable_selector = valueSelector
    })
  }

  const handleQueryAttachmentChange = (valueSelector: string[]) => {
    update((draft) => {
      draft.query_attachment_selector = valueSelector
    })
  }

  const handleDatasetToggle = (datasetId: string) => {
    update((draft) => {
      const exists = draft.dataset_ids.includes(datasetId)
      draft.dataset_ids = exists
        ? draft.dataset_ids.filter(id => id !== datasetId)
        : [...draft.dataset_ids, datasetId]
    })
  }

  const handleDatasetIdsChange = (datasetIds: string[]) => {
    update((draft) => {
      draft.dataset_ids = [...new Set(datasetIds)]
    })
  }

  const handleRetrievalModeChange = (mode: KnowledgeRetrievalMode) => {
    update((draft) => {
      draft.retrieval_mode = mode
    })
  }

  const handleSingleRetrievalConfigChange = (
    key: keyof KnowledgeRetrievalNodeConfig['single_retrieval_config'],
    value: string | number | null,
  ) => {
    update((draft) => {
      draft.single_retrieval_config[key] = value as never
    })
  }

  const handleMultipleRetrievalConfigChange = (
    key: keyof KnowledgeRetrievalNodeConfig['multiple_retrieval_config'],
    value: string | number | boolean | null,
  ) => {
    update((draft) => {
      draft.multiple_retrieval_config[key] = value as never
    })
  }

  const handleTopKChange = (value: number) => {
    onChange(syncKnowledgeTopK(config, value))
  }

  return {
    config,
    issues,
    selectedDatasets,
    showImageQueryVarSelector,
    handleQueryVariableChange,
    handleQueryAttachmentChange,
    handleDatasetIdsChange,
    handleDatasetToggle,
    handleRetrievalModeChange,
    handleTopKChange,
    handleSingleRetrievalConfigChange,
    handleMultipleRetrievalConfigChange,
  }
}