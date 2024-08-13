"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const AccessLevel_1 = __importDefault(require("../types/AccessLevel"));
const FeatureFlag_1 = __importDefault(require("./FeatureFlag"));
class AccessControlService {
    constructor(featureAccessConfig) {
        this.featureFlags = new Map();
        for (const [featureName, accessLevel] of Object.entries(featureAccessConfig)) {
            this.featureFlags.set(featureName, new FeatureFlag_1.default(featureName, accessLevel));
        }
    }
    setFeatureAccess(featureName, accessLevel) {
        const feature = this.featureFlags.get(featureName);
        if (feature) {
            feature.accessLevel = accessLevel;
        }
        else {
            this.featureFlags.set(featureName, new FeatureFlag_1.default(featureName, accessLevel));
        }
    }
    getFeatureAccess(featureName) {
        var _a;
        return (_a = this.featureFlags.get(featureName)) === null || _a === void 0 ? void 0 : _a.accessLevel;
    }
    hasAccess(featureName, userAccessLevel) {
        const requiredAccess = this.getFeatureAccess(featureName);
        if (!requiredAccess)
            return false;
        switch (requiredAccess) {
            case AccessLevel_1.default.PUBLIC:
                return true;
            case AccessLevel_1.default.USER:
                return userAccessLevel === AccessLevel_1.default.USER || userAccessLevel === AccessLevel_1.default.PAID;
            case AccessLevel_1.default.PAID:
                return userAccessLevel === AccessLevel_1.default.PAID;
            default:
                return false;
        }
    }
}
exports.default = AccessControlService;
