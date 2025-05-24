import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  Controls,
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
import {
  CUSTOM_EDGE,
  ITERATION_CHILDREN_Z_INDEX,
  NODE_WIDTH_X_OFFSET,
  START_INITIAL_POSITION,
} from '../constants';
import CustomEdge from '../compts/custom-edge';
import { EmptyView } from '../compts/empty-view';
import { SearchBox } from '../compts/search-box';
import 'reactflow/dist/style.css';
import { BlockEnum, type Edge } from '../types/common';
import { createWorkflowEdgeData } from '../utils/edge-data';

type CanvasNodeKind = 'trigger' | 'agent' | 'end';
type AppendableNodeKind = Exclude<CanvasNodeKind, 'trigger'>;

type CanvasNodeData = {
  kind: CanvasNodeKind;
  title: string;
  subtitle: string;
};

const CANVAS_NODE_KIND_TO_BLOCK: Record<CanvasNodeKind, BlockEnum> = {
  trigger: BlockEnum.Start,
  agent: BlockEnum.LLM,
  end: BlockEnum.End,
};

const createNodeId = (kind: AppendableNodeKind): string => {
  const random = Math.random().toString(36).slice(2, 7);
  return `${kind}-${Date.now().toString(36)}-${random}`;
};

const createNodeData = (kind: AppendableNodeKind): CanvasNodeData => {
  if (kind === 'agent') {
    return {
      kind,
      title: 'LLM',
      subtitle: '豆包',
    };
  }

  return {
    kind,
    title: '结束',
    subtitle: '直接回复',
  };
};

const createNodeFromSource = (
  sourceNode: Node<CanvasNodeData>,
  kind: AppendableNodeKind,
  index: number,
): Node<CanvasNodeData> => {
  const x = sourceNode.position.x + 320;
  const y = sourceNode.position.y + index * 120;

  return {
    id: createNodeId(kind),
    type: 'workflow',
    position: { x, y },
    data: createNodeData(kind),
  };
};

const WorkflowNode = ({ id, data }: NodeProps<CanvasNodeData>) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { setNodes, setEdges, getNode, getEdges } = useReactFlow<CanvasNodeData, Edge>();
  const canAppend = data.kind !== 'end';

  const appendNode = useCallback(
    (kind: AppendableNodeKind) => {
      const sourceNode = getNode(id);
      if (!sourceNode) {
        return;
      }

      const childCount = getEdges().filter((edge) => edge.source === id).length;
      const nextNode = createNodeFromSource(sourceNode, kind, childCount);
      const edgeId = `${id}-out-${nextNode.id}-in`;

      setNodes((nodes) => [...nodes, nextNode]);
      setEdges((edges) =>
        addEdge(
          {
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
          },
          edges,
        ),
      );

      setMenuOpen(false);
    },
    [getEdges, getNode, id, setEdges, setNodes],
  );

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
    <div className="group relative min-w-[220px] rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.55)] transition hover:border-blue-300">
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

export const WorkflowDraftPage = () => {
  const [searchParams] = useSearchParams();
  const appId = searchParams.get('appId');

  const initialNodes = useMemo<Node<CanvasNodeData>[]>(() => {
    const nodes = [
      {
        id: 'trigger-1',
        type: 'workflow',
        data: {
          kind: 'trigger',
          title: '用户输入',
          subtitle: '开始',
        },
      },
    ] as Node<CanvasNodeData>[];
    const firstNode = nodes[0];

    if (!firstNode?.position) {
      nodes.forEach((node, index) => {
        node.position = {
          x: START_INITIAL_POSITION.x + index * NODE_WIDTH_X_OFFSET,
          y: START_INITIAL_POSITION.y,
        };
      });
    }
    return nodes;
  }, []);

  const [nodes, , onNodesChange] = useNodesState<CanvasNodeData>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

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
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_24px_60px_-32px_rgba(15,23,42,0.25)]">
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
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      </div>
    </section>
  );
};
