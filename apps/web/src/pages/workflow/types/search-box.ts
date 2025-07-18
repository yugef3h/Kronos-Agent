import type { ReactNode } from 'react'
import type { AppendableNodeKind } from './common'

export type NodeItem = {
  id: string
  name: string
  icon: ReactNode
  kind: AppendableNodeKind
}