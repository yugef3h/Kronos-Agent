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
  useUpdateNodeInternals,
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
  CONTAINER_CHILD_NODE_WIDTH,
  CONTAINER_END_NODE_WIDTH,
  CONTAINER_NODE_HORIZONTAL_PADDING,
  CONTAINER_NODE_MIN_HEIGHT,
  CONTAINER_NODE_WIDTH,
  CONTAINER_START_HANDLE_RIGHT_OFFSET,
  CONTAINER_START_NODE_COLLAPSED_WIDTH,
  CONTAINER_START_NODE_WIDTH,
  getContainerBlockEnum,
  isContainerEndKind,
  isContainerStartKind,
} from '../features/container-panel/canvas';
import { createWorkflowEdgeData } from '../utils/edge-data';
import {
  createInitialTriggerNode,
  createWorkflowDslFromCanvas,
  hydrateCanvasNodesFromDsl,
} from '../utils/workflow-dsl';
import { useContainerNodeSync } from '../hooks/use-container-node-sync';
import { useNodesInteractions } from '../hooks/use-nodes-interactions';
import Panel from '../compts/panel';
import NodeControl from '../compts/node-control';
import { IconCondition } from '../assets/condition';
import {
  ContainerNodeBoard,
  ContainerNodeHeader,
  NestedEndNodeCard,
  NestedPlainNodeCard,
} from '../compts/container-node-ui';
import { ContainerStartNode } from '../compts/container-start-node';
import type { VariableOption } from '../features/llm-panel/types';
import {
  buildIfElseConditionSummary,
  buildIfElseTargetBranches,
  normalizeIfElseNodeConfig,
} from '../features/ifelse-panel/schema';
import {
} from '../features/iteration-panel/schema';
import { getKnowledgeDatasetsByIds, useKnowledgeDatasets } from '../features/knowledge-retrieval-panel/dataset-store';
import {
} from '../features/loop-panel/schema';
import { buildWorkflowVariableOptions } from '../utils/variable-options';
import {
  areKnowledgeDatasetsEqual,
  areStringArraysEqual,
  createNodeFromSource,
  getContainerScopeData,
  getKnowledgeDatasetIds,
  resolveSearchBoxScope,
} from '../utils/workflow-node-utils';
import 'reactflow/dist/style.css';

const buildConditionNodeVariableOptions = (
  currentNodeId: string,
  nodes: Array<{ id: string; data: CanvasNodeData; parentId?: string }>,
) : VariableOption[] => {
  return buildWorkflowVariableOptions(currentNodeId, nodes);
};

const WorkflowNode = ({ id, data }: NodeProps<CanvasNodeData>) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [appendSourceHandle, setAppendSourceHandle] = useState<string>('out');
  const menuRef = useRef<HTMLDivElement>(null);
  const { setNodes, setEdges, getNode, getEdges, getNodes } = useReactFlow<CanvasNodeData, Edge>();
  const currentNode = getNode(id);
  const parentNodeId = currentNode?.parentId;
  const currentParentNode = parentNodeId ? getNode(parentNodeId) : undefined;
  const isContainerStartNode = isContainerStartKind(data.kind);
  const isContainerEndNode = isContainerEndKind(data.kind);
  const isContainerNode = data.kind === 'iteration' || data.kind === 'loop';
  const isNestedNode = Boolean(parentNodeId);
  const canAppend = !['end', 'iteration-end', 'loop-end'].includes(data.kind);
  const searchBoxScope = useMemo(
    () => resolveSearchBoxScope(getNodes(), currentNode),
    [currentNode, getNodes],
  );
  const parentChildCount = currentParentNode?.data._children?.length ?? 0;
  const showContainerAddBlock = isContainerStartNode && parentChildCount <= 1;
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
      getNodes().map(node => ({ id: node.id, data: node.data, parentId: node.parentId })),
    );
  }, [data.kind, getNodes, id]);
  const primaryConditionSummary = useMemo(() => {
    if (!conditionConfig?.cases[0]?.conditions.length) {
      return '添加条件后，这里会显示 IF 分支摘要';
    }

    return buildIfElseConditionSummary(conditionConfig.cases[0].conditions[0], conditionVariableOptions);
  }, [conditionConfig, conditionVariableOptions]);
  const connectedSourceHandleIds = data._connectedSourceHandleIds ?? [];

  const appendNode = useCallback(
    (node: NodeItem, sourceHandle = 'out', sourceNodeId = id) => {
      const sourceNode = getNode(sourceNodeId);
      if (!sourceNode) {
        return;
      }

       if (sourceNode.data.kind === 'condition') {
        const hasExistingBranchEdge = getEdges().some(
          (edge) => edge.source === sourceNodeId && edge.sourceHandle === sourceHandle,
        );
        if (hasExistingBranchEdge) {
          setMenuOpen(false);
          return;
        }
      }

      const childCount = sourceNode.parentId
        ? getNodes().filter(candidate => candidate.parentId === sourceNode.parentId).length
        : getEdges().filter((edge) => edge.source === sourceNodeId).length;
      const nextNode = createNodeFromSource(sourceNode, node, childCount, getNodes());
      const edgeId = `${sourceNodeId}-${sourceHandle}-${nextNode.id}-in`;
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
        zIndex: sourceNode.parentId ? ITERATION_CHILDREN_Z_INDEX + 2 : undefined,
        source: sourceNodeId,
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
    ? Number(currentNode?.style?.width ?? CONTAINER_NODE_WIDTH)
    : isContainerStartNode
      ? Number(currentNode?.style?.width ?? (showContainerAddBlock ? CONTAINER_START_NODE_WIDTH : CONTAINER_START_NODE_COLLAPSED_WIDTH))
      : isContainerEndNode
        ? CONTAINER_END_NODE_WIDTH
        : isNestedNode
          ? CONTAINER_CHILD_NODE_WIDTH
        : NODE_WIDTH;

  const nodeMinHeight = isContainerNode
    ? Number(currentNode?.style?.height ?? CONTAINER_NODE_MIN_HEIGHT)
    : undefined;
  const containerStartHandleStyle = showContainerAddBlock
    ? undefined
    : { right: CONTAINER_START_HANDLE_RIGHT_OFFSET };
  const nodeSurfaceClass = isContainerStartNode || (isNestedNode && !isContainerNode)
    ? 'bg-transparent'
    : 'bg-white';
  const isNestedConditionNode = isNestedNode && data.kind === 'condition';
  const isNestedPlainNode = isNestedNode && !isContainerStartNode && !isContainerEndNode && data.kind !== 'condition';
  const nestedNodeCardClass = isNestedNode
    ? 'rounded-[16px] border-0 bg-transparent px-0 py-0 shadow-none'
    : 'rounded-2xl border px-4 py-3 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.55)]';

  return (
    <div
      className={`group relative ${nodeSurfaceClass} transition ${data.kind === 'condition'
        ? `${isNestedConditionNode
          ? 'rounded-[18px] border-0 bg-transparent px-0 py-0 shadow-none'
          : 'rounded-[24px] border-[2px] px-4 py-4 shadow-[0_14px_32px_-28px_rgba(37,99,235,0.42)]'} ${data.selected ? 'border-blue-600' : 'border-blue-500'}`
        : isContainerStartNode
          ? 'rounded-none border-0 bg-transparent px-0 py-0 shadow-none'
          : isContainerNode
              ? `rounded-[30px] border bg-white shadow-[0_16px_28px_-24px_rgba(15,23,42,0.16)] ${data.selected ? 'border-components-option-card-option-selected-border' : 'border-slate-200 hover:border-blue-300'}`
            : `${nestedNodeCardClass} ${data.selected ? 'border-components-option-card-option-selected-border' : 'border-slate-200 hover:border-blue-300'}`}`}
      style={{
        width: nodeWidth,
        minWidth: nodeWidth,
        height: isContainerNode ? nodeMinHeight : undefined,
        minHeight: nodeMinHeight,
      }}
    >
      {!['trigger', 'iteration-start', 'loop-start'].includes(data.kind) ? (
        <Handle
          id="in"
          type="target"
          position={Position.Left}
          className={`!h-2.5 !w-2.5 !border-2 !border-white !bg-blue-500 ${data.kind === 'condition' ? '!left-[-7px]' : ''}`}
        />
      ) : null}
      {!['end', 'condition', 'iteration-start', 'loop-start', 'iteration-end', 'loop-end'].includes(data.kind) ? (
        <Handle
          id="out"
          type="source"
          position={Position.Right}
          className="!h-2.5 !w-2.5 !border-2 !border-white !bg-blue-500"
        />
      ) : null}

      {isContainerStartNode ? (
        <>
          <Handle
            id="out"
            type="source"
            position={Position.Right}
            className="!h-0 !w-0 !border-0 !bg-transparent !opacity-0 !pointer-events-none"
            style={containerStartHandleStyle}
          />

          <ContainerStartNode
            kind={data.kind as 'iteration-start' | 'loop-start'}
            showAddBlock={showContainerAddBlock}
            onToggleMenu={(event) => {
              event.stopPropagation();
              setAppendSourceHandle('out');
              setMenuOpen((prev) => !prev);
            }}
          />

          <SearchBox
            isOpen={menuOpen}
            onClose={() => setMenuOpen(false)}
            onAppendNode={(node) => appendNode(node, appendSourceHandle)}
            menuRef={menuRef}
            scope={searchBoxScope}
          />
        </>
      ) : isContainerEndNode ? (
        isNestedNode ? (
          <NestedEndNodeCard data={data} />
        ) : (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-700">{data.subtitle}</p>
            <p className="mt-1 text-[14px] font-semibold text-slate-900">{data.title}</p>
            <p className="mt-1 text-[10px] leading-4 text-slate-500">
              {data.kind === 'iteration-end'
                ? '命中后结束当前 iteration 内部链路'
                : '命中后结束当前 loop 内部链路'}
            </p>
          </>
        )
      ) : data.kind === 'condition' ? (
        <div>
          <div className={`flex items-center ${isNestedConditionNode ? 'gap-2 pr-6' : 'gap-3 pr-8'}`}>
            <div className={`flex shrink-0 items-center justify-center rounded-[4px] bg-[#16b5d8] text-white ${isNestedConditionNode ? 'h-5 w-5 shadow-none' : 'h-6 w-6 shadow-[0_10px_20px_-18px_rgba(8,145,178,0.9)]'}`}>
              <IconCondition />
            </div>
            <div className="min-w-0 pt-0.5">
              <p className={`${isNestedConditionNode ? 'text-[13px]' : 'text-[16px]'} font-semibold tracking-[0.01em] text-slate-900`}>{data.title}</p>
            </div>
          </div>

          <div className={`${isNestedConditionNode ? 'mt-1 space-y-1' : 'mt-[-6px] space-y-1.5'}`}>
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
                  className={`relative ${isElseBranch ? 'min-h-[24px]' : isNestedConditionNode ? 'min-h-[48px]' : 'min-h-[58px]'}`}
                >
                  {!isElseBranch ? (
                    <div>
                      <div className={`${isNestedConditionNode ? 'mb-3 min-h-[12px]' : 'mb-4 min-h-[18px]'}`} />
                      <div className={`rounded-xl ${isNestedConditionNode ? 'bg-white/55 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.8)] backdrop-blur-[1px]' : 'bg-[#f5f7fb] shadow-[inset_0_0_0_1px_rgba(226,232,240,0.7)]'}`}>
                        <div className={`flex items-center gap-1.5 rounded-xl text-[11px] font-medium text-slate-700 ${isNestedConditionNode ? 'min-h-[28px] px-2 py-1' : 'min-h-[34px] px-2.5 py-1.5 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9)]'}`}>
                          <span className="line-clamp-1">{branchSummary}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-6" />
                  )}

                  {isElseBranch ? (
                    <span className={`absolute right-1 top-1/2 -translate-y-1/2 font-semibold tracking-[0.01em] text-slate-700 ${isNestedConditionNode ? 'text-[9px]' : 'text-[10px]'}`}>
                      {branch.name}
                    </span>
                  ) : (
                    <span className={`absolute right-1 font-semibold tracking-[0.01em] text-slate-700 ${isNestedConditionNode ? 'top-[10px] text-[9px]' : 'top-[14px] text-[10px]'}`}>
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
      ) : isContainerNode ? (
        <div
          className="relative h-full w-full rounded-[30px] bg-white pt-4"
          style={{
            paddingLeft: CONTAINER_NODE_HORIZONTAL_PADDING,
            paddingRight: CONTAINER_NODE_HORIZONTAL_PADDING,
            paddingBottom: CONTAINER_NODE_HORIZONTAL_PADDING,
          }}
        >
          <ContainerNodeBoard />
          <ContainerNodeHeader subtitle={data.subtitle} title={data.title} />
        </div>
      ) : (
        isNestedPlainNode ? (
          <NestedPlainNodeCard data={data} />
        ) : (
          <div>
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
          </div>
        )
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
            scope={searchBoxScope}
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
  const updateNodeInternals = useUpdateNodeInternals();
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

  useContainerNodeSync({
    nodes,
    edges: edges as Edge[],
    setNodes,
    updateNodeInternals,
  });

  useEffect(() => {
    setEdges((currentEdges) => {
      let changed = false;

      const nextEdges = currentEdges.map((edge) => {
        const sourceNode = nodes.find(node => node.id === edge.source);
        const targetNode = nodes.find(node => node.id === edge.target);
        const isInternalEdge = Boolean(sourceNode?.parentId && sourceNode.parentId === targetNode?.parentId);
        const nextZIndex = isInternalEdge ? ITERATION_CHILDREN_Z_INDEX + 2 : undefined;

        if (edge.zIndex === nextZIndex) {
          return edge;
        }

        changed = true;
        return {
          ...edge,
          zIndex: nextZIndex,
        };
      });

      return changed ? nextEdges : currentEdges;
    });
  }, [nodes, setEdges]);

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
            zIndex: sourceNode.parentId ? ITERATION_CHILDREN_Z_INDEX + 2 : undefined,
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
