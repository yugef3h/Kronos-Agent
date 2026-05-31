import { useCallback } from 'react';
import { MOCK_ADDRESS, MOCK_DELIVERY, MOCK_DISCOUNT, MOCK_FOODS } from './data/mockData';
import { requestTakeoutCatalog } from '../../../lib/api';

type CatalogResult = {
  source: 'model' | 'fallback';
  address: string;
  discount: number;
  delivery: { eta: string; courier: string };
  foods: typeof MOCK_FOODS;
};

const createLocalCatalogFallback = (address = MOCK_ADDRESS): CatalogResult => ({
  source: 'fallback' as const,
  address,
  discount: MOCK_DISCOUNT,
  delivery: MOCK_DELIVERY,
  foods: MOCK_FOODS,
});

export const useTakeoutCatalog = (authToken: string) => {
  const loadTakeoutCatalog = useCallback(async (params: {
    prompt: string;
    address: string;
  }): Promise<CatalogResult> => {
    if (!authToken.trim()) {
      return createLocalCatalogFallback(params.address);
    }
    try {
      const catalog = await requestTakeoutCatalog({
        authToken,
        prompt: params.prompt,
        address: params.address,
      });
      if (catalog.foods.length === 0) {
        return createLocalCatalogFallback(params.address);
      }
      return catalog;
    } catch {
      return createLocalCatalogFallback(params.address);
    }
  }, [authToken]);

  return { loadTakeoutCatalog };
};
