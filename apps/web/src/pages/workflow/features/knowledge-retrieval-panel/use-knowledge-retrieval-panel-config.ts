import { useMemo } from 'react'
import { produce } from 'immer'
import {
  createEmptyKnowledgeMetadataCondition,
  getKnowledgeMetadataFieldsIntersection,
  getKnowledgeSelectedDatasets,
  normalizeKnowledgeRetrievalNodeConfig,
  shouldShowKnowledgeAttachmentSelector,
  validateKnowledgeRetrievalNodeConfig,
} from './schema'
import type { KnowledgeDatasetDetail } from './types'
import type {
  KnowledgeMetadataCondition,
  KnowledgeMetadataFilteringMode,
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
  const metadataFields = useMemo(() => getKnowledgeMetadataFieldsIntersection(config.dataset_ids, datasets), [config.dataset_ids, datasets])
  const showImageQueryVarSelector = useMemo(
    () => shouldShowKnowledgeAttachmentSelector(config.dataset_ids, datasets),
    [config.dataset_ids, datasets],
  )
  const issues = useMemo(() => validateKnowledgeRetrievalNodeConfig(config, metadataFields), [config, metadataFields])

  const update = (recipe: (draft: KnowledgeRetrievalNodeConfig) => void) => {
    const nextValue = produce(config, recipe)

    if (!shouldShowKnowledgeAttachmentSelector(nextValue.dataset_ids, datasets)) {
      nextValue.query_attachment_selector = []
    }

    const nextMetadataFields = getKnowledgeMetadataFieldsIntersection(nextValue.dataset_ids, datasets)
    if (nextValue.metadata_filtering_mode === 'manual') {
      nextValue.metadata_filtering_conditions = nextValue.metadata_filtering_conditions.filter((condition) => {
        return nextMetadataFields.some(field => field.key === condition.field)
      })
    }

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

  const handleMetadataFilteringModeChange = (mode: KnowledgeMetadataFilteringMode) => {
    update((draft) => {
      draft.metadata_filtering_mode = mode
      if (mode === 'disabled')
        draft.metadata_filtering_conditions = []
    })
  }

  const handleAddMetadataCondition = () => {
    update((draft) => {
      draft.metadata_filtering_conditions.push(createEmptyKnowledgeMetadataCondition(metadataFields[0]?.key ?? ''))
    })
  }

  const handleUpdateMetadataCondition = (conditionId: string, patch: Partial<KnowledgeMetadataCondition>) => {
    update((draft) => {
      const condition = draft.metadata_filtering_conditions.find(item => item.id === conditionId)
      if (!condition)
        return

      Object.assign(condition, patch)
    })
  }

  const handleRemoveMetadataCondition = (conditionId: string) => {
    update((draft) => {
      draft.metadata_filtering_conditions = draft.metadata_filtering_conditions.filter(item => item.id !== conditionId)
    })
  }

  return {
    config,
    issues,
    selectedDatasets,
    metadataFields,
    showImageQueryVarSelector,
    handleQueryVariableChange,
    handleQueryAttachmentChange,
    handleDatasetToggle,
    handleRetrievalModeChange,
    handleSingleRetrievalConfigChange,
    handleMultipleRetrievalConfigChange,
    handleMetadataFilteringModeChange,
    handleAddMetadataCondition,
    handleUpdateMetadataCondition,
    handleRemoveMetadataCondition,
  }
}