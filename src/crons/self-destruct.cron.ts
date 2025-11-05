import { BotManager } from "../bot.manager";
import logger from "../configs/logger.config";

/**
 * Verifica el estado de auto-destrucción y crashea el bot cuando llega la fecha programada
 */
export async function checkSelfDestruct(botManager: BotManager): Promise<void> {
    try {
        const { SelfDestructModel } = await import('../crm/models/self-destruct.model');
        
        const selfDestruct = await SelfDestructModel.findOne({ active: true });
        
        if (!selfDestruct) {
            // No hay auto-destrucción activa, continuar normalmente
            return;
        }
        
        const fechaDestruccion = new Date(selfDestruct.scheduledDate);
        const ahora = new Date();
        
        // Si la fecha ya pasó, crashear el bot
        if (ahora >= fechaDestruccion) {
            logger.error('🚨 AUTO-DESTRUCCIÓN: La fecha programada ha llegado. Crasheando el bot...');
            
            // Enviar mensaje final a todos los usuarios antes de crashear
            try {
                const { ContactModel } = await import('../crm/models/contact.model');
                const contactos = await ContactModel.find({}).lean();
                
                const mensajeFinal = `⚠️ *BOT DETENIDO*\n\n` +
                    `El bot de soporte IT de San Cosme Orgánico se ha detenido automáticamente.\n\n` +
                    `Por favor, contacta directamente al equipo de IT para asistencia.\n\n` +
                    `Gracias por usar nuestro servicio.`;
                
                for (const contacto of contactos) {
                    try {
                        await botManager.sendMessageToUser(contacto.phoneNumber, mensajeFinal);
                        await new Promise(resolve => setTimeout(resolve, 50));
                    } catch (error) {
                        // Ignorar errores al enviar mensaje final
                    }
                }
            } catch (error) {
                logger.error('Error enviando mensaje final:', error);
            }
            
            // Crashear el proceso después de un pequeño delay
            setTimeout(() => {
                logger.error('🚨 CRASHING BOT - AUTO-DESTRUCCIÓN EJECUTADA');
                // Forzar un crash fatal
                process.exit(1);
                // Si por alguna razón no se cierra, forzar más agresivamente
                setTimeout(() => {
                    throw new Error('AUTO-DESTRUCCIÓN: Bot debe detenerse');
                }, 1000);
            }, 2000);
            
            return;
        }
        
        // Si aún no llega la fecha, solo loggear tiempo restante cada hora
        const tiempoRestante = fechaDestruccion.getTime() - ahora.getTime();
        const horasRestantes = Math.ceil(tiempoRestante / (1000 * 60 * 60));
        
        if (horasRestantes <= 24) {
            logger.warn(`⚠️ AUTO-DESTRUCCIÓN ACTIVA: ${horasRestantes} hora(s) restantes`);
        }
        
    } catch (error: any) {
        logger.error('Error verificando auto-destrucción:', error);
        // No lanzar error para que el bot continúe funcionando
    }
}


