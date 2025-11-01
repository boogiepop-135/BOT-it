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

// Conectar a MongoDB primero, luego inicializar el cliente de WhatsApp
connectDB().then(async () => {
    // Inicializar el cliente después de conectar a MongoDB
    await botManager.initializeClient();
    initCrons(botManager);
    botManager.initialize();
}).catch((error) => {
    logger.error('Failed to initialize:', error);
    process.exit(1);
});

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use("/public", express.static("public"));
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