import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../utils/auth.util';
import logger from '../../configs/logger.config';
import { ROLE_PERMISSIONS } from '../utils/rbac.util';

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

export const authorizeRoles = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const userRole = req.user.role;
    
    // Verificar si el usuario tiene uno de los roles permitidos
    // También verificar roles de contactos (rh_karina, rh_nubia, levi, etc.)
    const hasPermission = roles.includes(userRole) || 
                         roles.includes('*') || 
                         userRole === 'admin' || 
                         userRole === 'ceo' ||
                         userRole === 'levi' ||
                         userRole === 'super_admin' ||
                         // Verificar si es un rol de contacto compatible
                         (roles.includes('rh_karina') && userRole === 'rh_karina') ||
                         (roles.includes('rh_nubia') && userRole === 'rh_nubia');
    
    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient role' });
    }
    next();
  };
};

export const authorizePermission = (resource: string, action: 'read' | 'write' | 'manage') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = req.user?.role;
    if (!role) return res.status(401).json({ error: 'Authentication required' });
    const perms = ROLE_PERMISSIONS[role] || {};
    
    // Verificar si tiene permiso para todo ('*')
    const hasWildcardManage = perms['*']?.includes('manage');
    if (hasWildcardManage) {
      return next(); // Admin/CEO tiene acceso a todo
    }
    
    // Super Admin (Levi) tiene acceso total
    if (role === 'levi' || role === 'super_admin') {
      return next();
    }
    
    // Verificar roles especiales de contactos (salma, francisco, desarrollo_estrategia_inrra)
    if (role === 'salma' || role === 'francisco' || role === 'desarrollo_estrategia_inrra' || role === 'boss' || role === 'ceo') {
      const rolePerms = ROLE_PERMISSIONS[role] || {};
      const allowed = rolePerms[resource]?.includes(action) || rolePerms[resource]?.includes('manage');
      if (allowed) return next();
    }
    
    // Verificar permiso específico del recurso
    const allowed = perms[resource]?.includes(action) || perms[resource]?.includes('manage');
    if (!allowed) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
};