import mongoose from 'mongoose';
import EnvConfig from './env.config';
import logger from './logger.config';

export async function connectDB() {
  try {
    // Intentar usar todas las variantes de variables de entorno de Railway
    const mongoUri = EnvConfig.MONGODB_URI || 
                     process.env.MONGODB_URI || 
                     process.env.MONGODB_URL || 
                     process.env.MONGO_URL || 
                     process.env.MONGO_PUBLIC_URL;
    
    if (!mongoUri) {
      logger.error('No MongoDB URI found in environment variables. Checked: MONGODB_URI, MONGODB_URL, MONGO_URL, MONGO_PUBLIC_URL');
      throw new Error('MONGODB_URI or MONGODB_URL is not defined in environment variables');
    }

    // Log la URI (sin credenciales) para debugging
    const uriSafe = mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
    logger.info(`Connecting to MongoDB... (URI: ${uriSafe})`);
    
    // Opciones de conexión mejoradas para Railway
    const connectionOptions = {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      maxPoolSize: 10,
      retryWrites: true,
      w: 'majority',
    };
    
    await mongoose.connect(mongoUri, connectionOptions);
    
    logger.info(`✅ Connected to MongoDB successfully!`);
    logger.info(`   Database: ${mongoose.connection.name}`);
    logger.info(`   Host: ${mongoose.connection.host}:${mongoose.connection.port}`);
    logger.info(`   Ready State: ${mongoose.connection.readyState} (1=connected)`);
    
    // Event listeners para debugging
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Attempting to reconnect...');
    });
    
    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected successfully');
    });
    
    mongoose.connection.on('close', () => {
      logger.warn('MongoDB connection closed');
    });
    
  } catch (error: any) {
    logger.error('❌ MongoDB connection error:', error);
    logger.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code,
      stack: error.stack
    });
    process.exit(1);
  }
}