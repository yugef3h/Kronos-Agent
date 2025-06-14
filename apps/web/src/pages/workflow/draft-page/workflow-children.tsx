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
} from '../features/ifelse-panel/schema';
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

const createNodeData = (node: NodeItem): CanvasNodeData => {
  return buildCanvasNodeData({
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
  const x = sourceNode.position.x + 320;
  const y = sourceNode.position.y + index * 120;

  return {
    id: createNodeId(node.kind),
    type: 'workflow',
    position: { x, y },
    data: createNodeData(node),
  };
};

const areStringArraysEqual = (left: string[] = [], right: string[] = []) => {
  if (left.length !== right.length)
    return false;

  return left.every((item, index) => item === right[index]);
};

const buildConditionNodeVariableOptions = (
  currentNodeId: string,
  nodes: Array<{ id: string; data: CanvasNodeData }>,
) : VariableOption[] => {
  const systemVariables: VariableOption[] = [
    { label: 'sys.query', valueSelector: ['sys', 'query'], valueType: 'string', source: 'system' },
    { label: 'sys.files', valueSelector: ['sys', 'files'], valueType: 'file', source: 'system' },
    { label: 'sys.conversation_id', valueSelector: ['sys', 'conversation_id'], valueType: 'string', source: 'system' },
  ];

  const nodeVariables: VariableOption[] = nodes
    .filter(node => node.id !== currentNodeId)
    .sort((left, right) => left.data.title.localeCompare(right.data.title, 'zh-CN'))
    .flatMap((node) => Object.keys(node.data.outputs ?? {}).map((outputKey) => ({
      label: `${node.data.title}.${outputKey}`,
      valueSelector: [node.id, outputKey],
      valueType: outputKey.includes('file')
        ? 'file'
        : outputKey === 'usage'
          ? 'object'
          : 'string',
      source: 'node',
    })))

  return [...systemVariables, ...nodeVariables];
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
        ? `min-w-[312px] rounded-[24px] border-[2px] px-4 py-4 shadow-[0_14px_32px_-28px_rgba(37,99,235,0.42)] ${data.selected ? 'border-blue-600' : 'border-blue-500'}`
        : `min-w-[220px] rounded-2xl border px-4 py-3 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.55)] ${data.selected ? 'border-components-option-card-option-selected-border' : 'border-slate-200 hover:border-blue-300'}`}`}
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
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#16b5d8] text-white shadow-[0_10px_20px_-18px_rgba(8,145,178,0.9)]">
              <IconCondition />
            </div>
            <div className="min-w-0 pt-0.5">
              <p className="text-[16px] font-semibold tracking-[0.01em] text-slate-900">{data.title}</p>
            </div>
          </div>

          <div className="mt-4 space-y-1.5">
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
                  className={`relative pr-12 ${isElseBranch ? 'min-h-[24px]' : 'min-h-[52px]'}`}
                >
                  {!isElseBranch ? (
                    <div className="rounded-xl bg-[#f5f7fb] px-2.5 py-1.5 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.7)]">
                      {index === 0 && conditionConfig && conditionConfig.cases.length > 1 ? (
                        <div className="mb-1 flex items-center">
                          <span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] font-medium text-slate-500 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9)]">
                            +{conditionConfig.cases.length - 1} ELIF
                          </span>
                        </div>
                      ) : null}
                      <div className="flex min-h-[34px] items-center gap-1.5 rounded-xl bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9)]">
                        <span className="line-clamp-1">{branchSummary}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="h-6" />
                  )}

                  <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] font-semibold tracking-[0.01em] text-slate-700">
                    {branch.name}
                  </span>

                  <div className="absolute right-[-16px] top-1/2 h-0 w-0 -translate-y-1/2 overflow-visible">
                    <Handle
                      id={branch.id}
                      type="source"
                      position={Position.Right}
                      className="!right-0 !top-1/2 !h-6 !w-6 !-translate-y-1/2 !translate-x-1/2 !rounded-full !border-2 !border-white !bg-blue-600 !opacity-100"
                    />
                    <button
                      type="button"
                      disabled={isConnected}
                      className="absolute left-0 top-1/2 z-10 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-blue-600 text-[14px] leading-none text-white shadow-[0_8px_16px_-14px_rgba(37,99,235,1)] transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300"
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
