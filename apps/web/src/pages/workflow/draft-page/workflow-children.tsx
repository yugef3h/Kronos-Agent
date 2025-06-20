import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  SelectionMode,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Node,
  type NodeProps,
} from 'reactflow';
import { useSearchParams } from 'react-router-dom';
import { getWorkflowAppById, updateWorkflowAppDsl } from '../../../features/workflow/workflowAppStore';
import {
  CUSTOM_EDGE,
  ITERATION_CHILDREN_Z_INDEX,
  NODE_WIDTH,
  NODE_WIDTH_X_OFFSET,
} from '../constants';
import CustomEdge from '../compts/custom-edge';
import { EmptyView } from '../compts/empty-view';
import { type NodeItem, SearchBox } from '../compts/search-box';
import {
  type AppendableNodeKind,
  BlockEnum,
  type CommonEdgeType,
  type Edge,
} from '../types/common';
import type { CanvasNodeData } from '../types/canvas';
import {
  applyConnectedEdgeSelection,
  applyNodeSelection,
  removeConnectedEdges,
  removeNodeById,
} from '../hooks/node-selection';
import { createWorkflowEdgeData } from '../utils/edge-data';
import {
  buildCanvasNodeData,
  createInitialTriggerNode,
  createWorkflowDslFromCanvas,
  hydrateCanvasNodesFromDsl,
} from '../utils/workflow-dsl';
import { useNodesInteractions } from '../hooks/use-nodes-interactions';
import Panel from '../compts/panel';
import NodeControl from '../compts/node-control';
import { IconCondition } from '../assets/condition';
import type { VariableOption } from '../features/llm-panel/types';
import {
  buildIfElseConditionSummary,
  buildIfElseTargetBranches,
  normalizeIfElseNodeConfig,
  resolveIfElseVariableLabel,
} from '../features/ifelse-panel/schema';
import {
  buildIterationChildren,
  normalizeIterationNodeConfig,
} from '../features/iteration-panel/schema';
import { getKnowledgeDatasetsByIds, useKnowledgeDatasets } from '../features/knowledge-retrieval-panel/dataset-store';
import {
  buildLoopBreakSummary,
  buildLoopChildren,
  normalizeLoopNodeConfig,
} from '../features/loop-panel/schema';
import { buildWorkflowVariableOptions } from '../utils/variable-options';
import 'reactflow/dist/style.css';

const CANVAS_NODE_KIND_TO_BLOCK: Record<AppendableNodeKind, BlockEnum> = {
  trigger: BlockEnum.Start,
  end: BlockEnum.End,
  llm: BlockEnum.LLM,
  knowledge: BlockEnum.KnowledgeRetrieval,
  condition: BlockEnum.IfElse,
  iteration: BlockEnum.Iteration,
  loop: BlockEnum.Loop,
};

const createNodeId = (kind: AppendableNodeKind): string => {
  const random = Math.random().toString(36).slice(2, 7);
  return `${kind}-${Date.now().toString(36)}-${random}`;
};

const createNodeData = (node: NodeItem, nodeId: string): CanvasNodeData => {
  return buildCanvasNodeData({
    nodeId,
    kind: node.kind,
    title: node.name,
    subtitle: node.id,
  });
};

const createNodeFromSource = (
  sourceNode: Node<CanvasNodeData>,
  node: NodeItem,
  index: number,
): Node<CanvasNodeData> => {
  const x = sourceNode.position.x + NODE_WIDTH_X_OFFSET;
  const y = sourceNode.position.y + index * 120;
  const nextNodeId = createNodeId(node.kind);

  return {
    id: nextNodeId,
    type: 'workflow',
    position: { x, y },
    data: createNodeData(node, nextNodeId),
  };
};

const areStringArraysEqual = (left: string[] = [], right: string[] = []) => {
  if (left.length !== right.length)
    return false;

  return left.every((item, index) => item === right[index]);
};

const getKnowledgeDatasetIds = (nodeData: CanvasNodeData) => {
  const datasetIds = (nodeData.inputs as { dataset_ids?: unknown } | undefined)?.dataset_ids;
  if (!Array.isArray(datasetIds)) {
    return [];
  }

  return datasetIds.filter((item): item is string => typeof item === 'string');
};

const areKnowledgeDatasetsEqual = (
  left: CanvasNodeData['_datasets'] = [],
  right: CanvasNodeData['_datasets'] = [],
) => {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((dataset, index) => {
    const target = right[index];
    return dataset.id === target?.id
      && dataset.name === target.name
      && dataset.updatedAt === target.updatedAt;
  });
};

const areContainerChildrenEqual = (
  left: CanvasNodeData['_children'] = [],
  right: CanvasNodeData['_children'] = [],
) => {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((child, index) => {
    const target = right[index];
    return child.nodeId === target?.nodeId && child.nodeType === target.nodeType;
  });
};

const buildConditionNodeVariableOptions = (
  currentNodeId: string,
  nodes: Array<{ id: string; data: CanvasNodeData }>,
) : VariableOption[] => {
  return buildWorkflowVariableOptions(currentNodeId, nodes);
};

const WorkflowNode = ({ id, data }: NodeProps<CanvasNodeData>) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [appendSourceHandle, setAppendSourceHandle] = useState<string>('out');
  const menuRef = useRef<HTMLDivElement>(null);
  const { setNodes, setEdges, getNode, getEdges, getNodes } = useReactFlow<CanvasNodeData, Edge>();
  const canAppend = data.kind !== 'end';
  const conditionConfig = useMemo(() => {
    if (data.kind !== 'condition') {
      return null;
    }

    return normalizeIfElseNodeConfig(data.inputs);
  }, [data.inputs, data.kind]);
  const conditionBranches = useMemo(() => {
    if (data.kind !== 'condition') {
      return [];
    }

    return data._targetBranches ?? buildIfElseTargetBranches(conditionConfig?.cases ?? []);
  }, [conditionConfig?.cases, data._targetBranches, data.kind]);
  const conditionVariableOptions = useMemo(() => {
    if (data.kind !== 'condition') {
      return [];
    }

    return buildConditionNodeVariableOptions(
      id,
      getNodes().map(node => ({ id: node.id, data: node.data })),
    );
  }, [data.kind, getNodes, id]);
  const workflowVariableOptions = useMemo(() => {
    if (data.kind !== 'iteration' && data.kind !== 'loop') {
      return [];
    }

    return buildWorkflowVariableOptions(
      id,
      getNodes().map(node => ({ id: node.id, data: node.data })),
    );
  }, [data.kind, getNodes, id]);
  const iterationConfig = useMemo(() => {
    if (data.kind !== 'iteration') {
      return null;
    }

    return normalizeIterationNodeConfig(data.inputs, id);
  }, [data.inputs, data.kind, id]);
  const loopConfig = useMemo(() => {
    if (data.kind !== 'loop') {
      return null;
    }

    return normalizeLoopNodeConfig(data.inputs, id);
  }, [data.inputs, data.kind, id]);
  const iterationSummary = useMemo(() => {
    if (!iterationConfig) {
      return null;
    }

    return {
      iterator: iterationConfig.iterator_selector.length
        ? resolveIfElseVariableLabel(iterationConfig.iterator_selector, workflowVariableOptions)
        : '未选择数组变量',
      mode: iterationConfig.is_parallel ? `并行 x${iterationConfig.parallel_nums}` : '串行执行',
      output: iterationConfig.output_selector.length
        ? resolveIfElseVariableLabel(iterationConfig.output_selector, [
            {
              label: 'current.item',
              valueSelector: [id, 'item'],
              valueType: 'object',
              source: 'node',
            },
            {
              label: 'current.index',
              valueSelector: [id, 'index'],
              valueType: 'number',
              source: 'node',
            },
            ...workflowVariableOptions,
          ])
        : '未配置聚合输出',
    };
  }, [id, iterationConfig, workflowVariableOptions]);
  const loopVariableOptions = useMemo(() => {
    if (!loopConfig) {
      return [];
    }

    return loopConfig.loop_variables
      .filter(loopVariable => loopVariable.label.trim())
      .map<VariableOption>((loopVariable) => ({
        label: `loop.${loopVariable.label.trim()}`,
        valueSelector: [id, loopVariable.label.trim()],
        valueType: loopVariable.var_type,
        source: 'node',
      }));
  }, [id, loopConfig]);
  const loopSummary = useMemo(() => {
    if (!loopConfig) {
      return null;
    }

    return {
      count: `${loopConfig.loop_count} 轮上限`,
      variables: `${loopConfig.loop_variables.length} 个上下文变量`,
      condition: loopConfig.break_conditions[0]
        ? buildLoopBreakSummary(loopConfig.break_conditions[0], [...loopVariableOptions, ...workflowVariableOptions])
        : '未配置 break 条件',
    };
  }, [loopConfig, loopVariableOptions, workflowVariableOptions]);
  const primaryConditionSummary = useMemo(() => {
    if (!conditionConfig?.cases[0]?.conditions.length) {
      return '添加条件后，这里会显示 IF 分支摘要';
    }

    return buildIfElseConditionSummary(conditionConfig.cases[0].conditions[0], conditionVariableOptions);
  }, [conditionConfig, conditionVariableOptions]);
  const connectedSourceHandleIds = data._connectedSourceHandleIds ?? [];

  const appendNode = useCallback(
    (node: NodeItem, sourceHandle = 'out') => {
      const sourceNode = getNode(id);
      if (!sourceNode) {
        return;
      }

       if (sourceNode.data.kind === 'condition') {
        const hasExistingBranchEdge = getEdges().some(
          (edge) => edge.source === id && edge.sourceHandle === sourceHandle,
        );
        if (hasExistingBranchEdge) {
          setMenuOpen(false);
          return;
        }
      }

      const childCount = getEdges().filter((edge) => edge.source === id).length;
      const nextNode = createNodeFromSource(sourceNode, node, childCount);
      const edgeId = `${id}-${sourceHandle}-${nextNode.id}-in`;
      const nextEdge = {
        id: edgeId,
        type: CUSTOM_EDGE,
        source: id,
        target: nextNode.id,
        sourceHandle,
        targetHandle: 'in',
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#94a3b8',
        },
        style: {
          stroke: '#94a3b8',
          strokeWidth: 1.6,
        },
        data: createWorkflowEdgeData({
          sourceType: CANVAS_NODE_KIND_TO_BLOCK[sourceNode.data.kind],
          targetType: CANVAS_NODE_KIND_TO_BLOCK[nextNode.data.kind],
        }),
      };

      setNodes((nodes) => applyNodeSelection([...nodes, nextNode], nextNode.id));
      setEdges((edges) => applyConnectedEdgeSelection(addEdge(nextEdge, edges), nextNode.id));

      setMenuOpen(false);
      setAppendSourceHandle('out');
    },
    [getEdges, getNode, id, setEdges, setNodes],
  );

  const deleteNode = useCallback(() => {
    setMenuOpen(false);
    setNodes((currentNodes) => removeNodeById(currentNodes, id));
    setEdges((currentEdges) => removeConnectedEdges(currentEdges, id));
  }, [id, setEdges, setNodes]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as HTMLDivElement)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener('click', handleClickOutside);

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  return (
    <div
      className={`group relative bg-white transition ${data.kind === 'condition'
        ? `rounded-[24px] border-[2px] px-4 py-4 shadow-[0_14px_32px_-28px_rgba(37,99,235,0.42)] ${data.selected ? 'border-blue-600' : 'border-blue-500'}`
        : `rounded-2xl border px-4 py-3 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.55)] ${data.selected ? 'border-components-option-card-option-selected-border' : 'border-slate-200 hover:border-blue-300'}`}`}
      style={{ width: NODE_WIDTH, minWidth: NODE_WIDTH, maxWidth: NODE_WIDTH }}
    >
      {data.kind !== 'trigger' ? (
        <Handle
          id="in"
          type="target"
          position={Position.Left}
          className={`!h-2.5 !w-2.5 !border-2 !border-white !bg-blue-500 ${data.kind === 'condition' ? '!left-[-7px]' : ''}`}
        />
      ) : null}
      {data.kind !== 'end' && data.kind !== 'condition' ? (
        <Handle
          id="out"
          type="source"
          position={Position.Right}
          className="!h-2.5 !w-2.5 !border-2 !border-white !bg-blue-500"
        />
      ) : null}

      {data.kind === 'condition' ? (
        <div>
          <div className="flex items-center gap-3 pr-8">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] bg-[#16b5d8] text-white shadow-[0_10px_20px_-18px_rgba(8,145,178,0.9)]">
              <IconCondition />
            </div>
            <div className="min-w-0 pt-0.5">
              <p className="text-[16px] font-semibold tracking-[0.01em] text-slate-900">{data.title}</p>
            </div>
          </div>

          <div className="mt-[-6px] space-y-1.5">
            {conditionBranches.map((branch, index) => {
              const isConnected = connectedSourceHandleIds.includes(branch.id);
              const isElseBranch = branch.id === 'false';
              const branchCase = isElseBranch
                ? null
                : conditionConfig?.cases.find(caseItem => caseItem.case_id === branch.id);
              const branchSummary = isElseBranch
                ? '未命中其他条件时执行'
                : branchCase?.conditions[0]
                  ? buildIfElseConditionSummary(branchCase.conditions[0], conditionVariableOptions)
                  : index === 0
                    ? primaryConditionSummary
                    : '未设置条件';

              return (
                <div
                  key={branch.id}
                  className={`relative ${isElseBranch ? 'min-h-[24px]' : 'min-h-[58px]'}`}
                >
                  {!isElseBranch ? (
                    <div>
                      <div className="mb-4 min-h-[18px]" />
                      <div className="rounded-xl bg-[#f5f7fb] shadow-[inset_0_0_0_1px_rgba(226,232,240,0.7)]">
                        <div className="flex min-h-[34px] items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-medium text-slate-700 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9)]">
                          <span className="line-clamp-1">{branchSummary}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-6" />
                  )}

                  {isElseBranch ? (
                    <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] font-semibold tracking-[0.01em] text-slate-700">
                      {branch.name}
                    </span>
                  ) : (
                    <span className="absolute right-1 top-[14px] text-[10px] font-semibold tracking-[0.01em] text-slate-700">
                      {branch.name}
                    </span>
                  )}

                  <div className={`absolute right-[-16px] h-0 w-0 overflow-visible ${isElseBranch ? 'top-1/2 -translate-y-1/2' : 'top-[9px]'}`}>
                    <Handle
                      id={branch.id}
                      type="source"
                      position={Position.Right}
                      className={`!right-0 !h-6 !w-6 !translate-x-1/2 !rounded-full !border-2 !border-white !bg-blue-600 !opacity-100 ${isElseBranch ? '!top-1/2 !-translate-y-1/2' : '!top-0 !translate-y-0'}`}
                    />
                    <button
                      type="button"
                      disabled={isConnected}
                      className={`absolute left-0 z-10 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border-2 border-white bg-blue-600 text-[14px] leading-none text-white shadow-[0_8px_16px_-14px_rgba(37,99,235,1)] transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300 ${isElseBranch ? 'top-1/2 -translate-y-1/2' : 'top-0 -translate-y-0'}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setAppendSourceHandle(branch.id);
                        setMenuOpen((prev) => !prev || appendSourceHandle !== branch.id);
                      }}
                    >
                      +
                    </button>

                    {menuOpen && appendSourceHandle === branch.id ? (
                      <SearchBox
                        isOpen={menuOpen}
                        onClose={() => setMenuOpen(false)}
                        onAppendNode={(node) => appendNode(node, appendSourceHandle)}
                        menuRef={menuRef}
                        preferredSide="right"
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {conditionConfig?.cases.slice(1).length ? (
            <div className="mt-1.5 pr-8 text-[10px] text-slate-400">
              {`含 ${conditionConfig.cases.length - 1} 个额外 ELIF 分支`}
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <p className="text-xs font-semibold text-slate-500">{data.subtitle}</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{data.title}</p>
          {data.kind === 'knowledge' && data._datasets?.length ? (
            <div className="mt-2 space-y-1">
              {data._datasets.slice(0, 2).map(dataset => (
                <div
                  key={dataset.id}
                  className="rounded-lg bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9)]"
                >
                  <span className="line-clamp-1">{dataset.name}</span>
                </div>
              ))}
              {data._datasets.length > 2 ? (
                <p className="text-[10px] text-slate-400">+{data._datasets.length - 2} 个知识库</p>
              ) : null}
            </div>
          ) : null}
          {data.kind === 'iteration' && iterationSummary ? (
            <div className="mt-2 space-y-1">
              <div className="rounded-lg bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9)]">
                <span className="line-clamp-1">{iterationSummary.iterator}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                <span>{iterationSummary.mode}</span>
                <span>•</span>
                <span className="line-clamp-1">{iterationSummary.output}</span>
              </div>
            </div>
          ) : null}
          {data.kind === 'loop' && loopSummary ? (
            <div className="mt-2 space-y-1">
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9)]">{loopSummary.count}</span>
                <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9)]">{loopSummary.variables}</span>
              </div>
              <div className="rounded-lg bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9)]">
                <span className="line-clamp-1">{loopSummary.condition}</span>
              </div>
            </div>
          ) : null}
        </>
      )}

      <NodeControl id={id} isActive={!!data.selected} onDelete={deleteNode} />

      {canAppend && data.kind !== 'condition' ? (
        <div className="absolute -right-3 top-1/2 -translate-y-1/2">
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded-full border border-blue-200 bg-white text-lg text-blue-600 opacity-0 shadow-sm transition group-hover:opacity-100 hover:bg-blue-50"
            onClick={(event) => {
              event.stopPropagation();
              setAppendSourceHandle('out');
              setMenuOpen((prev) => !prev);
            }}
          >
            +
          </button>

          <SearchBox
            isOpen={menuOpen}
            onClose={() => setMenuOpen(false)}
            onAppendNode={(node) => appendNode(node, appendSourceHandle)}
            menuRef={menuRef}
          />
        </div>
      ) : null}

    </div>
  );
};

const nodeTypes = {
  workflow: WorkflowNode,
};

const edgeTypes = {
  [CUSTOM_EDGE]: CustomEdge,
};

export const WorkflowChildren = () => {
  const [searchParams] = useSearchParams();
  const appId = searchParams.get('appId');
  const { datasets } = useKnowledgeDatasets();

  const initialNodes = useMemo<Node<CanvasNodeData>[]>(() => {
    if (!appId)
      return [createInitialTriggerNode()]

    const app = getWorkflowAppById(appId)
    if (!app)
      return [createInitialTriggerNode()]

    return hydrateCanvasNodesFromDsl(app.dsl)
  }, [appId]);

  const initialEdges = useMemo<Edge[]>(() => {
    if (!appId)
      return []

    const app = getWorkflowAppById(appId)
    if (!app)
      return []

    return app.dsl.edges as unknown as Edge[]
  }, [appId])

  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNodeData>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<CommonEdgeType>(initialEdges);
  const { handleNodeClick, handlePaneClick, handlePanelClose } =
    useNodesInteractions<CanvasNodeData>({
      setNodes,
      setEdges,
    });

  useEffect(() => {
    if (!appId)
      return

    const app = getWorkflowAppById(appId)
    if (!app) {
      setNodes([createInitialTriggerNode()])
      setEdges([])
      return
    }

    setNodes(hydrateCanvasNodesFromDsl(app.dsl))
    setEdges(app.dsl.edges as Edge[])
  }, [appId, setEdges, setNodes])

  useEffect(() => {
    setNodes((currentNodes) => {
      let changed = false;

      const nextNodes = currentNodes.map((node) => {
        const connectedSourceHandleIds = edges
          .filter((edge) => edge.source === node.id)
          .map((edge) => edge.sourceHandle ?? 'out');

        if (areStringArraysEqual(node.data._connectedSourceHandleIds ?? [], connectedSourceHandleIds)) {
          return node;
        }

        changed = true;

        return {
          ...node,
          data: {
            ...node.data,
            _connectedSourceHandleIds: connectedSourceHandleIds,
          },
        };
      });

      return changed ? nextNodes : currentNodes;
    });
  }, [edges, setNodes]);

  useEffect(() => {
    setNodes((currentNodes) => {
      let changed = false;

      const nextNodes = currentNodes.map((node) => {
        if (node.data.kind !== 'knowledge') {
          return node;
        }

        const datasetIds = getKnowledgeDatasetIds(node.data);
        const normalizedDatasetIds = datasetIds.filter(datasetId => datasets.some(dataset => dataset.id === datasetId));
        const nextDatasets = getKnowledgeDatasetsByIds(normalizedDatasetIds);

        if (
          areStringArraysEqual(datasetIds, normalizedDatasetIds)
          && areKnowledgeDatasetsEqual(node.data._datasets ?? [], nextDatasets)
        ) {
          return node;
        }

        changed = true;

        return {
          ...node,
          data: {
            ...node.data,
            inputs: {
              ...(node.data.inputs ?? {}),
              dataset_ids: normalizedDatasetIds,
            },
            _datasets: nextDatasets,
          },
        };
      });

      return changed ? nextNodes : currentNodes;
    });
  }, [datasets, setNodes]);

  useEffect(() => {
    setNodes((currentNodes) => {
      let changed = false;

      const nextNodes = currentNodes.map((node) => {
        if (node.data.kind === 'iteration') {
          const normalizedConfig = normalizeIterationNodeConfig(node.data.inputs, node.id);
          const nextChildren = buildIterationChildren(normalizedConfig.start_node_id);
          const outputs = node.data.outputs ?? {};
          const hasOutputShape = 'items' in outputs && 'count' in outputs;

          if (
            JSON.stringify(node.data.inputs ?? null) === JSON.stringify(normalizedConfig)
            && areContainerChildrenEqual(node.data._children ?? [], nextChildren)
            && hasOutputShape
          ) {
            return node;
          }

          changed = true;

          return {
            ...node,
            data: {
              ...node.data,
              inputs: normalizedConfig as unknown as Record<string, unknown>,
              outputs: {
                items: [],
                count: 0,
                ...(node.data.outputs ?? {}),
              },
              _children: nextChildren,
            },
          };
        }

        if (node.data.kind === 'loop') {
          const normalizedConfig = normalizeLoopNodeConfig(node.data.inputs, node.id);
          const nextChildren = buildLoopChildren(normalizedConfig.start_node_id);
          const outputs = node.data.outputs ?? {};
          const hasOutputShape = 'steps' in outputs && 'count' in outputs;

          if (
            JSON.stringify(node.data.inputs ?? null) === JSON.stringify(normalizedConfig)
            && areContainerChildrenEqual(node.data._children ?? [], nextChildren)
            && hasOutputShape
          ) {
            return node;
          }

          changed = true;

          return {
            ...node,
            data: {
              ...node.data,
              inputs: normalizedConfig as unknown as Record<string, unknown>,
              outputs: {
                steps: [],
                count: 0,
                ...(node.data.outputs ?? {}),
              },
              _children: nextChildren,
            },
          };
        }

        return node;
      });

      return changed ? nextNodes : currentNodes;
    });
  }, [setNodes]);

  useEffect(() => {
    if (!appId)
      return

    const app = getWorkflowAppById(appId)
    updateWorkflowAppDsl(
      appId,
      createWorkflowDslFromCanvas(nodes, edges as Edge[], app?.name),
    )
  }, [appId, edges, nodes])

  const selectedNode = useMemo(() => {
    const currentNode = nodes.find((node) => node.data.selected);

    if (!currentNode) return undefined;

    return {
      id: currentNode.id,
      type: currentNode.type,
      data: currentNode.data,
    };
  }, [nodes]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || connection.source === connection.target) {
        return;
      }

      const edgeId = `${connection.source}-${connection.sourceHandle ?? 'out'}-${connection.target}-${connection.targetHandle ?? 'in'}`;
      setEdges((current) => {
        const sourceNode = nodes.find((node) => node.id === connection.source);
        const targetNode = nodes.find((node) => node.id === connection.target);

        if (!sourceNode || !targetNode) {
          return current;
        }

        if (current.some((item) => item.id === edgeId)) {
          return current;
        }

        return addEdge(
          {
            ...connection,
            id: edgeId,
            type: CUSTOM_EDGE,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#94a3b8',
            },
            style: {
              stroke: '#94a3b8',
              strokeWidth: 1.6,
            },
            data: createWorkflowEdgeData({
              sourceType: CANVAS_NODE_KIND_TO_BLOCK[sourceNode.data.kind],
              targetType: CANVAS_NODE_KIND_TO_BLOCK[targetNode.data.kind],
            }),
          },
          current,
        );
      });
    },
    [nodes, setEdges],
  );

  if (!appId) {
    return <EmptyView />;
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_24px_60px_-32px_rgba(15,23,42,0.25)]">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
            Draft
          </p>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            应用 ID：{appId}
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden rounded-b-3xl">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
            connectionLineContainerStyle={{ zIndex: ITERATION_CHILDREN_Z_INDEX }}
            selectionMode={SelectionMode.Partial}
            minZoom={0.25}
            multiSelectionKeyCode={null}
            deleteKeyCode={null}
            nodesDraggable
            nodesConnectable={false}
            nodesFocusable={false}
            edgesFocusable={false}
            panOnScroll={false}
            zoomOnScroll
            selectionKeyCode={null}
            className="bg-white"
            proOptions={{ hideAttribution: true }}
          >
            <Background
              gap={[14, 14]}
              size={2}
              className="bg-workflow-canvas-workflow-bg"
              color="var(--color-workflow-canvas-workflow-dot-color)"
            />
          </ReactFlow>
        </div>

        <Panel selectedNode={selectedNode} onClose={handlePanelClose} />
      </div>
    </section>
  );
};
