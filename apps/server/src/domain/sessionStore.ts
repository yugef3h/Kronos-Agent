import { readFile, writeFile, readdir, mkdir, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  CONTEXT_WINDOW_TOKENS,
  INPUT_BUDGET_RATIO,
  RESERVED_OUTPUT_TOKENS,
  SUMMARY_TRIGGER_MESSAGE_COUNT,
  estimateTextTokens,
} from '../services/memoryOrchestrator.js';

export type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export type Session = {
  lastId: number;
  messages: Message[];
  memorySummary: string;
  memorySummaryUpdatedAt: number | null;
};

export type RecentDialogueItem = {
  id: string;
  sessionId: string;
  updatedAt: number;
  userContent: string;
};

// 持久化目录：apps/server/data/sessions/（此文件位于 src/domain/，上溯两级到 server root）
const _dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(_dirname, '../../data/sessions');

const sessions = new Map<string, Session>();
const listDialoguesFromSessionSnapshots = async (limit: number): Promise<RecentDialogueItem[]> => {
  await mkdir(DATA_DIR, { recursive: true });
  const files = await readdir(DATA_DIR);
  const jsonFiles = files.filter((file) => file.endsWith('.json'));

  const dialogues = await Promise.all(
    jsonFiles.map(async (file) => {
      const filePath = join(DATA_DIR, file);

      try {
        const [raw, fileStat] = await Promise.all([readFile(filePath, 'utf-8'), stat(filePath)]);
        const session = JSON.parse(raw) as Session;
        const sessionId = file.slice(0, -5);
        for (let index = session.messages.length - 1; index >= 0; index -= 1) {
          const message = session.messages[index];
          if (message.role === 'user') {
            return {
              id: sessionId,
              sessionId,
              updatedAt: fileStat.mtimeMs,
              userContent: message.content,
            } satisfies RecentDialogueItem;
          }
        }

        return null;
      } catch {
        console.warn(`[sessionStore] 跳过无法读取的 session 文件: ${file}`);
        return null;
      }
    }),
  );

  return dialogues
    .filter((item): item is RecentDialogueItem => item !== null)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
};

/**
 * 将 session 序列化写盘，fire-and-forget，不阻塞主流程。
 * 每次对话轮次结束后调用，保证重启后历史可恢复。
 */
export const persistSession = async (sessionId: string, session: Session): Promise<void> => {
  try {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(join(DATA_DIR, `${sessionId}.json`), JSON.stringify(session), 'utf-8');
  } catch (err) {
    console.warn(`[sessionStore] 持久化 session ${sessionId} 失败:`, err);
  }
};

/**
 * 服务启动时调用：扫描 DATA_DIR，将所有已持久化的 session 加载进内存 Map。
 * 若文件损坏则跳过并打印警告，不中断启动流程。
 */
export const initSessionStore = async (): Promise<void> => {
  try {
    await mkdir(DATA_DIR, { recursive: true });
    const files = await readdir(DATA_DIR);
    let loaded = 0;

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const sessionId = file.slice(0, -5);
      try {
        const raw = await readFile(join(DATA_DIR, file), 'utf-8');
        const data = JSON.parse(raw) as Session;
        sessions.set(sessionId, data);
        loaded += 1;
      } catch {
        console.warn(`[sessionStore] 跳过损坏的 session 文件: ${file}`);
      }
    }

    console.warn(`[sessionStore] 已加载 ${loaded} 个 session`);
  } catch (err) {
    console.warn('[sessionStore] initSessionStore 失败:', err);
  }
};

export const getSession = (sessionId: string): Session => {
  const existing = sessions.get(sessionId);
  if (existing) return existing;

  const created: Session = {
    lastId: 0,
    messages: [],
    memorySummary: '',
    memorySummaryUpdatedAt: null,
  };
  sessions.set(sessionId, created);
  return created;
};

export const listMessages = (sessionId: string): Message[] => getSession(sessionId).messages;

export const listRecentDialogues = async (limit = 10): Promise<RecentDialogueItem[]> => {
  try {
    return await listDialoguesFromSessionSnapshots(limit);
  } catch (err) {
    console.warn('[sessionStore] listRecentDialogues 失败:', err);
    return [];
  }
};

export const getSessionSnapshot = (sessionId: string) => {
  const session = getSession(sessionId);
  const messageCount = session.messages.length;
  const summaryTokensEstimate = estimateTextTokens(session.memorySummary);
  const conversationTokensEstimate = session.messages.reduce(
    (sum, message) => sum + estimateTextTokens(message.content) + 4,
    0,
  );
  const budgetTokensEstimate = Math.floor(CONTEXT_WINDOW_TOKENS * INPUT_BUDGET_RATIO) - RESERVED_OUTPUT_TOKENS;
  const isSummaryThresholdReached = messageCount >= SUMMARY_TRIGGER_MESSAGE_COUNT;

  return {
    messages: session.messages,
    memorySummary: session.memorySummary,
    memorySummaryUpdatedAt: session.memorySummaryUpdatedAt,
    lastId: session.lastId,
    memoryMetrics: {
      messageCount,
      conversationTokensEstimate,
      summaryTokensEstimate,
      budgetTokensEstimate,
      summaryTriggerMessageCount: SUMMARY_TRIGGER_MESSAGE_COUNT,
      isSummaryThresholdReached,
    },
  };
};
