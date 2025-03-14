import { UMAP } from 'umap-js';

export type ProjectionMethod = 'random' | 'pca' | 'umap';

type VectorProjectionInput = {
  vectors: number[][];
  method: ProjectionMethod;
};

const createDeterministicWeight = (index: number): number => {
  const seed = Math.sin(index * 12.9898) * 43758.5453;
  return (seed - Math.floor(seed)) * 2 - 1;
};

const vectorNorm = (vector: number[]): number => {
  const sum = vector.reduce((acc, current) => acc + current * current, 0);
  return Math.sqrt(sum);
};

const multiplyMatrixVector = (matrix: number[][], vector: number[]): number[] => {
  return matrix.map((row) => row.reduce((acc, value, index) => acc + value * vector[index], 0));
};

const normalizeVector = (vector: number[]): number[] => {
  const norm = Math.sqrt(vector.reduce((acc, current) => acc + current * current, 0)) || 1;
  return vector.map((value) => value / norm);
};

const dot = (a: number[], b: number[]): number => a.reduce((acc, value, index) => acc + value * b[index], 0);

const projectRandom = (vectors: number[][]): Array<{ x: number; y: number }> => {
  return vectors.map((vector) => {
    let x = 0;
    let y = 0;

    for (let i = 0; i < vector.length; i += 1) {
      x += vector[i] * createDeterministicWeight(i + 1);
      y += vector[i] * createDeterministicWeight((i + 1) * 17);
    }

    return { x, y };
  });
};

const projectPca = (vectors: number[][]): Array<{ x: number; y: number }> => {
  if (vectors.length <= 1) {
    return vectors.map(() => ({ x: 0, y: 0 }));
  }

  const dimension = vectors[0]?.length || 0;
  const mean = Array.from({ length: dimension }, (_, index) => {
    const sum = vectors.reduce((acc, vector) => acc + vector[index], 0);
    return sum / vectors.length;
  });

  const centered = vectors.map((vector) => vector.map((value, index) => value - mean[index]));

  const covariance = Array.from({ length: dimension }, () => Array.from({ length: dimension }, () => 0));

  for (const vector of centered) {
    for (let i = 0; i < dimension; i += 1) {
      for (let j = 0; j < dimension; j += 1) {
        covariance[i][j] += vector[i] * vector[j];
      }
    }
  }

  const scale = 1 / Math.max(1, centered.length - 1);
  for (let i = 0; i < dimension; i += 1) {
    for (let j = 0; j < dimension; j += 1) {
      covariance[i][j] *= scale;
    }
  }

  const powerIteration = (matrix: number[][], seed = 1): number[] => {
    let vector = normalizeVector(
      Array.from({ length: dimension }, (_, index) => createDeterministicWeight(seed * (index + 1))),
    );

    for (let i = 0; i < 30; i += 1) {
      vector = normalizeVector(multiplyMatrixVector(matrix, vector));
    }

    return vector;
  };

  const firstComponent = powerIteration(covariance, 13);
  const lambda1 = dot(firstComponent, multiplyMatrixVector(covariance, firstComponent));

  const deflated = covariance.map((row, i) =>
    row.map((value, j) => value - lambda1 * firstComponent[i] * firstComponent[j]),
  );

  const secondComponent = powerIteration(deflated, 29);

  return centered.map((vector) => ({
    x: dot(vector, firstComponent),
    y: dot(vector, secondComponent),
  }));
};

const projectUmap = (vectors: number[][]): Array<{ x: number; y: number }> => {
  if (vectors.length <= 2) {
    return projectRandom(vectors);
  }

  const umap = new UMAP({
    nComponents: 2,
    nNeighbors: Math.max(2, Math.min(10, vectors.length - 1)),
    minDist: 0.1,
  });

  const embedding = umap.fit(vectors);
  return embedding.map((row) => ({ x: row[0], y: row[1] }));
};

export type ProjectionPoint = {
  x: number;
  y: number;
  norm: number;
};

export const projectVectorsTo2D = async (input: VectorProjectionInput): Promise<ProjectionPoint[]> => {
  let projected: Array<{ x: number; y: number }> = [];

  if (input.method === 'pca') {
    projected = projectPca(input.vectors);
  } else if (input.method === 'umap') {
    projected = projectUmap(input.vectors);
  } else {
    projected = projectRandom(input.vectors);
  }

  return input.vectors.map((vector, index) => ({
    x: projected[index]?.x ?? 0,
    y: projected[index]?.y ?? 0,
    norm: vectorNorm(vector),
  }));
};
