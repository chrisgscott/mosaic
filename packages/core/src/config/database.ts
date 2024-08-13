import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const dbHost = process.env.NODE_ENV === 'development' && !process.env.DOCKER_ENVIRONMENT ? 'localhost' : 'db';

export const dbConfig = {
  connectionString: `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${dbHost}:5432/${process.env.POSTGRES_DB}`,
  // You can add more database-related configurations here
};

export default dbConfig;