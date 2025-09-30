import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
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
import { getWorkflowAppById } from '../../../features/workflow/workflowAppStore';
import {
  CUSTOM_EDGE,
  ITERATION_CHILDREN_Z_INDEX,
  NODE_WIDTH,
  SEARCH_BOX_NODE_Z_INDEX,
} from '../layout-constants';
import CustomEdge from '../compts/custom-edge';
import { EmptyView } from '../compts/empty-view';
import DslPreviewDialog from '../compts/dsl-preview-dialog';
import { EditingTitle } from '../compts/editing-title';
import { SearchBox } from '../compts/search-box';
import { type CommonEdgeType, type Edge } from '../types/common';
import type { CanvasNodeData } from '../types/canvas';
import type { NodeItem } from '../types/search-box';
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
import { useWorkflowDraftPersistence } from '../hooks/use-workflow-draft-persistence';
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
import WorkflowNodeSummary from '../compts/workflow-node-summary';
import type { VariableOption } from '../features/llm-panel/types';
import {
  buildIfElseConditionSummary,
  buildIfElseTargetBranches,
  normalizeIfElseNodeConfig,
} from '../features/ifelse-panel/schema';
import {} from '../features/iteration-panel/schema';
import {
  getKnowledgeDatasetsByIds,
  useKnowledgeDatasets,
} from '../features/knowledge-retrieval-panel/dataset-store';
import {} from '../features/loop-panel/schema';
import { buildWorkflowVariableOptions } from '../utils/variable-options';
import {
  areKnowledgeDatasetsEqual,
  areStringArraysEqual,
  createNodeFromSource,
  getContainerScopeData,
  getKnowledgeDatasetIds,
} from '../utils/workflow-node-utils';
import {
  beginAppendHandlePointerState,
  consumeAppendHandleClick,
  createAppendHandlePointerState,
  endAppendHandlePointerState,
  updateAppendHandlePointerState,
} from '../utils/append-handle-pointer';
import { resolveSearchBoxScope } from '../utils/workflow-search-scope';
import 'reactflow/dist/style.css';
import { WORKFLOW_EDGE_STROKE_WIDTH } from '../utils/edge-geometry';

const normalizeWorkflowEdge = (edge: Edge): Edge => {
  return {
    ...edge,
    type: CUSTOM_EDGE,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: '#94a3b8',
    },
    style: {
      stroke: '#94a3b8',
      strokeWidth: WORKFLOW_EDGE_STROKE_WIDTH,
      ...(edge.style ?? {}),
    },
  };
};

const buildConditionNodeVariableOptions = (
  currentNodeId: string,
  nodes: Array<{ id: string; data: CanvasNodeData; parentId?: string }>,
  edges: Array<{ source: string; target: string }>,
): VariableOption[] => {
  return buildWorkflowVariableOptions(currentNodeId, nodes, edges);
};

const appendTriggerHandleStyle: CSSProperties = {
  top: 0,
  right: 0,
  width: '100%',
  height: '100%',
  transform: 'none',
};

type AppendConnectorTriggerProps = {
  handleId: string;
  isDisabled?: boolean;
  wrapperClassName: string;
  visual: ReactNode;
  onTriggerClick: () => void;
};

const AppendConnectorTrigger = ({
  handleId,
  isDisabled = false,
  wrapperClassName,
  visual,
  onTriggerClick,
}: AppendConnectorTriggerProps) => {
  const pointerStateRef = useRef(createAppendHandlePointerState());

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    pointerStateRef.current = beginAppendHandlePointerState({
      x: event.clientX,
      y: event.clientY,
    });
  }, []);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    pointerStateRef.current = updateAppendHandlePointerState(pointerStateRef.current, {
      x: event.clientX,
      y: event.clientY,
    });
  }, []);

  const handlePointerEnd = useCallback(() => {
    pointerStateRef.current = endAppendHandlePointerState(pointerStateRef.current);
  }, []);

  const handleClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      event.stopPropagation();

      const result = consumeAppendHandleClick(pointerStateRef.current);
      pointerStateRef.current = result.nextState;

      if (!isDisabled && result.shouldOpen) {
        onTriggerClick();
      }
    },
    [isDisabled, onTriggerClick],
  );

  return (
    <div
      className={wrapperClassName}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onClick={handleClick}
    >
      {visual}
      <Handle
        id={handleId}
        type="source"
        position={Position.Right}
        isConnectable={!isDisabled}
        isConnectableStart={!isDisabled}
        isConnectableEnd={false}
        style={appendTriggerHandleStyle}
        className="nodrag nopan !z-20 !border-0 !bg-transparent !opacity-0"
      />
    </div>
  );
};

const WorkflowNode = ({ id, data }: NodeProps<CanvasNodeData>) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [appendSourceHandle, setAppendSourceHandle] = useState<string>('out');
  const menuRef = useRef<HTMLDivElement>(null);
  const baseZIndexRef = useRef<number | undefined>(undefined);
  const { setNodes, setEdges, getNode, getEdges, getNodes } = useReactFlow<CanvasNodeData, Edge>();
  const currentNode = getNode(id);
  const currentNodeZIndex = currentNode?.zIndex;
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
      getNodes().map((node) => ({ id: node.id, data: node.data, parentId: node.parentId })),
      getEdges(),
    );
  }, [data.kind, getEdges, getNodes, id]);
  const primaryConditionSummary = useMemo(() => {
    if (!conditionConfig?.cases[0]?.conditions.length) {
      return '添加条件后，这里会显示 IF 分支摘要';
    }

    return buildIfElseConditionSummary(
      conditionConfig.cases[0].conditions[0],
      conditionVariableOptions,
    );
  }, [conditionConfig, conditionVariableOptions]);
  const connectedSourceHandleIds = data._connectedSourceHandleIds ?? [];

  const appendNode = useCallback(
    (node: NodeItem, sourceHandle = 'out', sourceNodeId = id) => {
      const sourceNode = getNode(sourceNodeId);
      if (!sourceNode) {
        return;
      }

      if (
        (searchBoxScope === 'iteration' || searchBoxScope === 'loop') &&
        (node.kind === 'iteration' || node.kind === 'loop')
      ) {
        setMenuOpen(false);
        setAppendSourceHandle('out');
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
        ? getNodes().filter((candidate) => candidate.parentId === sourceNode.parentId).length
        : getEdges().filter((edge) => edge.source === sourceNodeId).length;
      const nextNode = createNodeFromSource(
        sourceNode,
        node,
        childCount,
        getNodes(),
        getEdges(),
        sourceHandle,
      );
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
          strokeWidth: WORKFLOW_EDGE_STROKE_WIDTH,
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
    [getEdges, getNode, getNodes, id, searchBoxScope, setEdges, setNodes],
  );

  const deleteNode = useCallback(() => {
    setMenuOpen(false);
    const currentNodes = getNodes();
    const removedNodeIds = [id, ...getDescendantNodeIds(currentNodes, id)];

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

  useEffect(() => {
    if (!menuOpen) {
      baseZIndexRef.current = currentNodeZIndex;
    }
  }, [currentNodeZIndex, menuOpen]);

  useEffect(() => {
    if (!currentNode) {
      return;
    }

    const targetZIndex = menuOpen
      ? Math.max(baseZIndexRef.current ?? 0, SEARCH_BOX_NODE_Z_INDEX)
      : baseZIndexRef.current;

    if (currentNodeZIndex === targetZIndex) {
      return;
    }

    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id !== id) {
          return node;
        }

        return {
          ...node,
          zIndex: targetZIndex,
        };
      }),
    );
  }, [currentNode, currentNodeZIndex, id, menuOpen, setNodes]);

  const nodeWidth = isContainerNode
    ? Number(currentNode?.style?.width ?? CONTAINER_NODE_WIDTH)
    : isContainerStartNode
      ? Number(
          currentNode?.style?.width ??
            (showContainerAddBlock
              ? CONTAINER_START_NODE_WIDTH
              : CONTAINER_START_NODE_COLLAPSED_WIDTH),
        )
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
  const nodeSurfaceClass =
    isContainerStartNode || (isNestedNode && !isContainerNode) ? 'bg-transparent' : 'bg-white';
  const isNestedConditionNode = isNestedNode && data.kind === 'condition';
  const isNestedPlainNode =
    isNestedNode && !isContainerStartNode && !isContainerEndNode && data.kind !== 'condition';
  const standardHandleClass =
    'nodrag nopan !z-10 !h-2.5 !w-2.5 !border-2 !border-white !bg-blue-600';
  const appendHandleButtonClass =
    'nodrag nopan flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-blue-600 text-[14px] leading-none text-white shadow-[0_8px_16px_-14px_rgba(37,99,235,1)] transition hover:bg-blue-500';
  const appendTriggerVisibilityClass =
    menuOpen && appendSourceHandle === 'out'
      ? 'pointer-events-auto opacity-100'
      : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100';
  const nestedNodeCardClass = isNestedNode
    ? 'rounded-[16px] border-0 bg-transparent px-0 py-0 shadow-none'
    : 'rounded-2xl border px-4 py-3 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.55)]';

  return (
    <div
      className={`group relative overflow-visible ${nodeSurfaceClass} transition ${
        data.kind === 'condition'
          ? `${
              isNestedConditionNode
                ? `rounded-[18px] border bg-white px-3 py-3 shadow-none ${data.selected ? 'border-blue-600' : 'border-slate-200 hover:border-blue-300'}`
                : 'rounded-[24px] border-[1px] px-4 py-4 shadow-[0_14px_32px_-28px_rgba(37,99,235,0.42)]'
            } ${data.selected ? 'border-blue-600' : 'border-slate-200 hover:border-blue-300'}`
          : isContainerStartNode
            ? 'rounded-none border-0 bg-transparent px-0 py-0 shadow-none'
            : isContainerNode
              ? `rounded-[30px] border bg-white shadow-[0_16px_28px_-24px_rgba(15,23,42,0.16)] ${data.selected ? 'border-components-option-card-option-selected-border' : 'border-slate-200 hover:border-blue-300'}`
              : isNestedNode
                ? nestedNodeCardClass
                : `${nestedNodeCardClass} ${data.selected ? 'border-components-option-card-option-selected-border' : 'border-slate-200 hover:border-blue-300'}`
      }`}
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
          isConnectable
          isConnectableStart={false}
          isConnectableEnd
          onMouseDown={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
          className={`${standardHandleClass} ${data.kind === 'condition' ? '!left-[-7px]' : ''}`}
        />
      ) : null}
      {!['end', 'condition', 'iteration-start', 'loop-start', 'iteration-end', 'loop-end'].includes(
        data.kind,
      ) ? (
        <AppendConnectorTrigger
          handleId="out"
          wrapperClassName={`absolute -right-3 top-1/2 z-30 h-6 w-6 -translate-y-1/2 ${appendTriggerVisibilityClass}`}
          visual={
            <span aria-hidden className={`${appendHandleButtonClass} pointer-events-none`}>
              +
            </span>
          }
          onTriggerClick={() => {
            setAppendSourceHandle('out');
            setMenuOpen((prev) => !prev || appendSourceHandle !== 'out');
          }}
        />
      ) : null}

      <div className={`workflow-node-drag-surface ${isContainerNode ? 'h-full' : ''}`}>
        {isContainerStartNode ? (
          <>
            <Handle
              id="out"
              type="source"
              position={Position.Right}
              isConnectable
              isConnectableStart
              isConnectableEnd={false}
              onMouseDown={(event) => event.stopPropagation()}
              onTouchStart={(event) => event.stopPropagation()}
              className="nodrag nopan !z-20 !h-6 !w-6 !border-0 !bg-transparent !opacity-0"
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
              searchBox={
                showContainerAddBlock ? (
                  <SearchBox
                    isOpen={menuOpen}
                    onClose={() => setMenuOpen(false)}
                    onAppendNode={(node) => appendNode(node, appendSourceHandle)}
                    menuRef={menuRef}
                    scope={searchBoxScope}
                    preferredSide="right"
                    placement="anchored"
                  />
                ) : null
              }
            />

            {!showContainerAddBlock ? (
              <SearchBox
                isOpen={menuOpen}
                onClose={() => setMenuOpen(false)}
                onAppendNode={(node) => appendNode(node, appendSourceHandle)}
                menuRef={menuRef}
                scope={searchBoxScope}
              />
            ) : null}
          </>
        ) : isContainerEndNode ? (
          isNestedNode ? (
            <NestedEndNodeCard data={data} isSelected={!!data.selected} />
          ) : (
            <div>
              <ContainerNodeHeader kind={data.kind} title={data.title} />
              <p className="mt-1 text-[10px] leading-4 text-slate-500">
                {data.kind === 'iteration-end'
                  ? '命中后结束当前 iteration 内部链路'
                  : '命中后结束当前 loop 内部链路'}
              </p>
            </div>
          )
        ) : data.kind === 'condition' ? (
          <div>
            <div
              className={`flex items-center ${isNestedConditionNode ? 'gap-2 pr-7' : 'gap-3 pr-8'}`}
            >
              <div
                className={`flex shrink-0 items-center justify-center rounded-[4px] bg-[#16b5d8] text-white ${isNestedConditionNode ? 'h-5 w-5 shadow-none' : 'h-6 w-6 shadow-[0_10px_20px_-18px_rgba(8,145,178,0.9)]'}`}
              >
                <IconCondition />
              </div>
              <div className="min-w-0 pt-0.5">
                <p
                  className={`${isNestedConditionNode ? 'text-[13px]' : 'text-[16px]'} font-semibold tracking-[0.01em] text-slate-900`}
                >
                  {data.title}
                </p>
              </div>
            </div>

            <div
              className={`${isNestedConditionNode ? 'mt-2 space-y-1.5' : 'mt-[-6px] space-y-1.5'}`}
            >
              {conditionBranches.map((branch, index) => {
                const isConnected = connectedSourceHandleIds.includes(branch.id);
                const isElseBranch = branch.id === 'false';
                const branchCase = isElseBranch
                  ? null
                  : conditionConfig?.cases.find((caseItem) => caseItem.case_id === branch.id);
                const branchSummary = isElseBranch
                  ? '未命中其他条件时执行'
                  : branchCase?.conditions[0]
                    ? buildIfElseConditionSummary(
                        branchCase.conditions[0],
                        conditionVariableOptions,
                      )
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
                        <div
                          className={`${isNestedConditionNode ? 'mb-3 min-h-[12px]' : 'mb-4 min-h-[18px]'}`}
                        />
                        <div
                          className={`rounded-xl ${isNestedConditionNode ? 'bg-white/55 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.8)] backdrop-blur-[1px]' : 'bg-[#f5f7fb] shadow-[inset_0_0_0_1px_rgba(226,232,240,0.7)]'}`}
                        >
                          <div
                            className={`flex items-center gap-1.5 rounded-md text-[11px] font-medium text-slate-700 min-h-[22px] px-2 py-0}`}
                          >
                            <span className="line-clamp-1">{branchSummary}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-6" />
                    )}

                    {isElseBranch ? (
                      <span
                        className={`absolute right-1 top-1/2 -translate-y-1/2 font-semibold tracking-[0.01em] text-slate-700 ${isNestedConditionNode ? 'text-[9px]' : 'text-[10px]'}`}
                      >
                        {branch.name}
                      </span>
                    ) : (
                      <span
                        className={`absolute right-1 font-semibold tracking-[0.01em] text-slate-700 ${isNestedConditionNode ? 'top-[10px] text-[9px]' : 'top-[14px] text-[10px]'}`}
                      >
                        {branch.name}
                      </span>
                    )}

                    <div
                      className={`nodrag nopan absolute right-[-16px] h-0 w-0 overflow-visible ${isElseBranch ? 'top-1/2 -translate-y-1/2' : 'top-[9px]'}`}
                    >
                      <AppendConnectorTrigger
                        handleId={branch.id}
                        isDisabled={isConnected}
                        wrapperClassName={`absolute left-0 z-10 h-6 w-6 -translate-x-1/2 ${isElseBranch ? 'top-1/2 -translate-y-1/2' : 'top-0 -translate-y-0'}`}
                        visual={
                          <span
                            aria-hidden
                            className={`${appendHandleButtonClass} pointer-events-none ${isConnected ? 'cursor-not-allowed bg-slate-300 hover:bg-slate-300' : ''}`}
                          >
                            +
                          </span>
                        }
                        onTriggerClick={() => {
                          setAppendSourceHandle(branch.id);
                          setMenuOpen((prev) => !prev || appendSourceHandle !== branch.id);
                        }}
                      />

                      {menuOpen && appendSourceHandle === branch.id ? (
                        <SearchBox
                          isOpen={menuOpen}
                          onClose={() => setMenuOpen(false)}
                          onAppendNode={(node) => appendNode(node, appendSourceHandle)}
                          menuRef={menuRef}
                          preferredSide="right"
                          scope={searchBoxScope}
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
            <ContainerNodeHeader kind={data.kind} title={data.title} />
          </div>
        ) : isNestedPlainNode ? (
          <NestedPlainNodeCard data={data} isSelected={!!data.selected} />
        ) : (
          <div>
            <ContainerNodeHeader kind={data.kind} title={data.title} />
            <WorkflowNodeSummary data={data} />
          </div>
        )}
      </div>

      {!isContainerStartNode ? (
        <NodeControl id={id} isActive={!!data.selected} onDelete={deleteNode} />
      ) : null}

      {canAppend && data.kind !== 'condition' && !isContainerStartNode ? (
        <div className="nodrag nopan absolute -right-3 top-1/2 z-30 -translate-y-1/2">
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
  const currentApp = appId ? getWorkflowAppById(appId) : undefined;

  const initialNodes = useMemo<Node<CanvasNodeData>[]>(() => {
    if (!appId) return [createInitialTriggerNode()];

    const app = getWorkflowAppById(appId);
    if (!app) return [createInitialTriggerNode()];

    return hydrateCanvasNodesFromDsl(app.dsl);
  }, [appId]);

  const initialEdges = useMemo<Edge[]>(() => {
    if (!appId) return [];

    const app = getWorkflowAppById(appId);
    if (!app) return [];

    return (app.dsl.edges as unknown as Edge[]).map(normalizeWorkflowEdge);
  }, [appId]);

  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNodeData>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<CommonEdgeType>(initialEdges);
  useWorkflowDraftPersistence({
    appId,
    appName: currentApp?.name,
    nodes,
    edges: edges as Edge[],
    setNodes,
    setEdges,
  });
  const updateNodeInternals = useUpdateNodeInternals();
  const { handleNodeClick, handlePaneClick, handlePanelClose } =
    useNodesInteractions<CanvasNodeData>({
      setNodes,
      setEdges,
    });

  useEffect(() => {
    if (!appId) return;

    const app = getWorkflowAppById(appId);
    if (!app) {
      setNodes([createInitialTriggerNode()]);
      setEdges([]);
      return;
    }

    setNodes(hydrateCanvasNodesFromDsl(app.dsl));
    setEdges((app.dsl.edges as Edge[]).map(normalizeWorkflowEdge));
  }, [appId, setEdges, setNodes]);

  useEffect(() => {
    setNodes((currentNodes) => {
      let changed = false;

      const nextNodes = currentNodes.map((node) => {
        const connectedSourceHandleIds = edges
          .filter((edge) => edge.source === node.id)
          .map((edge) => edge.sourceHandle ?? 'out');

        if (
          areStringArraysEqual(node.data._connectedSourceHandleIds ?? [], connectedSourceHandleIds)
        ) {
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
        const normalizedDatasetIds = datasetIds.filter((datasetId) =>
          datasets.some((dataset) => dataset.id === datasetId),
        );
        const nextDatasets = getKnowledgeDatasetsByIds(normalizedDatasetIds);

        if (
          areStringArraysEqual(datasetIds, normalizedDatasetIds) &&
          areKnowledgeDatasetsEqual(node.data._datasets ?? [], nextDatasets)
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
        const sourceNode = nodes.find((node) => node.id === edge.source);
        const targetNode = nodes.find((node) => node.id === edge.target);
        const isInternalEdge = Boolean(
          sourceNode?.parentId && sourceNode.parentId === targetNode?.parentId,
        );
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

  const selectedNode = useMemo(() => {
    const currentNode = nodes.find((node) => node.data.selected);

    if (!currentNode) return undefined;

    return {
      id: currentNode.id,
      type: currentNode.type,
      data: currentNode.data,
    };
  }, [nodes]);

  const workflowDslPreview = useMemo(
    () => createWorkflowDslFromCanvas(nodes, edges as Edge[], currentApp?.name),
    [currentApp?.name, edges, nodes],
  );
  const checklistCount = useMemo(() => {
    return nodes.filter((node) => node.data.kind !== 'trigger').length;
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
              strokeWidth: WORKFLOW_EDGE_STROKE_WIDTH,
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
        {/* header 抽离 */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
              Draft
            </p>
            <EditingTitle />
          </div>
          <div className="right-operator flex items-center">
            <div className="inline-flex items-center gap-0.5 rounded-[18px] bg-white/96 p-0.5 shadow-[0_16px_32px_-28px_rgba(15,23,42,0.36)] ring-1 ring-slate-950/5 backdrop-blur">
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-[14px] bg-[linear-gradient(180deg,#ffffff_0%,#eef5ff_100%)] px-3 text-[13px] font-semibold text-blue-700 transition hover:text-blue-800"
              >
                <svg
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  fill="currentColor"
                  className="remixicon size-4"
                >
                  <path d="M8 18.3915V5.60846L18.2264 12L8 18.3915ZM6 3.80421V20.1957C6 20.9812 6.86395 21.46 7.53 21.0437L20.6432 12.848C21.2699 12.4563 21.2699 11.5436 20.6432 11.152L7.53 2.95621C6.86395 2.53993 6 3.01878 6 3.80421Z"></path>
                </svg>
                <span>测试运行</span>
              </button>

              <div className="h-5 w-px bg-slate-200" />

              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-[14px] px-2.5 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
              >
                <span className="flex h-5.5 w-5.5 items-center justify-center rounded-full bg-slate-50 text-slate-500 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)]">
                  <svg
                    viewBox="0 0 1024 1024"
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    p-id="9083"
                    width="16"
                    height="16"
                  >
                    <path
                      d="M326.2976 151.09632L163.38944 312.97536c-5.12 5.12-11.26912 7.17312-18.44224 7.17312-6.144 0-13.32224-2.05312-18.44224-7.17312L58.88512 244.33152c-10.24512-10.24512-10.24512-26.63936 0-35.86048 10.24512-10.24512 26.63936-10.24512 35.86048 0l50.2016 50.2016 144.46592-143.44192c10.24512-10.24512 26.63936-10.24512 35.86048 0 11.26912 9.22624 11.26912 25.62048 1.024 35.8656zM299.65824 511.744c0 58.40384-48.1536 106.55744-106.55744 106.55744-59.42272 0-106.55744-48.1536-106.55744-106.55744 0-58.39872 47.1296-106.55744 106.55744-106.55744 58.40384 0 106.55744 48.1536 106.55744 106.55744z m-51.23072 0c0-30.73536-24.59136-55.32672-55.32672-55.32672S137.77408 481.00864 137.77408 511.744c0 30.73536 24.59136 55.32672 55.32672 55.32672s55.32672-24.59136 55.32672-55.32672z m-55.32672 404.70528c-58.39872 0-106.55744-48.15872-106.55744-106.55744 0-58.40384 47.1296-106.55744 106.55744-106.55744 58.40384 0 106.55744 48.14848 106.55744 106.55744 0 58.39872-48.1536 106.55744-106.55744 106.55744z m0-51.23072a55.10144 55.10144 0 0 0 55.32672-55.32672c0-30.74048-24.59136-55.33184-55.32672-55.33184s-55.32672 24.59136-55.32672 55.33184a55.09632 55.09632 0 0 0 55.32672 55.32672z m755.10784-423.14752H411.33568c-14.34624 0-25.61536 11.26912-25.61536 25.61536 0 14.34112 11.26912 25.61536 25.61536 25.61536h535.84896c14.34624 0 25.61536-11.27424 25.61536-25.61536 0-14.34624-10.24512-25.61536-24.59136-25.61536z m0 88.1152H411.33568c-14.34624 0-25.61536 11.26912-25.61536 25.61536s11.26912 25.61024 25.61536 25.61024h535.84896c14.34624 0 25.61536-11.264 25.61536-25.61024s-10.24512-25.61536-24.59136-25.61536z m0 210.03264H411.33568c-14.34624 0-25.61536 11.26912-25.61536 25.61536s11.26912 25.61536 25.61536 25.61536h535.84896c14.34624 0 25.61536-11.26912 25.61536-25.61536s-10.24512-25.61536-24.59136-25.61536z m0 88.11008H411.33568c-14.34624 0-25.61536 11.27424-25.61536 25.61536 0 14.34624 11.26912 25.61536 25.61536 25.61536h535.84896c14.34624 0 25.61536-11.26912 25.61536-25.61536 0-14.34112-10.24512-25.61536-24.59136-25.61536z m0-684.40576H411.33568c-14.34624 0-25.61536 11.26912-25.61536 25.61536 0 14.34112 11.26912 25.61536 25.61536 25.61536h535.84896c14.34624 0 25.61536-11.27424 25.61536-25.61536 0-14.34624-10.24512-25.61536-24.59136-25.61536z m0 88.11008H411.33568c-14.34624 0-25.61536 11.27424-25.61536 25.61536 0 14.34624 11.26912 25.61024 25.61536 25.61024h535.84896c14.34624 0 25.61536-11.26912 25.61536-25.61024 0-14.34112-10.24512-25.61536-24.59136-25.61536z"
                      p-id="9084"
                    ></path>
                  </svg>
                </span>
                <span className="inline-flex min-w-4.5 items-center justify-center rounded-full bg-amber-500 px-1 py-0.5 text-[9px] font-bold leading-none text-white">
                  {checklistCount}
                </span>
              </button>

              <div className="h-5 w-px bg-slate-200" />

              <div className="flex items-center gap-0.5 pr-0.5">
                <DslPreviewDialog
                  appId={appId}
                  appName={currentApp?.name}
                  dsl={workflowDslPreview}
                  nodeCount={nodes.length}
                  edgeCount={edges.length}
                  trigger={
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-[14px] text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                      aria-label="查看 DSL"
                    >
                      <svg
                        viewBox="0 0 1024 1024"
                        version="1.1"
                        xmlns="http://www.w3.org/2000/svg"
                        p-id="5830"
                        width="20"
                        height="20"
                      >
                        <path
                          d="M778.638222 533.333333V394.638222H640c-20.650667 0-38.229333-7.281778-52.792889-21.845333a71.964444 71.964444 0 0 1-21.902222-52.792889V181.304889H298.666667c-35.555556 0-53.361778 17.806222-53.361778 53.361778v298.666666a32.028444 32.028444 0 0 1-64 0v-298.666666c0-32.426667 11.491556-60.074667 34.360889-82.944a113.038222 113.038222 0 0 1 83.000889-34.417778h298.666666c8.476444 0 16.611556 3.413333 22.584889 9.386667l213.333334 213.333333a31.971556 31.971556 0 0 1 9.386666 22.641778v170.666666a31.971556 31.971556 0 1 1-64 0z m-149.333333-213.333333a10.24 10.24 0 0 0 3.128889 7.566222 10.24 10.24 0 0 0 7.566222 3.072h93.411556l-104.106667-104.049778v93.411556zM137.102222 719.644444h2.218667l52.451555-103.879111H258.844444L167.992889 781.084444v104.220445H108.373333V781.084444L17.578667 615.765333h67.015111l52.451555 103.879111z m194.673778-103.879111h79.872l83.797333 269.596445H430.876444l-14.677333-52.167111H327.111111l-14.677333 52.110222H248.035556l83.740444-269.539556z m71.68 171.861334l-30.833778-109.340445h-1.934222l-30.72 109.340445h63.488z m256.113778 3.185777h2.844444l63.089778-175.047111h74.296889v269.596445H741.262222v-173.852445h-2.048l-59.676444 172.259556h-37.319111l-59.619556-173.112889h-2.048v174.648889H522.183111v-269.539556h74.296889l63.032889 175.047111z m237.795555-175.047111v220.842667h103.253334v48.753778h-163.271111v-269.653334h60.017777z"
                          p-id="5831"
                        ></path>
                      </svg>
                    </button>
                  }
                />
              </div>
            </div>
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden rounded-b-3xl">
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
            connectionLineStyle={{
              stroke: '#94a3b8',
              strokeWidth: WORKFLOW_EDGE_STROKE_WIDTH,
            }}
            selectionMode={SelectionMode.Partial}
            minZoom={0.25}
            multiSelectionKeyCode={null}
            deleteKeyCode={null}
            nodesDraggable
            nodesConnectable
            connectOnClick={false}
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

          <Panel selectedNode={selectedNode} onClose={handlePanelClose} />
        </div>
      </div>
    </section>
  );
};
