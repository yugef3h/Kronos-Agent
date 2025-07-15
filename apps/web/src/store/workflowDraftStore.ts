import { create } from 'zustand';
import type { WorkflowDSL } from '../features/workflow/workflowAppStore';

export type WorkflowDraftBackup = {
  appId: string;
  dsl: WorkflowDSL;
  createdAt: number;
};

type WorkflowDraftState = {
  currentAppId: string | null;
  draftUpdatedAt: number | null;
  publishedAt: number | null;
  isSyncingWorkflowDraft: boolean;
  backupDraft?: WorkflowDraftBackup;
  setCurrentApp: (appId: string | null, payload?: { draftUpdatedAt?: number | null; publishedAt?: number | null }) => void;
  setDraftUpdatedAt: (value: number | null) => void;
  setPublishedAt: (value: number | null) => void;
  setIsSyncingWorkflowDraft: (value: boolean) => void;
  setBackupDraft: (snapshot?: WorkflowDraftBackup) => void;
};

export const useWorkflowDraftStore = create<WorkflowDraftState>((set) => ({
  currentAppId: null,
  draftUpdatedAt: null,
  publishedAt: null,
  isSyncingWorkflowDraft: false,
  backupDraft: undefined,
  setCurrentApp: (appId, payload) => set((state) => ({
    currentAppId: appId,
    draftUpdatedAt: payload?.draftUpdatedAt ?? null,
    publishedAt: payload?.publishedAt ?? null,
    isSyncingWorkflowDraft: false,
    backupDraft: state.backupDraft?.appId === appId ? state.backupDraft : undefined,
  })),
  setDraftUpdatedAt: (value) => set({ draftUpdatedAt: value }),
  setPublishedAt: (value) => set({ publishedAt: value }),
  setIsSyncingWorkflowDraft: (value) => set({ isSyncingWorkflowDraft: value }),
  setBackupDraft: (snapshot) => set({ backupDraft: snapshot }),
}));