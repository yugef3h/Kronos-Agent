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
  useUpdateNodeInternals,
  type Connection,
  type Node,
  type NodeMouseHandler,
  type NodeProps,
  type ReactFlowInstance,
} from 'reactflow';
import { useSearchParams } from 'react-router-dom';
import { getWorkflowAppById, loadWorkflowAppById, type WorkflowAppRecord } from '../../app/workflowAppStore';
import {
  isWorkflowReadOnlyExampleAppId,
  WORKFLOW_EXAMPLES_CHANGED_EVENT,
} from '../../app/workflowExampleClient';
import {
  type OpenNodePanelHandler,
  useWorkflowCanvasInteraction,
  WorkflowCanvasInteractionProvider,
} from '../context/workflow-canvas-interaction-context';
import { focusWorkflowNodeOnCanvas } from '../utils/focus-workflow-node-on-canvas';
import { resolveDraftRunFocusNodeId } from '../utils/resolve-draft-run-focus-node';
import {
  useWorkflowCanvasNodes,
  WorkflowCanvasNodesProvider,
} from '../context/workflow-canvas-nodes-context';
import {
  collectEditorStateFromCanvasNodes,
  mergePersistedEditorStateIntoNodes,
  readPersistedWorkflowEditorState,
  writePersistedWorkflowEditorState,
} from '../utils/workflow-node-editor-state';
import { WorkflowCanvasNodeDebugRegistryProvider } from '../context/workflow-canvas-node-debug-registry';
import {
  WORKFLOW_READONLY_EXAMPLE_LABEL,
  useWorkflowReadOnly,
  WorkflowReadOnlyProvider,
} from '../context/workflow-read-only-context';
import { useCanvasNodeQuickRun } from '../hooks/use-canvas-node-quick-run';
import { validateCanvasNodeQuickRun } from '../utils/validate-canvas-node-quick-run';
import { useWorkflowAppId } from '../hooks/use-workflow-app-id';
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
} from '../panels/container-panel/canvas';
import { createWorkflowEdgeData } from '../utils/edge-data';
import {
  createInitialTriggerNode,
  createWorkflowDslFromCanvas,
  hydrateCanvasNodesFromDsl,
} from '../utils/workflow-dsl';
import { useContainerNodeSync } from '../hooks/use-container-node-sync';
import { useNodesInteractions } from '../hooks/use-nodes-interactions';
import {
  useWorkflowDraftPersistence,
} from '../hooks/use-workflow-draft-persistence';
import { captureWorkflowDraftPreview } from '../utils/capture-workflow-draft-preview';
import Panel from '../compts/panel';
import NodeControl from '../compts/node-control';
import { IconCondition } from '../assets/condition';
import {
  ContainerNodeBoard,
  ContainerNodeHeader,
  NestedEndNodeCard,
  NestedPlainNodeCard,
} from '../compts/container-node-ui';
import NodeRunStatusIcon from '../compts/node-run-status-icon';
import WorkflowRunSummaryBar from '../compts/workflow-run-summary-bar';
import { WorkflowDraftTestRunProvider } from '../context/workflow-draft-test-run-context';
import { WorkflowMockPublishButton } from '../compts/workflow-mock-publish-button';
import { WorkflowTestRunButton } from './workflow-test-run-button';
import { ContainerStartNode } from '../compts/container-start-node';
import WorkflowNodeSummary from '../compts/workflow-node-summary';
import type { VariableOption } from '../panels/llm-panel/types';
import { normalizeLLMNodeConfig, validateLLMNodeConfig } from '../panels/llm-panel/schema';
import {
  buildIfElseConditionSummary,
  buildIfElseTargetBranches,
  normalizeIfElseNodeConfig,
  validateIfElseNodeConfig,
} from '../panels/ifelse-panel/schema';
import type { IfElseCaseItem } from '../panels/ifelse-panel/types';
import {
  normalizeIterationNodeConfig,
  validateIterationNodeConfig,
} from '../panels/iteration-panel/schema';
import {
  getKnowledgeDatasetsByIds,
  useKnowledgeDatasets,
} from '../panels/knowledge-retrieval-panel/dataset-store';
import {
  normalizeKnowledgeRetrievalNodeConfig,
  validateKnowledgeRetrievalNodeConfig,
} from '../panels/knowledge-retrieval-panel/schema';
import { normalizeEndNodeConfig, validateEndNodeConfig } from '../panels/end-panel/schema';
import { normalizeStartNodeConfig, validateStartNodeConfig } from '../panels/start-panel/schema';
import { normalizeLoopNodeConfig, validateLoopNodeConfig } from '../panels/loop-panel/schema';
import { buildWorkflowVariableOptions } from '../utils/variable-options';
import { getNodeRunBorderClass } from '../utils/get-node-run-border-class';
import { validateRunnableDsl } from '../utils/validate-runnable-dsl';
import type { WorkflowDraftNodeRunRecord } from '../../app/workflowRunApi';
import { useWorkflowDraftRun } from '../hooks/use-workflow-draft-run';
import type { WorkflowRunSummary } from '../types/run';
import { NodeRunningStatus } from '../types/common';
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

import { AppendConnectorTrigger } from './AppendConnectorTrigger';

import { WorkflowNode, nodeTypes, edgeTypes, type ChecklistGroup, type ChecklistIssue } from './WorkflowNode';

export const WorkflowChildren = () => {
  const [searchParams] = useSearchParams();
  const appId = searchParams.get('appId');
  const {
    datasets,
    isLoading: isKnowledgeDatasetsLoading,
    hasHydrated: hasKnowledgeDatasetsHydrated,
    errorMessage: knowledgeDatasetsErrorMessage,
  } = useKnowledgeDatasets();
  const [syncedApp, setSyncedApp] = useState<WorkflowAppRecord | undefined>(() =>
    appId ? getWorkflowAppById(appId) : undefined,
  );
  const hydratedForAppIdRef = useRef<string | null>(null);
  const currentApp = syncedApp;
  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null);
  const reactFlowCaptureRef = useRef<HTMLDivElement | null>(null);
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);
  const checklistPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isChecklistOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof globalThis.Node)) return;
      if (checklistPopoverRef.current?.contains(target)) return;
      setIsChecklistOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsChecklistOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isChecklistOpen]);

  useEffect(() => {
    if (!appId) {
      setSyncedApp(undefined);
      return;
    }

    let cancelled = false;

    const refreshSyncedApp = () => {
      if (!cancelled) {
        setSyncedApp(getWorkflowAppById(appId));
      }
    };

    refreshSyncedApp();

    void loadWorkflowAppById(appId).then((app) => {
      if (!cancelled && app) {
        setSyncedApp(app);
      }
    });

    window.addEventListener('kronos:workflow-apps-changed', refreshSyncedApp);
    window.addEventListener(WORKFLOW_EXAMPLES_CHANGED_EVENT, refreshSyncedApp);

    return () => {
      cancelled = true;
      window.removeEventListener('kronos:workflow-apps-changed', refreshSyncedApp);
      window.removeEventListener(WORKFLOW_EXAMPLES_CHANGED_EVENT, refreshSyncedApp);
    };
  }, [appId]);

  const initialNodes = useMemo<Node<CanvasNodeData>[]>(() => {
    if (!syncedApp) {
      return [createInitialTriggerNode()];
    }

    return hydrateCanvasNodesFromDsl(syncedApp.dsl);
  }, [syncedApp]);

  const initialEdges = useMemo<Edge[]>(() => {
    if (!syncedApp) {
      return [];
    }

    return (syncedApp.dsl.workflow.graph.edges as Edge[]).map(normalizeWorkflowEdge);
  }, [syncedApp]);

  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNodeData>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<CommonEdgeType>(initialEdges);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  const getCanvasSnapshot = useCallback(
    () => ({ nodes: nodesRef.current, edges: edgesRef.current }),
    [],
  );

  const { handleNodeClick: handleNodeClickBase, handlePaneClick, handlePanelClose } =
    useNodesInteractions<CanvasNodeData>({
      setNodes,
      setEdges,
    });

  const selectNodeById = useCallback(
    (nodeId?: string) => {
      setNodes((currentNodes) => applyNodeSelection(currentNodes, nodeId));
      setEdges((currentEdges) => applyConnectedEdgeSelection(currentEdges, nodeId));
    },
    [setEdges, setNodes],
  );

  const openNodePanelRef = useRef<OpenNodePanelHandler | null>(null);
  const registerOpenNodePanel = useCallback((handler: OpenNodePanelHandler | null) => {
    openNodePanelRef.current = handler;
  }, []);

  const focusDraftRunNode = useCallback(
    (nodeId: string) => {
      selectNodeById(nodeId);
      openNodePanelRef.current?.(nodeId, 'last-run');
      focusWorkflowNodeOnCanvas(reactFlowInstanceRef, nodeId);
    },
    [selectNodeById],
  );

  const draftRunUi = useMemo(
    () => ({
      onNodeStarted: focusDraftRunNode,
      onFocusNode: focusDraftRunNode,
      onWorkflowFinished: (run: WorkflowRunSummary, nodeRuns: WorkflowDraftNodeRunRecord[]) => {
        const focusNodeId = resolveDraftRunFocusNodeId(nodesRef.current, { nodeRuns, run });
        if (focusNodeId) {
          focusDraftRunNode(focusNodeId);
        }
      },
    }),
    [focusDraftRunNode],
  );

  const handleNodeClick = useCallback<NodeMouseHandler>(
    (event, node) => {
      if (node.data.kind === 'iteration-end' || node.data.kind === 'loop-end') {
        handlePanelClose();
        return;
      }

      handleNodeClickBase(event, node);
    },
    [handleNodeClickBase, handlePanelClose],
  );

  const {
    runSummary,
    isRunning: isDraftRunRunning,
    isDraftRunActive,
    error: draftRunError,
    executeDraftRun,
    cancelDraftRun,
  } = useWorkflowDraftRun({
    appId,
    getCanvas: getCanvasSnapshot,
    setNodes,
    setEdges,
    ui: draftRunUi,
  });
  const isReadOnlyExample = Boolean(appId && isWorkflowReadOnlyExampleAppId(appId));
  const isCanvasLocked = isDraftRunActive || isReadOnlyExample;

  const patchNodeData = useCallback(
    (nodeId: string, patch: Partial<CanvasNodeData>) => {
      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  ...patch,
                },
              }
            : node,
        ),
      );
    },
    [setNodes],
  );

  const onNodesChangeGuarded = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      if (isReadOnlyExample) {
        const allowed = changes.filter((change) =>
          change.type === 'select' || change.type === 'dimensions',
        );
        if (allowed.length > 0) {
          onNodesChange(allowed);
        }
        return;
      }
      onNodesChange(changes);
    },
    [isReadOnlyExample, onNodesChange],
  );

  const onEdgesChangeGuarded = useCallback(
    (changes: Parameters<typeof onEdgesChange>[0]) => {
      if (isReadOnlyExample) {
        const allowed = changes.filter((change) => change.type === 'select');
        if (allowed.length > 0) {
          onEdgesChange(allowed);
        }
        return;
      }
      onEdgesChange(changes);
    },
    [isReadOnlyExample, onEdgesChange],
  );

  const captureDraftPreview = useCallback(
    () => captureWorkflowDraftPreview(reactFlowCaptureRef.current),
    [],
  );
  useWorkflowDraftPersistence({
    appId,
    appName: currentApp?.name,
    nodes,
    edges: edges as Edge[],
    setNodes,
    setEdges,
    captureDraftPreview,
  });
  const updateNodeInternals = useUpdateNodeInternals();

  const onPaneClick = useCallback(() => {
    const selectedNode = nodes.find((node) => node.data.selected);
    // 除非点到新的node，否则panel不能关闭的，比如点击无节点的画布空处
    if (
      selectedNode &&
      selectedNode.data.kind !== 'iteration-end' &&
      selectedNode.data.kind !== 'loop-end'
    ) {
      return;
    }

    handlePaneClick();
  }, [nodes, handlePaneClick]);

  useEffect(() => {
    hydratedForAppIdRef.current = null;
  }, [appId]);

  useEffect(() => {
    if (!appId || !syncedApp) {
      return;
    }

    if (hydratedForAppIdRef.current === appId) {
      return;
    }

    hydratedForAppIdRef.current = appId;

    const hydratedNodes = hydrateCanvasNodesFromDsl(syncedApp.dsl);
    const persistedEditorState = readPersistedWorkflowEditorState(appId);

    setNodes(mergePersistedEditorStateIntoNodes(hydratedNodes, persistedEditorState));
    setEdges((syncedApp.dsl.workflow.graph.edges as Edge[]).map(normalizeWorkflowEdge));
  }, [appId, syncedApp, setEdges, setNodes]);

  useEffect(() => {
    if (!appId) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      const previous = readPersistedWorkflowEditorState(appId)
      const collected = collectEditorStateFromCanvasNodes(nodesRef.current)
      writePersistedWorkflowEditorState(appId, {
        nodes: {
          ...(previous?.nodes ?? {}),
          ...collected.nodes,
        },
      })
    }, 400);

    return () => {
      window.clearTimeout(timer);
    };
  }, [appId, nodes]);

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
    if (!hasKnowledgeDatasetsHydrated || isKnowledgeDatasetsLoading || knowledgeDatasetsErrorMessage) {
      return;
    }

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
  }, [
    datasets,
    hasKnowledgeDatasetsHydrated,
    isKnowledgeDatasetsLoading,
    knowledgeDatasetsErrorMessage,
    setNodes,
  ]);

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
  const runnableValidation = useMemo(
    () => validateRunnableDsl(workflowDslPreview),
    [workflowDslPreview],
  );
  const checklistGroups = useMemo<ChecklistGroup[]>(() => {
    const translateLLMIssue = (issue: ChecklistIssue) => {
      if (issue.path === 'promptTemplate') {
        return { ...issue, message: '提示词 不能为空' };
      }
      if (issue.path === 'model') {
        return { ...issue, message: '请选择模型' };
      }
      if (issue.path === 'memory.queryPromptTemplate') {
        return { ...issue, message: '记忆 Query Prompt 必须包含 {{#sys.query#}}' };
      }
      if (issue.path === 'vision.configs.variableSelector') {
        return { ...issue, message: '请选择视觉变量' };
      }
      return issue;
    };

    return nodes.reduce<ChecklistGroup[]>((acc, node) => {
      const title = node.data.title || '未命名节点';
      let issues: ChecklistIssue[] = [];

      if (node.data.kind === 'trigger') {
        const config = normalizeStartNodeConfig(node.data.inputs);
        issues = validateStartNodeConfig(config).map((issue) => ({
          path: issue.path,
          message: issue.message,
        }));
      } else if (node.data.kind === 'llm') {
        const config = normalizeLLMNodeConfig(node.data.inputs);
        issues = validateLLMNodeConfig(config)
          .map((issue) => ({ path: issue.path, message: issue.message }))
          .map(translateLLMIssue);
      } else if (node.data.kind === 'knowledge') {
        const config = normalizeKnowledgeRetrievalNodeConfig(node.data.inputs);
        issues = validateKnowledgeRetrievalNodeConfig(config).map((issue) => ({
          path: issue.path,
          message: issue.message,
        }));
      } else if (node.data.kind === 'end') {
        const config = normalizeEndNodeConfig(node.data.inputs, node.data.outputs);
        issues = validateEndNodeConfig(config).map((issue) => ({
          path: issue.path,
          message: issue.message,
        }));
      } else if (node.data.kind === 'condition') {
        const config = normalizeIfElseNodeConfig(node.data.inputs);
        issues = validateIfElseNodeConfig(config).map((issue) => ({
          path: issue.path,
          message: issue.message,
        }));
      } else if (node.data.kind === 'iteration') {
        const config = normalizeIterationNodeConfig(node.data.inputs, node.id);
        issues = validateIterationNodeConfig(config).map((issue) => ({
          path: issue.path,
          message: issue.message,
        }));
      } else if (node.data.kind === 'loop') {
        const config = normalizeLoopNodeConfig(node.data.inputs, node.id);
        issues = validateLoopNodeConfig(config).map((issue) => ({
          path: issue.path,
          message: issue.message,
        }));
      }

      if (!issues.length) {
        return acc;
      }

      acc.push({
        nodeId: node.id,
        title,
        issues,
      });

      return acc;
    }, []);
  }, [nodes]);
  const checklistCount = checklistGroups.length;
  const triggerNode = useMemo(
    () => nodes.find((node) => node.data.kind === 'trigger'),
    [nodes],
  );
  const requiredIssueCountByNodeId = useMemo(() => {
    return checklistGroups.reduce<Record<string, number>>((acc, group) => {
      acc[group.nodeId] = group.issues.length;
      return acc;
    }, {});
  }, [checklistGroups]);

  useEffect(() => {
    setNodes((currentNodes) => {
      let changed = false;

      const nextNodes = currentNodes.map((node) => {
        const nextRequiredIssueCount = requiredIssueCountByNodeId[node.id] ?? 0;
        if ((node.data._requiredIssueCount ?? 0) === nextRequiredIssueCount) {
          return node;
        }

        changed = true;
        return {
          ...node,
          data: {
            ...node.data,
            _requiredIssueCount: nextRequiredIssueCount,
          },
        };
      });

      return changed ? nextNodes : currentNodes;
    });
  }, [requiredIssueCountByNodeId, setNodes]);

  const handleGoToFix = useCallback(
    (nodeId: string) => {
      setIsChecklistOpen(false);
      selectNodeById(nodeId);

      requestAnimationFrame(() => {
        const instance = reactFlowInstanceRef.current;
        const targetNode = instance?.getNode(nodeId);
        if (!instance || !targetNode) return;
        // 缩放跳转到目标节点
        instance.fitView({ nodes: [targetNode], padding: 0.35, duration: 350, maxZoom: 1 });
      });
    },
    [selectNodeById],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (isCanvasLocked) {
        return;
      }

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
    [isCanvasLocked, nodes, setEdges],
  );

  if (!appId) {
    return <EmptyView />;
  }

  return (
    <WorkflowReadOnlyProvider isReadOnly={isReadOnlyExample}>
    <WorkflowCanvasNodeDebugRegistryProvider>
    <WorkflowCanvasInteractionProvider
      isCanvasLocked={isCanvasLocked}
      isDraftRunActive={isDraftRunActive}
      selectNodeById={selectNodeById}
      registerOpenNodePanel={registerOpenNodePanel}
    >
    <WorkflowCanvasNodesProvider
      nodes={nodes}
      edges={edges as Edge[]}
      setNodes={setNodes}
      setEdges={setEdges}
      patchNodeData={patchNodeData}
    >
    <WorkflowDraftTestRunProvider>
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_24px_60px_-32px_rgba(15,23,42,0.25)]">
        {/* header 抽离 */}
        <div className="relative z-20 flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
              Draft
            </p>
            {isReadOnlyExample ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200/80">
                {WORKFLOW_READONLY_EXAMPLE_LABEL}
              </span>
            ) : null}
            </div>
            {/* 自动保存：画布 DSL 变更后防抖 {WORKFLOW_DRAFT_PERSIST_DEBOUNCE_MS}ms 写入 localStorage，并尝试更新列表缩略图（≥1 个节点） */}
            <EditingTitle />
          </div>
          <div className="right-operator flex min-w-0 shrink-0 items-center">
            <div className="inline-flex max-w-full shrink-0 items-center gap-0.5 overflow-x-auto rounded-[18px] bg-white/96 p-0.5 shadow-[0_16px_32px_-28px_rgba(15,23,42,0.36)] ring-1 ring-slate-950/5 backdrop-blur">
              <WorkflowTestRunButton
                appId={appId}
                checklistGroups={checklistGroups}
                runnableValidation={runnableValidation}
                workflowDslPreview={workflowDslPreview}
                triggerNode={triggerNode}
                isDraftRunRunning={isDraftRunRunning}
                reactFlowInstanceRef={reactFlowInstanceRef}
                executeDraftRun={executeDraftRun}
              />

              <div className="h-5 w-px shrink-0 bg-slate-200" />
              <WorkflowMockPublishButton appId={appId} compact />

              <div className="h-5 w-px shrink-0 bg-slate-200" />

              <div ref={checklistPopoverRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsChecklistOpen((current) => !current)}
                  disabled={!checklistCount}
                  className="inline-flex h-8 items-center gap-1.5 rounded-[14px] px-2.5 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
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

                {isChecklistOpen ? (
                  <div className="absolute right-0 top-full z-[1003] mt-2 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_-32px_rgba(15,23,42,0.35)]">
                    <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold text-slate-900">
                          检查清单({checklistCount})
                        </p>
                        <p className="mt-0.5 text-[12px] text-slate-500">发布前请解决以下问题</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsChecklistOpen(false)}
                        className="shrink-0 rounded-full p-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                        aria-label="关闭"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          fill="currentColor"
                        >
                          <path d="M11.9997 10.5855L16.9495 5.63574L18.3637 7.04996L13.4139 11.9997L18.3637 16.9495L16.9495 18.3637L11.9997 13.4139L7.04996 18.3637L5.63574 16.9495L10.5855 11.9997L5.63574 7.04996L7.04996 5.63574L11.9997 10.5855Z"></path>
                        </svg>
                      </button>
                    </div>

                    <div className="max-h-[min(60dvh,340px)] overflow-auto px-4 py-3">
                      {!checklistGroups.length ? (
                        <div className="flex min-h-[120px] items-center justify-center text-[12px] text-slate-500">
                          暂无需要修复的问题
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {checklistGroups.map((group) => (
                            <div key={group.nodeId} className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[13px] font-semibold text-slate-900">
                                    {group.title}
                                  </p>
                                  <div className="mt-1.5 space-y-1">
                                    {group.issues.map((issue) => (
                                      <div
                                        key={`${issue.path}-${issue.message}`}
                                        className="flex items-start gap-2 text-[12px] font-semibold text-amber-600"
                                      >
                                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                                        <span className="min-w-0 flex-1">{issue.message}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleGoToFix(group.nodeId)}
                                  className="shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold text-blue-600 transition hover:bg-blue-50 hover:text-blue-700"
                                >
                                  <span>修复</span>
                                  <svg
                                    viewBox="0 0 24 24"
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="14"
                                    height="14"
                                    fill="currentColor"
                                  >
                                    <path d="M13.1716 12L8.22183 7.05029L9.63604 5.63608L16 12L9.63604 18.364L8.22183 16.9498L13.1716 12Z"></path>
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

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

        <div
          ref={reactFlowCaptureRef}
          className="relative z-0 min-h-0 flex-1 overflow-hidden rounded-b-3xl"
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onInit={(instance) => {
              reactFlowInstanceRef.current = instance;
            }}
            onNodesChange={onNodesChangeGuarded}
            onEdgesChange={onEdgesChangeGuarded}
            onConnect={onConnect}
            onNodeClick={handleNodeClick}
            onPaneClick={onPaneClick}
            connectionLineContainerStyle={{ zIndex: ITERATION_CHILDREN_Z_INDEX }}
            connectionLineStyle={{
              stroke: '#94a3b8',
              strokeWidth: WORKFLOW_EDGE_STROKE_WIDTH,
            }}
            selectionMode={SelectionMode.Partial}
            minZoom={0.25}
            multiSelectionKeyCode={null}
            deleteKeyCode={null}
            nodesDraggable={!isCanvasLocked}
            nodesConnectable={!isCanvasLocked}
            elementsSelectable
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

          <WorkflowRunSummaryBar
            run={runSummary}
            isRunning={isDraftRunRunning}
            error={draftRunError}
            onStop={isDraftRunRunning ? cancelDraftRun : undefined}
          />

          <Panel selectedNode={selectedNode} onClose={handlePanelClose} />
        </div>

      </div>
    </section>
    </WorkflowDraftTestRunProvider>
    </WorkflowCanvasNodesProvider>
    </WorkflowCanvasInteractionProvider>
    </WorkflowCanvasNodeDebugRegistryProvider>
    </WorkflowReadOnlyProvider>
  );
};
