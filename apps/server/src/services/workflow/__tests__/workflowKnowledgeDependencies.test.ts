import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from '@jest/globals';
import {
  collectDatasetIdsFromWorkflowApp,
  findWorkflowExampleAppsUsingDataset,
} from './workflowKnowledgeDependencies.js';

const EXAMPLES_DIR = join(process.cwd(), 'apps/server/data/workflow-examples');
const DATASET_ID = 'ai工程师转型技能表-2026';

describe('workflowKnowledgeDependencies', () => {
  it('collects dataset ids from chatbot orchestration', async () => {
    const raw = await readFile(join(EXAMPLES_DIR, 'wf_mp4ylyaa_ip59jc.json'), 'utf-8');
    const app = JSON.parse(raw) as Parameters<typeof collectDatasetIdsFromWorkflowApp>[0];
    expect(collectDatasetIdsFromWorkflowApp(app)).toContain(DATASET_ID);
  });

  it('collects dataset ids from knowledge-retrieval nodes', async () => {
    const raw = await readFile(join(EXAMPLES_DIR, 'wf_mnvxgxnf_73oerm.json'), 'utf-8');
    const app = JSON.parse(raw) as Parameters<typeof collectDatasetIdsFromWorkflowApp>[0];
    expect(collectDatasetIdsFromWorkflowApp(app)).toContain(DATASET_ID);
  });

  it('finds example apps referencing dataset', async () => {
    const usages = await findWorkflowExampleAppsUsingDataset(DATASET_ID);
    expect(usages.length).toBe(2);
    expect(usages.map((u) => u.appName).sort()).toEqual(['AI 应用智能客服助手', 'RAG 聊天机器人']);
  });
});
