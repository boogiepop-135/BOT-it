import { Message } from "whatsapp-web.js";
import { UserI18n } from "../utils/i18n.util";
import { BotManager } from "../bot.manager";
import logger from "../configs/logger.config";

export const run = async (message: Message, args: string[] = null, userI18n: UserI18n) => {
    try {
        const botManager = BotManager.getInstance();
        const isPaused = botManager.getPauseStatus();
        
        if (isPaused) {
            await message.reply(
                `⏸️ *Bot en Pausa*\n\n` +
                `El bot está actualmente pausado.\n\n` +
                `💡 Solo los administradores pueden reanudar el bot desde el panel de administración.\n\n` +
                `📧 Si necesitas ayuda urgente, contacta directamente a Levi Villarreal por este mismo WhatsApp.`
            );
        } else {
            await message.reply(
                `⏸️ *Estado del Bot*\n\n` +
                `El bot está actualmente activo y procesando solicitudes.\n\n` +
                `📝 Usa \`!ticket\` para crear un ticket de soporte técnico.\n\n` +
                `Para más comandos, escribe: \`!help\``
            );
        }
    } catch (error) {
        logger.error('Error in pause command:', error);
        await message.reply('❌ Error al consultar el estado del bot.');
    }
};

