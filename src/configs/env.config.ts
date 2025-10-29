import { config } from "dotenv";
import logger from "./logger.config";

const fs = require('fs');

config();

class EnvConfig {

    static GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    static ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    static PUPPETEER_EXECUTABLE_PATH = process.env.PUPPETEER_EXECUTABLE_PATH;
    static OPENWEATHERMAP_API_KEY = process.env.OPENWEATHERMAP_API_KEY;
    static SPEECHIFY_API_KEY = process.env.SPEECHIFY_API_KEY;
    static ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
    static ENV = process.env.ENV;
    static PORT = process.env.PORT;
    static MONGODB_URI = process.env.MONGODB_URI;
    static JWT_SECRET = process.env.JWT_SECRET;

    static validate() {

        // En entornos como Railway/Render, las variables llegan por process.env
        // y no existe archivo físico .env. No forzar su existencia.

        // Variables obligatorias para el funcionamiento básico
        if (!this.GEMINI_API_KEY) {
            throw new Error("Environment variable GEMINI_API_KEY is missing. Please provide a valid Gemini API key.");
        }
        if (!this.PUPPETEER_EXECUTABLE_PATH) {
            logger.warn("PUPPETEER_EXECUTABLE_PATH is not set. Using Puppeteer's default executable path.");
        }
        if (!this.ENV) {
            throw new Error("Environment variable ENV is missing. Please provide a valid ENV.");
        }
        if (!this.PORT) {
            throw new Error("Environment variable PORT is missing. Please provide a valid PORT.");
        }
        if (!this.MONGODB_URI) {
            throw new Error("Environment variable MONGODB_URI is missing. Please provide a valid MONGODB_URI.");
        }
        if (!this.JWT_SECRET) {
            throw new Error("Environment variable JWT_SECRET is missing. Please provide a valid JWT_SECRET.");
        }

        // Variables opcionales - solo mostrar advertencias si están configuradas pero vacías
        if (this.ANTHROPIC_API_KEY === '') {
            logger.warn("ANTHROPIC_API_KEY is empty. Claude AI fallback will not work.");
        }
        if (this.OPENWEATHERMAP_API_KEY === '') {
            logger.warn("OPENWEATHERMAP_API_KEY is empty. Weather commands will not work.");
        }
        if (this.SPEECHIFY_API_KEY === '') {
            logger.warn("SPEECHIFY_API_KEY is empty. Text-to-speech features will not work.");
        }
        if (this.ASSEMBLYAI_API_KEY === '') {
            logger.warn("ASSEMBLYAI_API_KEY is empty. Speech-to-text features will not work.");
        }
    }
}

try {
    EnvConfig.validate();
} catch (error) {
    logger.error(error);
    process.exit(1);
}

export default EnvConfig;