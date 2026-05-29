import { useEffect, useState } from 'react';

import { requestHotTopics } from '../../../lib/api';
import {
  getCachedLocalStorage,
  getNextDayStartTimestamp,
  setCachedLocalStorage,
} from '../../../lib/localStorageCache';
import { DEFAULT_HOT_TOPICS, HOT_TOPICS_CACHE_KEY } from '../constants';

export const usePlaygroundHotTopics = (authToken: string): string[] => {
  const [hotTopics, setHotTopics] = useState<string[]>(
    () => getCachedLocalStorage<string[]>(HOT_TOPICS_CACHE_KEY) || [...DEFAULT_HOT_TOPICS],
  );

  useEffect(() => {
    const cachedTopics = getCachedLocalStorage<string[]>(HOT_TOPICS_CACHE_KEY);
    if (cachedTopics && cachedTopics.length > 0) {
      setHotTopics(cachedTopics);
      return undefined;
    }

    if (!authToken) {
      return undefined;
    }

    let isCancelled = false;

    const hydrateHotTopics = async () => {
      try {
        const result = await requestHotTopics({ authToken });
        if (isCancelled || result.topics.length === 0) {
          return;
        }

        setHotTopics(result.topics);
        setCachedLocalStorage(HOT_TOPICS_CACHE_KEY, result.topics, getNextDayStartTimestamp());
      } catch {
        // 热门问题获取失败时继续使用本地兜底列表。
      }
    };

    void hydrateHotTopics();

    return () => {
      isCancelled = true;
    };
  }, [authToken]);

  return hotTopics;
};
