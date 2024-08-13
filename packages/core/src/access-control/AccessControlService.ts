import AccessLevel from '../types/AccessLevel';
import FeatureFlag from './FeatureFlag';

class AccessControlService {
  private featureFlags: Map<string, FeatureFlag> = new Map();

  constructor(featureAccessConfig: Record<string, AccessLevel>) {
    for (const [featureName, accessLevel] of Object.entries(featureAccessConfig)) {
      this.featureFlags.set(featureName, new FeatureFlag(featureName, accessLevel));
    }
  }

  setFeatureAccess(featureName: string, accessLevel: AccessLevel): void {
    const feature = this.featureFlags.get(featureName);
    if (feature) {
      feature.accessLevel = accessLevel;
    } else {
      this.featureFlags.set(featureName, new FeatureFlag(featureName, accessLevel));
    }
  }

  getFeatureAccess(featureName: string): AccessLevel | undefined {
    return this.featureFlags.get(featureName)?.accessLevel;
  }

  hasAccess(featureName: string, userAccessLevel: AccessLevel): boolean {
    const requiredAccess = this.getFeatureAccess(featureName);
    if (!requiredAccess) return false;

    switch (requiredAccess) {
      case AccessLevel.PUBLIC:
        return true;
      case AccessLevel.USER:
        return userAccessLevel === AccessLevel.USER || userAccessLevel === AccessLevel.PAID;
      case AccessLevel.PAID:
        return userAccessLevel === AccessLevel.PAID;
      default:
        return false;
    }
  }
}

export default AccessControlService;