import { Message } from "whatsapp-web.js";
import { UserI18n } from "../utils/i18n.util";
import { ContactModel } from "../crm/models/contact.model";
import logger from "../configs/logger.config";

export const run = async (message: Message, args: string[] = null, userI18n: UserI18n) => {
    try {
        const contact = await message.getContact();
        
        // Update contact to mark as paused
        const updatedContact = await ContactModel.findOneAndUpdate(
            { phoneNumber: contact.number },
            { 
                $set: { 
                    botPaused: true,
                    botPausedAt: new Date()
                }
            },
            { upsert: false, new: true }
        );
        
        if (updatedContact) {
            await message.reply(
                `⏸️ *Bot Pausado*\n\n` +
                `Has pausado el bot exitosamente.\n\n` +
                `📝 *¿Qué significa esto?*\n` +
                `• El bot no responderá a tus mensajes automáticamente\n` +
                `• No recibirás notificaciones ni recordatorios\n` +
                `• Puedes reanudar en cualquier momento\n\n` +
                `▶️ *Para reanudar el bot:*\n` +
                `Envía: \`!start\`\n\n` +
                `📧 *Si necesitas ayuda urgente:*\n` +
                `Contacta directamente a Levi Villarreal\n` +
                `Por este mismo WhatsApp`
            );
        } else {
            await message.reply(
                `ℹ️ No se encontró tu registro. El bot continuará funcionando normalmente.`
            );
        }
    } catch (error) {
        logger.error('Error in stop command:', error);
        await message.reply('❌ Error al pausar el bot. Por favor, intenta más tarde.');
    }
};

