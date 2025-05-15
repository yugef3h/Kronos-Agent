import { useCallback, useMemo, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from 'reactflow';
import { Link, useSearchParams } from 'react-router-dom';

import 'reactflow/dist/style.css';
import { ITERATION_CHILDREN_Z_INDEX, NODE_WIDTH_X_OFFSET, START_INITIAL_POSITION } from '../const/workflow';

type CanvasNodeKind = 'trigger' | 'agent' | 'end';
type AppendableNodeKind = Exclude<CanvasNodeKind, 'trigger'>;

type CanvasNodeData = {
  kind: CanvasNodeKind;
  title: string;
  subtitle: string;
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

const createNodeFromSource = (sourceNode: Node<CanvasNodeData>, kind: AppendableNodeKind, index: number): Node<CanvasNodeData> => {
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
            source: id,
            target: nextNode.id,
            sourceHandle: 'out',
            targetHandle: 'in',
            type: 'smoothstep',
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#94a3b8',
            },
            style: {
              stroke: '#94a3b8',
              strokeWidth: 1.6,
            },
          },
          edges,
        ),
      );

      setMenuOpen(false);
    },
    [getEdges, getNode, id, setEdges, setNodes],
  );

  return (
    <div className="group relative min-w-[220px] rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.55)] transition hover:border-blue-300">
      {data.kind !== 'trigger' ? <Handle id="in" type="target" position={Position.Left} className="!h-2.5 !w-2.5 !border-2 !border-white !bg-blue-500" /> : null}
      {data.kind !== 'end' ? <Handle id="out" type="source" position={Position.Right} className="!h-2.5 !w-2.5 !border-2 !border-white !bg-blue-500" /> : null}

      <p className="text-xs font-semibold text-slate-500">{data.subtitle}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{data.title}</p>

      {canAppend ? (
        <div className="absolute -right-4 top-1/2 -translate-y-1/2">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-blue-200 bg-white text-lg font-semibold text-blue-600 opacity-0 shadow-sm transition group-hover:opacity-100 hover:bg-blue-50"
            onClick={(event) => {
              event.stopPropagation();
              setMenuOpen((prev) => !prev);
            }}
          >
            +
          </button>

          {menuOpen ? (
            <div
              className="absolute left-10 top-1/2 z-20 w-40 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                onClick={() => appendNode('agent')}
              >
                添加 LLM
              </button>
              <button
                type="button"
                className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                onClick={() => appendNode('end')}
              >
                添加结束
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

const nodeTypes = {
  workflow: WorkflowNode,
};

export const WorkflowDraftPage = () => {
  const [searchParams] = useSearchParams();
  const appId = searchParams.get('appId');

  const initialNodes = useMemo<Node<CanvasNodeData>[]>(
    () => {
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
      const firstNode = nodes[0]

      if (!firstNode?.position) {
        nodes.forEach((node, index) => {
          node.position = {
            x: START_INITIAL_POSITION.x + index * NODE_WIDTH_X_OFFSET,
            y: START_INITIAL_POSITION.y,
          }
        })
      }
      return nodes;
    },
    [],
  );

  const [nodes, , onNodesChange] = useNodesState<CanvasNodeData>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || connection.source === connection.target) {
        return;
      }

      const edgeId = `${connection.source}-${connection.sourceHandle ?? 'out'}-${connection.target}-${connection.targetHandle ?? 'in'}`;
      setEdges((current) => {
        if (current.some((item) => item.id === edgeId)) {
          return current;
        }

        return addEdge(
          {
            ...connection,
            id: edgeId,
            type: 'smoothstep',
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#94a3b8',
            },
            style: {
              stroke: '#94a3b8',
              strokeWidth: 1.6,
            },
          },
          current,
        );
      });
    },
    [setEdges],
  );

  if (!appId) {
    return (
      <section className="space-y-4">
        <div className="rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-5 shadow-[0_24px_60px_-32px_rgba(217,119,6,0.32)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">No App Selected</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-900">尚未选择应用</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            请先回到 Workflow 空间，通过“创建空白应用”弹窗完成初始化，再进入本页。
          </p>
          <Link
            to="/workflow?create=blank"
            className="mt-4 inline-flex rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700"
          >
            去创建空白应用
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">

      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-[0_24px_60px_-32px_rgba(15,23,42,0.25)]">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">Draft</p>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">应用 ID：{appId}</span>
        </div>

        <div className="h-[68vh] min-h-[480px] overflow-hidden rounded-b-3xl">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            connectionLineContainerStyle={{ zIndex: ITERATION_CHILDREN_Z_INDEX }}
            minZoom={0.25}
            multiSelectionKeyCode={null}
            deleteKeyCode={null}
            nodesDraggable
            nodesConnectable={false}
            nodesFocusable={false}
            edgesFocusable={false}
            panOnScroll={false}
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
