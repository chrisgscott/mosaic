import { Request, Response, NextFunction } from 'express';
import AccessControlService from '../../core/src/access-control/AccessControlService';
import AccessLevel from '../../core/src/types/AccessLevel';

export function createAccessControlMiddleware(accessControlService: AccessControlService) {
  return function accessControlMiddleware(featureName: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      const userAccessLevel = getUserAccessLevel(req); // You'll need to implement this function
      if (accessControlService.hasAccess(featureName, userAccessLevel)) {
        next();
      } else {
        res.status(403).json({ error: 'Access denied' });
      }
    };
  };
}

function getUserAccessLevel(req: Request): AccessLevel {
  // Implement logic to determine user's access level based on authentication state
  // This is just a placeholder implementation
  if (req.headers['x-user-type'] === 'paid') {
    return AccessLevel.PAID;
  } else if (req.headers['x-user-type'] === 'user') {
    return AccessLevel.USER;
  }
  return AccessLevel.PUBLIC;
}