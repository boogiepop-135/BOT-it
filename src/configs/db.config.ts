import mongoose from 'mongoose';
import EnvConfig from './env.config';
import logger from './logger.config';

export async function connectDB() {
  try {
    // Intentar usar MONGODB_URI primero, luego MONGO_URL como fallback
    const mongoUri = EnvConfig.MONGODB_URI || process.env.MONGO_URL || process.env.MONGODB_URI;
    
    if (!mongoUri) {
      throw new Error('MONGODB_URI or MONGO_URL is not defined in environment variables');
    }

    logger.info(`Connecting to MongoDB...`);
    await mongoose.connect(mongoUri);
    logger.info(`Connected to MongoDB. Database: ${mongoose.connection.name}`);
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  }
}