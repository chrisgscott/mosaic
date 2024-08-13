import AccessLevel from '../types/AccessLevel';
declare class FeatureFlag {
    readonly name: string;
    accessLevel: AccessLevel;
    constructor(name: string, accessLevel: AccessLevel);
}
export default FeatureFlag;
