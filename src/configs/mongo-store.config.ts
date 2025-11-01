import { MongoStore } from 'wwebjs-mongo';
import mongoose from 'mongoose';
import logger from './logger.config';

let mongoStore: MongoStore | null = null;

/**
 * Configuración del almacenamiento de sesión de WhatsApp en MongoDB
 */
export async function getMongoStore(): Promise<MongoStore> {
    if (!mongoStore) {
        try {
            // Verificar que mongoose esté conectado
            if (mongoose.connection.readyState !== 1) {
                throw new Error('MongoDB not connected. Please connect to MongoDB first.');
            }

            // Crear MongoStore usando la conexión de mongoose existente
            // MongoStore se crea directamente, no con un método estático
            mongoStore = new MongoStore({
                mongoose: mongoose
            });
            
            logger.info('MongoStore initialized for WhatsApp session storage');
        } catch (error) {
            logger.error('Failed to initialize MongoStore:', error);
            throw error;
        }
    }
    
    return mongoStore;
}

export function closeMongoStore(): Promise<void> {
    // MongoStore no tiene método close(), simplemente limpiamos la referencia
    if (mongoStore) {
        mongoStore = null;
        logger.info('MongoStore reference cleared');
    }
    return Promise.resolve();
}

