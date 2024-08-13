"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbConfig = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
const dbHost = process.env.NODE_ENV === 'development' && !process.env.DOCKER_ENVIRONMENT ? 'localhost' : 'db';
exports.dbConfig = {
    connectionString: `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${dbHost}:5432/${process.env.POSTGRES_DB}`,
    // You can add more database-related configurations here
};
exports.default = exports.dbConfig;
