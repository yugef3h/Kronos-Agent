export type WorkflowExampleGraphStats = {
  edgeCount: number;
  nodeCount: number;
  onlyStartShell: boolean;
};

const asGraph = (dsl: Record<string, unknown>): { nodes: unknown[]; edges: unknown[] } | null => {
  const workflow = dsl.workflow;
  if (!workflow || typeof workflow !== 'object') {
    return null;
  }
  const graph = (workflow as { graph?: unknown }).graph;
  if (!graph || typeof graph !== 'object') {
    return null;
  }
  const nodes = (graph as { nodes?: unknown }).nodes;
  const edges = (graph as { edges?: unknown }).edges;
  return {
    nodes: Array.isArray(nodes) ? nodes : [],
    edges: Array.isArray(edges) ? edges : [],
  };
};

export const getWorkflowExampleGraphStats = (dsl: Record<string, unknown>): WorkflowExampleGraphStats => {
  const graph = asGraph(dsl);
  if (!graph) {
    return { edgeCount: 0, nodeCount: 0, onlyStartShell: true };
  }

  const nodeCount = graph.nodes.length;
  const edgeCount = graph.edges.length;
  const onlyStartShell =
    nodeCount === 1 &&
    graph.nodes[0] != null &&
    typeof graph.nodes[0] === 'object' &&
    (graph.nodes[0] as { data?: { type?: string } }).data?.type === 'start';

  return { edgeCount, nodeCount, onlyStartShell };
};

/** 拒绝「整图被清空成只剩 start、无边」类误保存（相对磁盘上已有完整示例）。 */
export const isWorkflowExampleDestructiveDowngrade = (
  existing: WorkflowExampleGraphStats | null,
  incoming: WorkflowExampleGraphStats,
): boolean => {
  if (!existing) {
    return false;
  }

  if (existing.nodeCount >= 2 && incoming.onlyStartShell && incoming.edgeCount === 0) {
    return true;
  }

  if (existing.edgeCount >= 1 && incoming.edgeCount === 0 && incoming.nodeCount <= 1) {
    return true;
  }

  return false;
};
