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
            mongoStore = await MongoStore.connect(mongoose.connection.db);
            logger.info('MongoStore initialized for WhatsApp session storage');
        } catch (error) {
            logger.error('Failed to initialize MongoStore:', error);
            throw error;
        }
    }
    
    return mongoStore;
}

export function closeMongoStore(): Promise<void> {
    if (mongoStore) {
        return mongoStore.close().then(() => {
            mongoStore = null;
            logger.info('MongoStore closed');
        }).catch((error) => {
            logger.error('Error closing MongoStore:', error);
            mongoStore = null;
        });
    }
    return Promise.resolve();
}

