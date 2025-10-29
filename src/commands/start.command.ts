import { Message } from "whatsapp-web.js";
import { UserI18n } from "../utils/i18n.util";
import { ContactModel } from "../crm/models/contact.model";
import logger from "../configs/logger.config";

export const run = async (message: Message, args: string[] = null, userI18n: UserI18n) => {
    try {
        const contact = await message.getContact();
        
        // Update contact to mark as resumed
        const updatedContact = await ContactModel.findOneAndUpdate(
            { phoneNumber: contact.number },
            { 
                $set: { 
                    botPaused: false
                },
                $unset: {
                    botPausedAt: ""
                }
            },
            { upsert: false, new: true }
        );
        
        if (updatedContact) {
            await message.reply(
                `▶️ *Bot Reanudado*\n\n` +
                `¡Bienvenido de nuevo!\n\n` +
                `El bot está activo y listo para ayudarte.\n\n` +
                `📝 *Comandos disponibles:*\n` +
                `• \`!ticket\` - Crear ticket\n` +
                `• \`!ticket list\` - Ver mis tickets\n` +
                `• \`!help\` - Ver ayuda\n` +
                `• \`!stop\` - Pausar bot\n\n` +
                `💬 *¿Necesitas ayuda?*\n` +
                `Responde \`7\` para ver el menú completo`
            );
        } else {
            await message.reply(
                `ℹ️ No se encontró tu registro. El bot continuará funcionando normalmente.`
            );
        }
    } catch (error) {
        logger.error('Error in start command:', error);
        await message.reply('❌ Error al reanudar el bot. Por favor, intenta más tarde.');
    }
};

