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
import 'reactflow/dist/style.css';

const CANVAS_NODE_KIND_TO_BLOCK: Record<AppendableNodeKind, BlockEnum> = {
  trigger: BlockEnum.Start,
  end: BlockEnum.End,
  llm: BlockEnum.LLM,
  knowledge: BlockEnum.LLM,
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

const WorkflowNode = ({ id, data }: NodeProps<CanvasNodeData>) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { setNodes, setEdges, getNode, getEdges } = useReactFlow<CanvasNodeData, Edge>();
  const canAppend = data.kind !== 'end';

  const appendNode = useCallback(
    (node: NodeItem) => {
      const sourceNode = getNode(id);
      if (!sourceNode) {
        return;
      }

      const childCount = getEdges().filter((edge) => edge.source === id).length;
      const nextNode = createNodeFromSource(sourceNode, node, childCount);
      const edgeId = `${id}-out-${nextNode.id}-in`;
      const nextEdge = {
        id: edgeId,
        type: CUSTOM_EDGE,
        source: id,
        target: nextNode.id,
        sourceHandle: 'out',
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
      className={`group relative min-w-[220px] rounded-2xl border bg-white px-4 py-3 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.55)] transition ${data.selected ? 'border-components-option-card-option-selected-border' : 'border-slate-200 hover:border-blue-300'}`}
    >
      {data.kind !== 'trigger' ? (
        <Handle
          id="in"
          type="target"
          position={Position.Left}
          className="!h-2.5 !w-2.5 !border-2 !border-white !bg-blue-500"
        />
      ) : null}
      {data.kind !== 'end' ? (
        <Handle
          id="out"
          type="source"
          position={Position.Right}
          className="!h-2.5 !w-2.5 !border-2 !border-white !bg-blue-500"
        />
      ) : null}

      <p className="text-xs font-semibold text-slate-500">{data.subtitle}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{data.title}</p>

      <NodeControl id={id} isActive={!!data.selected} onDelete={deleteNode} />

      {canAppend ? (
        <div className="absolute -right-3 top-1/2 -translate-y-1/2">
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded-full border border-blue-200 bg-white text-lg text-blue-600 opacity-0 shadow-sm transition group-hover:opacity-100 hover:bg-blue-50"
            onClick={(event) => {
              event.stopPropagation();
              setMenuOpen((prev) => !prev);
            }}
          >
            +
          </button>

          <SearchBox
            isOpen={menuOpen}
            onClose={() => setMenuOpen(false)}
            onAppendNode={appendNode}
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
