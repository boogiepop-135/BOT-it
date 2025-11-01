import express from "express";
import logger from "../configs/logger.config";
import { BotManager } from "../bot.manager";
import crmRouter from "../crm/api/crm.api";
import itRouter from "../crm/api/it.api";

const router = express.Router();

export default function (botManager: BotManager) {
    const client = botManager.client;
    const qrData = botManager.qrData;
    
    router.get("/", (_req, res) => {
        logger.info("GET /");
        res.render("index", {
            qrScanned: qrData.qrScanned,
            qrCodeData: qrData.qrCodeData,
        });
    });

    router.get("/qr", (_req, res) => {
        logger.info("GET /qr");

        if (qrData.qrScanned) {
            return res.redirect("/");
        }

        res.render("qr", {
            qrCodeData: qrData.qrCodeData,
        });
    });

    router.get("/qr-status", (_req, res) => {
        res.json({ qrScanned: qrData.qrScanned, qrCodeData: qrData.qrCodeData });
    });

    router.get("/health", async (_req, res) => {
        try {
            const isClientReady = client && client.info ? true : false;

            const healthStatus = {
                status: isClientReady ? "healthy" : "unhealthy",
                clientReady: isClientReady,
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage(),
                qrScanned: qrData.qrScanned,
                botContact: client && client.info ? `<a target="_blank" href="https://wa.me/${client.info.wid.user}">wa.me/${client.info.wid.user}</a>` : null,
                botPushName: client && client.info ? client.info.pushname : null,
                botPlatform: client && client.info ? client.info.platform : null,
                version: process.version,
            };

            logger.info("GET /health");
            res.status(200).json(healthStatus);
        } catch (error) {
            logger.error("Health check failed", error);
            res.status(500).json({ status: "unhealthy", error: "Internal Server Error" });
        }
    });

    // Reconnect WhatsApp endpoint
    router.post('/api/reconnect', async (req, res) => {
        try {
            logger.info('Reconnecting WhatsApp via API...');
            
            // Use the reconnect method from BotManager
            await botManager.reconnectWhatsApp();
            
            logger.info('Reconnection complete. QR generated:', !!botManager.qrData.qrCodeData);
            
            res.json({ 
                success: true, 
                message: 'WhatsApp reconnection initiated',
                qrGenerated: !!botManager.qrData.qrCodeData,
                qrCodeData: botManager.qrData.qrCodeData
            });
        } catch (error) {
            logger.error('Failed to reconnect WhatsApp:', error);
            res.status(500).json({ success: false, error: 'Failed to reconnect WhatsApp' });
        }
    });
    
    // Pause/Resume bot endpoints
    router.get('/api/bot/status', (req, res) => {
        try {
            const isPaused = botManager.getPauseStatus();
            res.json({ isPaused });
        } catch (error) {
            logger.error('Failed to get bot status:', error);
            res.status(500).json({ error: 'Failed to get bot status' });
        }
    });
    
    router.post('/api/bot/pause', (req, res) => {
        try {
            botManager.pauseBot();
            res.json({ success: true, message: 'Bot paused' });
        } catch (error) {
            logger.error('Failed to pause bot:', error);
            res.status(500).json({ error: 'Failed to pause bot' });
        }
    });
    
    router.post('/api/bot/resume', (req, res) => {
        try {
            botManager.resumeBot();
            res.json({ success: true, message: 'Bot resumed' });
        } catch (error) {
            logger.error('Failed to resume bot:', error);
            res.status(500).json({ error: 'Failed to resume bot' });
        }
    });

    router.use("/crm", crmRouter(botManager));
    router.use("/api/it", itRouter(botManager));

    return router;
}
