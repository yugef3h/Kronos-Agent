import { type ComponentType } from "react";
import { BlockEnum } from "./types/common";
import EndPanel from "./compts/end-panel";
import StartPanel from "./compts/start-panel";
import LLMPanel from "./compts/llm-panel";
import IfElsePanel from "./compts/ifelse-panel";
import LoopPanel from "./compts/loop-panel";
import IterationPanel from "./compts/iteration-panel";
import KnowledgeRetrievalPanel from "./compts/knowledge-retrieval-panel";

export const NODE_WIDTH = 240;
export const X_OFFSET = 60;
export const NODE_WIDTH_X_OFFSET = NODE_WIDTH + X_OFFSET;
export const START_INITIAL_POSITION = { x: 80, y: 282 };
export const ITERATION_CHILDREN_Z_INDEX = 1002;
export const CUSTOM_EDGE = 'custom';
export const CUSTOM_NODE = 'custom';
export const CUSTOM_NOTE_NODE = 'custom-note';
export const CUSTOM_SIMPLE_NODE = 'custom-simple';

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