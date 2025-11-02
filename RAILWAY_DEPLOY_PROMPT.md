# Prompt para Configurar Bot de WhatsApp en Railway con RemoteAuth y MongoDB

## Contexto
Necesito configurar un bot de WhatsApp usando `whatsapp-web.js` para desplegar en Railway con las siguientes características:

1. **Guardar tokens de sesión en MongoDB** usando `RemoteAuth` con `wwebjs-mongo` para que la sesión persista entre despliegues
2. **Configuración asíncrona** que conecte a MongoDB antes de inicializar el cliente de WhatsApp
3. **Compatibilidad con Railway** para despliegues automáticos

## Requisitos Técnicos

### Dependencias necesarias:
- `whatsapp-web.js`: ^1.27.0
- `wwebjs-mongo`: ^1.1.0
- `mongoose`: ^8.16.2

### Estructura de archivos a crear/modificar:

#### 1. Configuración de MongoStore (`src/configs/mongo-store.config.ts`)
Crear un archivo que inicialice MongoStore correctamente:

```typescript
import { MongoStore } from 'wwebjs-mongo';
import mongoose from 'mongoose';
import logger from './logger.config'; // o tu sistema de logging

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

            // Crear MongoStore usando mongoose (NO usar método estático connect)
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
```

#### 2. Configuración del Cliente (`src/configs/client.config.ts`)
Cambiar de `LocalAuth` a `RemoteAuth` con configuración asíncrona:

```typescript
import { RemoteAuth } from "whatsapp-web.js";
import EnvConfig from "./env.config"; // o tu configuración de variables de entorno
import { getMongoStore } from "./mongo-store.config";

// Crear configuración asíncrona para ClientConfig
export async function getClientConfig() {
    const store = await getMongoStore();
    
    return {
        authStrategy: new RemoteAuth({
            store: store,
            backupSyncIntervalMs: 300000, // Hacer backup cada 5 minutos
            clientId: "tu-client-id-aqui",
            dataPath: "./.wwebjs_auth",
            rmMaxRetries: 3
        }),
        puppeteer: {
            headless: true,
            executablePath: EnvConfig.PUPPETEER_EXECUTABLE_PATH,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                // ... otros args que necesites
            ]
        },
        restartOnAuthFail: true,
        takeoverOnConflict: true,
        takeoverTimeoutMs: 0,
        qrMaxRetries: 5
    };
}
```

#### 3. Manager del Bot (`src/bot.manager.ts` o similar)
Modificar el constructor y agregar método de inicialización asíncrona:

**Import correcto:**
```typescript
import { getClientConfig } from "./configs/client.config";
```

**Constructor modificado:**
```typescript
private constructor() {
    // El cliente se inicializará de forma asíncrona
    // No podemos crear el cliente aquí porque getClientConfig es asíncrono
    // Por eso usamos initializeClient() que se llamará después de conectar a MongoDB
}

public async initializeClient() {
    if (!this.client) {
        const clientConfig = await getClientConfig();
        this.client = new Client(clientConfig);
        this.setupEventHandlers();
    }
}

public async initialize() {
    try {
        if (!this.client) {
            await this.initializeClient();
        }
        this.client.initialize();
    } catch (error) {
        logger.error(`Client initialization error: ${error}`);
    }
}
```

**Métodos que usan el cliente:**
Asegurarse de que todos los métodos que usan `this.client` verifiquen primero si existe:

```typescript
public async listGroups() {
    try {
        if (!this.client) {
            await this.initializeClient();
        }
        const chats = await this.client.getChats();
        // ... resto del código
    }
}
```

#### 4. Archivo principal (`src/index.ts` o `src/app.ts`)
Inicializar de forma asíncrona conectando a MongoDB primero:

```typescript
import { connectDB } from "./configs/db.config";
import { BotManager } from "./bot.manager"; // o tu clase similar

const botManager = BotManager.getInstance();

// Conectar a MongoDB primero, luego inicializar el cliente de WhatsApp
connectDB().then(async () => {
    // Inicializar el cliente después de conectar a MongoDB
    await botManager.initializeClient();
    
    // Inicializar crons, etc.
    initCrons(botManager);
    
    // Inicializar el bot
    botManager.initialize();
}).catch((error) => {
    logger.error('Failed to initialize:', error);
    process.exit(1);
});

// Configurar Express y rutas
const app = express();
// ... configuración de Express

app.listen(port, () => {
    logger.info(`Server running on port ${port}`);
    // botManager.initialize() se llama después de conectar a MongoDB
});
```

#### 5. Variables de entorno necesarias en Railway:

Configura estas variables de entorno en Railway:

```
MONGODB_URI=mongodb://... (URI de tu base de datos MongoDB)
GEMINI_API_KEY=tu_api_key (si usas Gemini)
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable (en Railway usa esta ruta)
ENV=production
PORT=8080 (o el puerto que Railway asigne)
JWT_SECRET=tu_secret_seguro
```

**Para Railway específicamente:**
- `PUPPETEER_EXECUTABLE_PATH` puede no ser necesario si Railway ya tiene Chrome instalado
- Railway puede asignar el `PORT` automáticamente, úsalo desde `process.env.PORT`

#### 6. Scripts en package.json:

```json
{
  "scripts": {
    "start": "node build/index.js",
    "build": "rimraf build && node esbuild.config.js && npm run copy-files",
    "copy-files": "copyfiles -u 0 ./package.json ./.env ./package-lock.json public/**/* build && copyfiles -u 2 src/views/**/* build/views"
  }
}
```

**Railway automáticamente ejecutará:**
- `npm install` al detectar cambios
- `npm run build` si hay un script `build`
- `npm start` para iniciar la aplicación

## Checklist de Implementación:

- [ ] Instalar `wwebjs-mongo` si no está instalado: `npm install wwebjs-mongo`
- [ ] Crear `src/configs/mongo-store.config.ts` con la configuración correcta
- [ ] Cambiar `LocalAuth` a `RemoteAuth` en la configuración del cliente
- [ ] Convertir `ClientConfig` de constante a función asíncrona `getClientConfig()`
- [ ] Actualizar imports en el manager del bot: `import { getClientConfig } from "./configs/client.config"`
- [ ] Modificar constructor del bot para no crear el cliente inmediatamente
- [ ] Agregar método `initializeClient()` asíncrono
- [ ] Modificar método `initialize()` para ser asíncrono
- [ ] Actualizar método principal para conectar a MongoDB primero, luego inicializar cliente
- [ ] Asegurarse que métodos que usan `this.client` verifiquen si existe antes
- [ ] Configurar variables de entorno en Railway
- [ ] Verificar que `package.json` tenga los scripts correctos para build y start

## Errores comunes a evitar:

1. ❌ **NO usar** `MongoStore.connect()` - ese método NO existe
2. ✅ **SÍ usar** `new MongoStore({ mongoose: mongoose })`
3. ❌ **NO crear** el cliente en el constructor - debe ser asíncrono
4. ✅ **SÍ inicializar** el cliente después de conectar a MongoDB
5. ❌ **NO usar** `LocalAuth` - no persiste entre despliegues
6. ✅ **SÍ usar** `RemoteAuth` con `MongoStore`

## Ejemplo completo de flujo de inicialización:

```
1. Conectar a MongoDB
2. Inicializar MongoStore (usa mongoose ya conectado)
3. Obtener configuración del cliente (getClientConfig) que requiere MongoStore
4. Crear cliente de WhatsApp con RemoteAuth
5. Configurar event handlers
6. Inicializar el cliente (client.initialize())
7. El cliente guardará/restaurará la sesión desde MongoDB automáticamente
```

## Notas importantes:

- **Railway ejecuta el build automáticamente** cuando detecta `package.json` con script `build`
- La sesión se guarda en **GridFS** de MongoDB usando el bucket `whatsapp-{clientId}`
- Cada vez que Railway despliega, restaurará la sesión desde MongoDB, evitando tener que escanear QR de nuevo
- Si necesitas forzar un nuevo inicio de sesión, puedes eliminar la sesión usando `store.delete({ session: 'tu-client-id' })`

