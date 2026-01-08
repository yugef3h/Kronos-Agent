import { type ComponentType } from "react";
import { BlockEnum } from "./types/common";
import EndPanel from "./compts/end-panel";
import StartPanel from "./compts/start-panel";
import LLMPanel from "./compts/llm-panel";
import IfElsePanel from "./compts/ifelse-panel";
import LoopPanel from "./compts/loop-panel";
import IterationPanel from "./compts/iteration-panel";
import KnowledgeRetrievalPanel from "./compts/knowledge-retrieval-panel";
export {
  CUSTOM_EDGE,
  CUSTOM_NODE,
  CUSTOM_NOTE_NODE,
  CUSTOM_SIMPLE_NODE,
  ITERATION_CHILDREN_Z_INDEX,
  NODE_WIDTH,
  NODE_WIDTH_X_OFFSET,
  NODE_Y_OFFSET,
  SEARCH_BOX_MENU_Z_INDEX,
  SEARCH_BOX_NODE_Z_INDEX,
  START_INITIAL_POSITION,
  X_OFFSET,
} from "./layout-constants";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PanelComponentMap: Record<string, ComponentType<any>> = {
  [BlockEnum.Start]: StartPanel,
  [BlockEnum.End]: EndPanel,
  [BlockEnum.LLM]: LLMPanel,
  [BlockEnum.IfElse]: IfElsePanel,
  [BlockEnum.Loop]: LoopPanel,
  [BlockEnum.Iteration]: IterationPanel,
  [BlockEnum.KnowledgeRetrieval]: KnowledgeRetrievalPanel,
}