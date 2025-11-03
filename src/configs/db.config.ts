import mongoose from 'mongoose';
import EnvConfig from './env.config';
import logger from './logger.config';

export async function connectDB() {
  try {
    // Intentar usar todas las variantes de variables de entorno de Railway
    let mongoUri = EnvConfig.MONGODB_URI || 
                   process.env.MONGODB_URI || 
                   process.env.MONGODB_URL || 
                   process.env.MONGO_URL || 
                   process.env.MONGO_PUBLIC_URL;
    
    if (!mongoUri) {
      logger.error('No MongoDB URI found in environment variables. Checked: MONGODB_URI, MONGODB_URL, MONGO_URL, MONGO_PUBLIC_URL');
      logger.error('Available env vars:', Object.keys(process.env).filter(k => k.includes('MONGO') || k.includes('mongo')));
      throw new Error('MONGODB_URI or MONGODB_URL is not defined in environment variables');
    }

    // Log la URI (sin credenciales) para debugging
    const uriSafe = mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
    logger.info(`Connecting to MongoDB... (URI: ${uriSafe})`);
    logger.info(`URI length: ${mongoUri.length} characters`);
    
    // Verificar si la URI tiene credenciales o necesita autenticación
    const hasAuth = mongoUri.includes('@') && mongoUri.includes(':');
    if (!hasAuth && mongoUri.includes('mongodb://')) {
      logger.warn('⚠️  MongoDB URI does not contain authentication credentials. Railway MongoDB may require auth.');
      logger.warn('If connection fails, verify that MONGODB_URL includes username and password.');
    }
    
    // Opciones de conexión mejoradas para Railway
    const connectionOptions: any = {
      serverSelectionTimeoutMS: 10000, // Aumentado para Railway
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      maxPoolSize: 10,
      retryWrites: true,
      w: 'majority',
      // Auto-reconnect config (opciones compatibles con mongoose 8.x)
      // Nota: bufferMaxEntries y bufferCommands fueron removidos en mongoose 8.x
    };
    
    // Si Railway usa autenticación, agregar opciones adicionales
    if (hasAuth) {
      connectionOptions.authSource = 'admin'; // Railway MongoDB típicamente usa 'admin'
      logger.info('Using authentication with authSource: admin');
    }
    
    logger.info('MongoDB connection options:', JSON.stringify({
      serverSelectionTimeoutMS: connectionOptions.serverSelectionTimeoutMS,
      socketTimeoutMS: connectionOptions.socketTimeoutMS,
      connectTimeoutMS: connectionOptions.connectTimeoutMS,
      maxPoolSize: connectionOptions.maxPoolSize,
      authSource: connectionOptions.authSource || 'default',
    }));
    
    await mongoose.connect(mongoUri, connectionOptions);
    
    logger.info(`✅ Connected to MongoDB successfully!`);
    logger.info(`   Database: ${mongoose.connection.name || 'default'}`);
    logger.info(`   Host: ${mongoose.connection.host || 'unknown'}:${mongoose.connection.port || 'unknown'}`);
    logger.info(`   Ready State: ${mongoose.connection.readyState} (1=connected, 0=disconnected)`);
    
    // Verificar estado de la conexión
    const state = mongoose.connection.readyState;
    const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    logger.info(`   Connection State: ${states[state]} (${state})`);
    
    // Event listeners para debugging
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
      logger.error('Error name:', err.name);
      logger.error('Error message:', err.message);
      logger.error('Error code:', (err as any).code);
    });
    
    mongoose.connection.on('disconnected', () => {
      logger.warn('⚠️  MongoDB disconnected. Attempting to reconnect...');
    });
    
    mongoose.connection.on('reconnected', () => {
      logger.info('✅ MongoDB reconnected successfully');
    });
    
    mongoose.connection.on('close', () => {
      logger.warn('⚠️  MongoDB connection closed');
    });
    
    // Test básico de la conexión
    try {
      const db = mongoose.connection.db;
      if (db) {
        const adminDb = db.admin();
        const serverStatus = await adminDb.serverStatus();
        logger.info(`✅ MongoDB server status verified. Version: ${serverStatus.version || 'unknown'}`);
      }
    } catch (testError) {
      logger.warn('Could not verify server status, but connection appears to be active');
    }
    
  } catch (error: any) {
    logger.error('❌ MongoDB connection error:', error);
    logger.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code,
      codeName: error.codeName,
      errorLabels: error.errorLabels,
    });
    
    // Log adicional para ayudar con debugging
    if (error.message?.includes('authentication')) {
      logger.error('🔐 Authentication error detected. Check:');
      logger.error('   1. MongoDB URI includes username and password');
      logger.error('   2. Username and password are correct');
      logger.error('   3. User has proper permissions in Railway MongoDB');
    }
    
    if (error.message?.includes('ENOTFOUND') || error.message?.includes('getaddrinfo')) {
      logger.error('🌐 DNS/Host error detected. Check:');
      logger.error('   1. MongoDB hostname is correct in Railway');
      logger.error('   2. Network connectivity to Railway MongoDB');
    }
    
    logger.error('Error stack:', error.stack);
    process.exit(1);
  }
}