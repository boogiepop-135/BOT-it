import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../utils/auth.util';
import logger from '../../configs/logger.config';

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = await AuthService.verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Token expired or invalid' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(401).json({ error: 'Token expired or invalid' });
  }
};

export const authorizeAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};