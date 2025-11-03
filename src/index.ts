import express from "express";
import bodyParser from 'body-parser';
import logger from "./configs/logger.config";
import EnvConfig from "./configs/env.config";
import apiRoutes from "./api/index.api";
import { readAsciiArt } from "./utils/ascii-art.util";
import path from "path";
import { BotManager } from "./bot.manager";
import { connectDB } from "./configs/db.config";
import { initCrons } from "./crons/index.cron";

const app = express();
const port = EnvConfig.PORT || 3000;

const botManager = BotManager.getInstance();

// Manejar errores no capturados para evitar que el proceso se detenga
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // No hacer exit, solo loggear para que el bot continúe funcionando
});

process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', error);
    // No hacer exit inmediatamente, dar tiempo para loggear
    // En producción, podrías querer hacer graceful shutdown aquí
});

// Manejar señales de terminación (SIGTERM, SIGINT)
// Railway envía SIGTERM cuando detiene el contenedor
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully...');
    try {
        // Aquí podrías cerrar conexiones limpiamente si es necesario
        process.exit(0);
    } catch (error) {
        logger.error('Error during graceful shutdown:', error);
        process.exit(1);
    }
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully...');
    try {
        process.exit(0);
    } catch (error) {
        logger.error('Error during graceful shutdown:', error);
        process.exit(1);
    }
});

// Conectar a MongoDB primero, luego inicializar el cliente de WhatsApp
connectDB().then(async () => {
    logger.info('MongoDB connected successfully, initializing bot...');
    // Inicializar el cliente después de conectar a MongoDB
    await botManager.initializeClient();
    logger.info('Bot client initialized');
    initCrons(botManager);
    logger.info('Crons initialized');
    botManager.initialize();
    logger.info('Bot manager initialized');
}).catch((error) => {
    logger.error('❌ Failed to initialize application:', error);
    logger.error('Error stack:', error.stack);
    // En producción, es mejor salir si no se puede conectar a la BD
    if (EnvConfig.ENV === 'production') {
        process.exit(1);
    } else {
        logger.warn('Continuing in development mode despite MongoDB connection failure');
    }
});

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use("/public", express.static("public"));

// Logging middleware para todas las requests
app.use((req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
    logger.info(`${req.method} ${req.path} - Body: ${JSON.stringify(req.body)}`);
  }
  next();
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Make botManager available to routes
app.locals.botManager = botManager;

// API Routes must come before view routes
app.use("/", apiRoutes(botManager));

app.get('/admin', (req, res) => {
    res.render('admin-it');
});

app.get('/admin/login', (req, res) => {
    res.render('admin-login');
});

app.listen(port, () => {
    logger.info(readAsciiArt());
    logger.info(`Server running on port ${port}`);
    logger.info(`Access: http://localhost:${port}/`);
    // botManager.initialize() se llama después de conectar a MongoDB
});