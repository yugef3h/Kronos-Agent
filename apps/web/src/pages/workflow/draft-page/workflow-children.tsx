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
  type CommonEdgeType,
  type Edge,
} from '../types/common';
import type { CanvasNodeData } from '../types/canvas';
import {
  applyConnectedEdgeSelection,
  applyNodeSelection,
  getDescendantNodeIds,
  removeConnectedEdges,
  removeNodeById,
} from '../hooks/node-selection';
import {
  buildContainerChildPosition,
  buildContainerChildSummaries,
  buildContainerStartNode,
  CONTAINER_NODE_MIN_HEIGHT,
  CONTAINER_NODE_WIDTH,
  getContainerBlockEnum,
  isContainerNodeKind,
  isContainerStartKind,
} from '../features/container-panel/canvas';
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
  normalizeIterationNodeConfig,
} from '../features/iteration-panel/schema';
import { getKnowledgeDatasetsByIds, useKnowledgeDatasets } from '../features/knowledge-retrieval-panel/dataset-store';
import {
  buildLoopBreakSummary,
  normalizeLoopNodeConfig,
} from '../features/loop-panel/schema';
import { buildWorkflowVariableOptions } from '../utils/variable-options';
import 'reactflow/dist/style.css';

const createNodeId = (kind: CanvasNodeData['kind']): string => {
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
  const nextNodeId = createNodeId(node.kind);
  const isNestedNode = Boolean(sourceNode.parentId);
  const nextPosition = isNestedNode
    ? buildContainerChildPosition(index)
    : {
        x: sourceNode.position.x + NODE_WIDTH_X_OFFSET,
        y: sourceNode.position.y + index * 120,
      };

  return {
    id: nextNodeId,
    type: 'workflow',
    parentId: sourceNode.parentId,
    extent: sourceNode.parentId ? 'parent' : undefined,
    position: nextPosition,
    data: createNodeData(node, nextNodeId),
  };
};

const getContainerScopeData = (
  nodes: Node<CanvasNodeData>[],
  node: Node<CanvasNodeData>,
) => {
  if (!node.parentId) {
    return {};
  }

  const containerNode = nodes.find(candidate => candidate.id === node.parentId);
  if (!containerNode || !isContainerNodeKind(containerNode.data.kind)) {
    return {};
  }

  return containerNode.data.kind === 'iteration'
    ? { isInIteration: true, iteration_id: containerNode.id }
    : { isInLoop: true, loop_id: containerNode.id };
};

const hasRecordShape = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const resolveIterationItemValueType = (
  nodes: Node<CanvasNodeData>[],
  iteratorSelector: string[],
) => {
  if (iteratorSelector.join('.') === 'sys.files') {
    return 'file' as const;
  }

  const [sourceNodeId, outputKey] = iteratorSelector;
  const sourceNode = nodes.find(node => node.id === sourceNodeId);
  const outputValue = sourceNode?.data.outputs?.[outputKey];

  if (Array.isArray(outputValue) && outputValue.length) {
    const sample = outputValue[0];
    if (typeof sample === 'number')
      return 'number' as const;
    if (typeof sample === 'boolean')
      return 'boolean' as const;
    if (Array.isArray(sample))
      return 'array' as const;
    if (hasRecordShape(sample))
      return 'object' as const;
    if (typeof sample === 'string')
      return 'string' as const;
  }

  return 'object' as const;
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
  const parentNodeId = getNode(id)?.parentId;
  const isContainerStartNode = isContainerStartKind(data.kind);
  const isContainerNode = data.kind === 'iteration' || data.kind === 'loop';
  const isNestedNode = Boolean(parentNodeId);
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

      const childCount = sourceNode.parentId
        ? getNodes().filter(candidate => candidate.parentId === sourceNode.parentId).length
        : getEdges().filter((edge) => edge.source === id).length;
      const nextNode = createNodeFromSource(sourceNode, node, childCount);
      const edgeId = `${id}-${sourceHandle}-${nextNode.id}-in`;
      const scopeData = getContainerScopeData(getNodes(), sourceNode);
      const sourceBlock = getContainerBlockEnum(sourceNode.data.kind);
      const targetBlock = getContainerBlockEnum(nextNode.data.kind);

      if (!sourceBlock || !targetBlock) {
        setMenuOpen(false);
        setAppendSourceHandle('out');
        return;
      }

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
          sourceType: sourceBlock,
          targetType: targetBlock,
          ...scopeData,
        }),
      };

      setNodes((nodes) => applyNodeSelection([...nodes, nextNode], nextNode.id));
      setEdges((edges) => applyConnectedEdgeSelection(addEdge(nextEdge, edges), nextNode.id));

      setMenuOpen(false);
      setAppendSourceHandle('out');
    },
    [getEdges, getNode, getNodes, id, setEdges, setNodes],
  );

  const deleteNode = useCallback(() => {
    setMenuOpen(false);
    const removedNodeIds = [id, ...getDescendantNodeIds(getNodes(), id)];
    setNodes((currentNodes) => removeNodeById(currentNodes, id));
    setEdges((currentEdges) => removeConnectedEdges(currentEdges, removedNodeIds));
  }, [getNodes, id, setEdges, setNodes]);

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

  const nodeWidth = isContainerNode
    ? CONTAINER_NODE_WIDTH
    : isContainerStartNode
      ? 152
      : isNestedNode
        ? 188
        : NODE_WIDTH;

  const nodeMinHeight = isContainerNode ? CONTAINER_NODE_MIN_HEIGHT : undefined;

  return (
    <div
      className={`group relative bg-white transition ${data.kind === 'condition'
        ? `rounded-[24px] border-[2px] px-4 py-4 shadow-[0_14px_32px_-28px_rgba(37,99,235,0.42)] ${data.selected ? 'border-blue-600' : 'border-blue-500'}`
        : isContainerStartNode
          ? 'rounded-2xl border border-sky-200 bg-sky-50/95 px-3 py-2 shadow-[0_10px_24px_-20px_rgba(14,116,144,0.85)]'
          : isContainerNode
            ? `rounded-[28px] border px-4 py-4 shadow-[0_18px_36px_-26px_rgba(15,23,42,0.3)] ${data.selected ? 'border-components-option-card-option-selected-border' : 'border-slate-200 hover:border-blue-300'}`
            : `rounded-2xl border px-4 py-3 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.55)] ${data.selected ? 'border-components-option-card-option-selected-border' : 'border-slate-200 hover:border-blue-300'}`}`}
      style={{ width: nodeWidth, minWidth: nodeWidth, maxWidth: nodeWidth, minHeight: nodeMinHeight }}
    >
      {!['trigger', 'iteration-start', 'loop-start'].includes(data.kind) ? (
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

      {isContainerStartNode ? (
        <>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-700">{data.subtitle}</p>
          <p className="mt-1 text-[14px] font-semibold text-slate-900">{data.title}</p>
          <p className="mt-1 text-[10px] leading-4 text-slate-500">
            {data.kind === 'iteration-start'
              ? '向内部节点暴露 current.item / current.index'
              : '向内部节点暴露 loop 变量与 index'}
          </p>

          {canAppend ? (
            <div className="absolute -right-3 top-1/2 -translate-y-1/2">
              <button
                type="button"
                className="flex h-6 w-6 items-center justify-center rounded-full border border-sky-200 bg-white text-lg text-sky-700 opacity-100 shadow-sm transition hover:bg-sky-50"
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
        </>
      ) : data.kind === 'condition' ? (
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
          {isContainerNode ? (
            <div className="mt-4 rounded-[22px] border border-dashed border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.9),rgba(241,245,249,0.75))] px-3 py-2">
              <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                <span>内部子图</span>
                <span>{data._children?.length ?? 0} Nodes</span>
              </div>
              <p className="mt-1 text-[11px] leading-5 text-slate-500">
                {data._children && data._children.length > 1
                  ? '容器入口已生成。继续从 Start 节点右侧添加内部节点，并在容器内部顺序连线。'
                  : '当前只有内部 Start。点击容器里的 Start 节点右侧 + 添加第一个子节点。'}
              </p>
            </div>
          ) : null}
        </>
      )}

      {!isContainerStartNode ? <NodeControl id={id} isActive={!!data.selected} onDelete={deleteNode} /> : null}

      {canAppend && data.kind !== 'condition' && !isContainerStartNode ? (
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
      const nextNodes = [...currentNodes];

      const upsertNode = (candidate: Node<CanvasNodeData>) => {
        const currentIndex = nextNodes.findIndex(node => node.id === candidate.id);

        if (currentIndex === -1) {
          nextNodes.push(candidate);
          changed = true;
          return;
        }

        const currentNode = nextNodes[currentIndex];
        const isSameNode = JSON.stringify({
          parentId: currentNode.parentId,
          position: currentNode.position,
          extent: currentNode.extent,
          draggable: currentNode.draggable,
          selectable: currentNode.selectable,
          data: currentNode.data,
        }) === JSON.stringify({
          parentId: candidate.parentId,
          position: candidate.position,
          extent: candidate.extent,
          draggable: candidate.draggable,
          selectable: candidate.selectable,
          data: candidate.data,
        });

        if (!isSameNode) {
          nextNodes[currentIndex] = {
            ...currentNode,
            ...candidate,
          };
          changed = true;
        }
      };

      nextNodes
        .filter(node => node.data.kind === 'iteration' || node.data.kind === 'loop')
        .forEach((node) => {
          if (node.data.kind === 'iteration') {
            const normalizedConfig = normalizeIterationNodeConfig(node.data.inputs, node.id);
            const itemValueType = resolveIterationItemValueType(nextNodes, normalizedConfig.iterator_selector);
            const expectedStartNode = buildContainerStartNode({
              containerId: node.id,
              startNodeId: normalizedConfig.start_node_id,
              kind: 'iteration',
              itemValueType,
            });

            upsertNode(expectedStartNode);

            const nextChildren = buildContainerChildSummaries(nextNodes, node.id);
            const outputs = node.data.outputs ?? {};
            const hasOutputShape = 'items' in outputs && 'count' in outputs;

            if (
              JSON.stringify(node.data.inputs ?? null) !== JSON.stringify(normalizedConfig)
              || !areContainerChildrenEqual(node.data._children ?? [], nextChildren)
              || !hasOutputShape
            ) {
              const nodeIndex = nextNodes.findIndex(candidate => candidate.id === node.id);
              nextNodes[nodeIndex] = {
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
              changed = true;
            }

            return;
          }

          const normalizedConfig = normalizeLoopNodeConfig(node.data.inputs, node.id);
          const expectedStartNode = buildContainerStartNode({
            containerId: node.id,
            startNodeId: normalizedConfig.start_node_id,
            kind: 'loop',
            loopVariables: normalizedConfig.loop_variables,
          });

          upsertNode(expectedStartNode);

          const nextChildren = buildContainerChildSummaries(nextNodes, node.id);
          const outputs = node.data.outputs ?? {};
          const hasOutputShape = 'steps' in outputs && 'count' in outputs;

          if (
            JSON.stringify(node.data.inputs ?? null) !== JSON.stringify(normalizedConfig)
            || !areContainerChildrenEqual(node.data._children ?? [], nextChildren)
            || !hasOutputShape
          ) {
            const nodeIndex = nextNodes.findIndex(candidate => candidate.id === node.id);
            nextNodes[nodeIndex] = {
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
            changed = true;
          }
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

        if (sourceNode.parentId || targetNode.parentId) {
          if (!sourceNode.parentId || sourceNode.parentId !== targetNode.parentId) {
            return current;
          }
        }

        if (current.some((item) => item.id === edgeId)) {
          return current;
        }

        const sourceType = getContainerBlockEnum(sourceNode.data.kind);
        const targetType = getContainerBlockEnum(targetNode.data.kind);

        if (!sourceType || !targetType) {
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
              sourceType,
              targetType,
              ...getContainerScopeData(nodes, sourceNode),
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
