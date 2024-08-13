import AccessLevel from '../types/AccessLevel';

class FeatureFlag {
  constructor(
    public readonly name: string,
    public accessLevel: AccessLevel
  ) {}
}

export default FeatureFlag;