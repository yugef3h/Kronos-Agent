import type { Node } from 'reactflow'
import {
  memo,
  useMemo,
} from 'react'
import { PanelComponentMap } from '../constants'
import { resolvePanelBlockType } from '../utils/panel-resolver'

export type PanelProps = {
  type: Node['type']
  id: Node['id']
  data: Node['data']
}
export const Panel = memo((props: PanelProps) => {
  const PanelComponent = useMemo(() => {
    const blockType = resolvePanelBlockType(props.type, props.data)

    if (!blockType)
      return null

    return PanelComponentMap[blockType]
  }, [props.data, props.type])

  if (!PanelComponent)
    return null

  return <PanelComponent {...props} />
})

Panel.displayName = 'Panel'

export default memo(Panel)
