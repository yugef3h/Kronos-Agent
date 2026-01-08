import { describe, expect, it } from '@jest/globals'
import {
  ITERATION_CHILDREN_Z_INDEX,
  PANEL_Z_INDEX,
  SEARCH_BOX_MENU_Z_INDEX,
  SEARCH_BOX_NODE_Z_INDEX,
} from './layout-constants'

describe('workflow layout z-index constants', () => {
  it('keeps the configuration panel above container nodes and menus', () => {
    expect(SEARCH_BOX_NODE_Z_INDEX).toBeGreaterThan(ITERATION_CHILDREN_Z_INDEX)
    expect(SEARCH_BOX_MENU_Z_INDEX).toBeGreaterThan(SEARCH_BOX_NODE_Z_INDEX)
    expect(PANEL_Z_INDEX).toBeGreaterThan(SEARCH_BOX_MENU_Z_INDEX)
  })
})