import { projectVectorsTo2D } from './vectorProjection';

describe('projectVectorsTo2D', () => {
  it('should produce deterministic projection values', async () => {
    const input = {
      vectors: [
        [0.1, 0.2, 0.3],
        [0.9, 0.1, 0.4],
      ],
      method: 'random' as const,
    };

    const first = await projectVectorsTo2D(input);
    const second = await projectVectorsTo2D(input);

    expect(first).toEqual(second);
    expect(first).toHaveLength(2);
    expect(first[0]?.norm).toBeGreaterThan(0);
  });

  it('should support pca and umap projection methods', async () => {
    const vectors = [
      [0.1, 0.2, 0.3, 0.4],
      [0.3, 0.2, 0.5, 0.6],
      [0.8, 0.9, 0.2, 0.1],
      [0.7, 0.3, 0.4, 0.9],
    ];

    const pca = await projectVectorsTo2D({ vectors, method: 'pca' });
    const umap = await projectVectorsTo2D({ vectors, method: 'umap' });

    expect(pca).toHaveLength(vectors.length);
    expect(umap).toHaveLength(vectors.length);
    expect(Number.isFinite(pca[0]?.x)).toBe(true);
    expect(Number.isFinite(umap[0]?.y)).toBe(true);
  });
});
