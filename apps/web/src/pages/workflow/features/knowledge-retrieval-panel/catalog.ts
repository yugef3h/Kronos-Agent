import type { KnowledgeDatasetDetail } from './types'

export const KNOWLEDGE_DATASET_CATALOG: KnowledgeDatasetDetail[] = [
  {
    id: 'support-center',
    name: '帮助中心',
    description: 'FAQ、操作说明与客服知识。',
    is_multimodal: false,
    doc_metadata: [
      { key: 'category', label: '分类' },
      { key: 'language', label: '语言' },
      { key: 'channel', label: '渠道' },
    ],
  },
  {
    id: 'operations-manual',
    name: '运营手册',
    description: 'SOP、流程节点说明与内部规范。',
    is_multimodal: false,
    doc_metadata: [
      { key: 'category', label: '分类' },
      { key: 'language', label: '语言' },
      { key: 'channel', label: '渠道' },
    ],
  },
  {
    id: 'catalog-gallery',
    name: '商品图谱',
    description: '图文混合的商品卡、图册与属性库。',
    is_multimodal: true,
    doc_metadata: [
      { key: 'category', label: '分类' },
      { key: 'language', label: '语言' },
      { key: 'brand', label: '品牌' },
    ],
  },
  {
    id: 'policy-library',
    name: '政策文档',
    description: '政策、条款与制度类文本库。',
    is_multimodal: false,
    doc_metadata: [
      { key: 'category', label: '分类' },
      { key: 'language', label: '语言' },
      { key: 'effective_at', label: '生效时间' },
    ],
  },
]

export const KNOWLEDGE_ONE_WAY_MODEL_OPTIONS = [
  { label: '默认向量检索', value: 'default-vector' },
  { label: '高精度向量检索', value: 'accurate-vector' },
]

export const KNOWLEDGE_RERANK_MODEL_OPTIONS = [
  { label: '默认 Rerank', value: 'default-rerank' },
  { label: '高精度 Rerank', value: 'accurate-rerank' },
]