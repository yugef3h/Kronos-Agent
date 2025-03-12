import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const authenticateJwt = (request: Request, response: Response, next: NextFunction) => {
  if (request.method === 'OPTIONS') {
    next();
    return;
  }

  const authorizationHeader = request.header('authorization');

  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    response.status(401).json({ error: 'Missing bearer token' });
    return;
  }

  const token = authorizationHeader.slice('Bearer '.length);

  try {
    jwt.verify(token, env.JWT_SECRET);
    next();
  } catch {
    response.status(401).json({ error: 'Invalid JWT token' });
  }
};
