import AccessLevel from '../types/AccessLevel';
declare class AccessControlService {
    private featureFlags;
    constructor(featureAccessConfig: Record<string, AccessLevel>);
    setFeatureAccess(featureName: string, accessLevel: AccessLevel): void;
    getFeatureAccess(featureName: string): AccessLevel | undefined;
    hasAccess(featureName: string, userAccessLevel: AccessLevel): boolean;
}
export default AccessControlService;
