import { Message } from "whatsapp-web.js";
import { UserI18n } from "../utils/i18n.util";
import { BotManager } from "../bot.manager";
import { ContactModel } from "../crm/models/contact.model";
import logger from "../configs/logger.config";

export interface AdminConversation {
    step: 'command' | 'send_user' | 'send_message' | 'redirect_target' | 'redirect_message' | 'pause_user' | 'resume_user' | 'none';
    action?: string;
    targetUser?: string;
    message?: string;
}

export const conversations = new Map<string, AdminConversation>();

export const run = async (message: Message, args: string[] | null, userI18n: UserI18n) => {
    try {
        const contact = await message.getContact();
        const userNumber = contact.number;
        const textoMensaje = message.body.trim().toLowerCase();
        const argsArray = args || textoMensaje.split(' ');

        // Verificar si el usuario tiene rol de Levi o super_admin
        const contactDoc = await ContactModel.findOne({ phoneNumber: userNumber });
        const isLevi = contactDoc?.role === 'levi' || contactDoc?.role === 'super_admin';
        
        if (!isLevi) {
            await message.reply(
                `❌ No tienes permiso para usar este comando.\n\n` +
                `Este comando está disponible solo para el administrador principal.`
            );
            return;
        }

        // Verificar si hay una conversación activa
        const conversation = conversations.get(userNumber);

        // Si el usuario escribe "cancel" o "cancelar"
        if (textoMensaje === 'cancel' || textoMensaje === 'cancelar' || textoMensaje === 'salir') {
            conversations.delete(userNumber);
            await message.reply('✅ Operación cancelada.');
            return;
        }

        // Si hay una conversación activa, procesarla
        if (conversation && conversation.step !== 'none') {
            await processAdminConversation(message, conversation, userNumber);
            return;
        }

        // Detectar comandos
        if (textoMensaje.includes("enviar mensaje") || textoMensaje.includes("mandar mensaje") ||
            textoMensaje.includes("mensaje a") || textoMensaje.match(/^enviar|^mandar/)) {
            await iniciarEnviarMensaje(message, userNumber);
            return;
        }

        if (textoMensaje.includes("redireccionar") || textoMensaje.includes("redirigir") ||
            textoMensaje.includes("reenviar")) {
            await iniciarRedireccionar(message, userNumber);
            return;
        }

        if (textoMensaje.includes("pausar usuario") || textoMensaje.includes("pausar")) {
            await iniciarPausarUsuario(message, userNumber);
            return;
        }

        if (textoMensaje.includes("reanudar usuario") || textoMensaje.includes("reanudar") ||
            textoMensaje.includes("activar usuario")) {
            await iniciarReanudarUsuario(message, userNumber);
            return;
        }

        if (textoMensaje.includes("usuarios") || textoMensaje.includes("lista usuarios") ||
            textoMensaje.includes("ver usuarios")) {
            await listarUsuarios(message);
            return;
        }

        if (textoMensaje.includes("estadisticas") || textoMensaje.includes("estadísticas") ||
            textoMensaje.includes("stats")) {
            await mostrarEstadisticas(message);
            return;
        }

        // Si no se detecta intención, mostrar ayuda
        await message.reply(
            `🔧 *Panel de Administración - Levi Villarreal*\n\n` +
            `Comandos administrativos disponibles:\n\n` +
            `📤 *ENVIAR MENSAJE*\n` +
            `"enviar mensaje" o "mandar mensaje"\n` +
            `Enviar mensaje a un usuario específico.\n\n` +
            `🔄 *REDIRECCIONAR MENSAJE*\n` +
            `"redireccionar" o "redirigir"\n` +
            `Reenviar un mensaje a otro usuario.\n\n` +
            `⏸️ *PAUSAR USUARIO*\n` +
            `"pausar usuario"\n` +
            `Pausar bot para un usuario específico.\n\n` +
            `▶️ *REANUDAR USUARIO*\n` +
            `"reanudar usuario"\n` +
            `Reactivar bot para un usuario.\n\n` +
            `👥 *LISTAR USUARIOS*\n` +
            `"usuarios" o "lista usuarios"\n` +
            `Ver lista de usuarios del sistema.\n\n` +
            `📊 *ESTADÍSTICAS*\n` +
            `"estadisticas" o "stats"\n` +
            `Ver estadísticas del sistema.\n\n` +
            `_Escribe \`cancel\` en cualquier momento para cancelar._`
        );
    } catch (error) {
        logger.error("Error en admin.command:", error);
        await message.reply("❌ Ocurrió un error al procesar tu solicitud.");
    }
};

async function iniciarEnviarMensaje(message: Message, userNumber: string) {
    const conversation: AdminConversation = {
        step: 'send_user',
        action: 'send'
    };
    conversations.set(userNumber, conversation);
    
    await message.reply(
        `📤 *Enviar Mensaje a Usuario*\n\n` +
        `¿A qué número de teléfono quieres enviar el mensaje?\n\n` +
        `Ejemplos:\n` +
        `• 5214421056597\n` +
        `• 4421056597\n\n` +
        `Escribe el número de teléfono:`
    );
}

async function iniciarRedireccionar(message: Message, userNumber: string) {
    const conversation: AdminConversation = {
        step: 'redirect_target',
        action: 'redirect'
    };
    conversations.set(userNumber, conversation);
    
    await message.reply(
        `🔄 *Redireccionar Mensaje*\n\n` +
        `Este comando permite reenviar un mensaje a otro usuario.\n\n` +
        `⚠️ *Nota:* Para redireccionar, primero envía el mensaje que quieres redirigir como respuesta, o escribe el número del usuario origen:\n\n` +
        `¿De qué número quieres redirigir el mensaje?\n\n` +
        `Escribe el número de teléfono de origen:`
    );
}

async function iniciarPausarUsuario(message: Message, userNumber: string) {
    const conversation: AdminConversation = {
        step: 'pause_user',
        action: 'pause'
    };
    conversations.set(userNumber, conversation);
    
    await message.reply(
        `⏸️ *Pausar Usuario*\n\n` +
        `¿Qué número de teléfono quieres pausar?\n\n` +
        `Escribe el número de teléfono:`
    );
}

async function iniciarReanudarUsuario(message: Message, userNumber: string) {
    const conversation: AdminConversation = {
        step: 'resume_user',
        action: 'resume'
    };
    conversations.set(userNumber, conversation);
    
    await message.reply(
        `▶️ *Reanudar Usuario*\n\n` +
        `¿Qué número de teléfono quieres reanudar?\n\n` +
        `Escribe el número de teléfono:`
    );
}

async function processAdminConversation(message: Message, conversation: AdminConversation, userNumber: string) {
    const texto = message.body.trim();
    const botManager = BotManager.getInstance();

    switch (conversation.step) {
        case 'send_user':
            // Verificar si viene de una acción de redirección
            if (conversation.action === 'redirect') {
                const destinatario = texto.replace(/[^0-9]/g, '');
                if (!destinatario || destinatario.length < 10) {
                    await message.reply('❌ Número de teléfono inválido. Por favor, escribe un número válido.');
                    return;
                }
                
                // Enviar mensaje redirigido
                try {
                    const mensajeRedirigido = `🔄 *Mensaje Redirigido*\n\n` +
                        `*De:* ${conversation.targetUser}\n` +
                        `*Mensaje:* ${conversation.message}\n\n` +
                        `_Este mensaje ha sido redirigido por un administrador._`;
                    
                    const success = await botManager.sendMessageToUser(destinatario, mensajeRedirigido);
                    if (success) {
                        await message.reply(
                            `✅ *Mensaje Redirigido Exitosamente*\n\n` +
                            `📤 *Destinatario:* ${destinatario}\n` +
                            `💬 *Mensaje:* ${conversation.message}\n\n` +
                            `El mensaje se ha redirigido correctamente.`
                        );
                    } else {
                        await message.reply(
                            `❌ Error al redirigir el mensaje.\n\n` +
                            `Verifica que el número de teléfono sea correcto.`
                        );
                    }
                } catch (error: any) {
                    logger.error('Error redirigiendo mensaje:', error);
                    await message.reply(`❌ Error al redirigir mensaje: ${error.message || 'Error desconocido'}`);
                }
                
                conversations.delete(userNumber);
                return;
            }
            
            // Flujo normal de enviar mensaje
            conversation.targetUser = texto.replace(/[^0-9]/g, '');
            if (!conversation.targetUser || conversation.targetUser.length < 10) {
                await message.reply('❌ Número de teléfono inválido. Por favor, escribe un número válido.');
                return;
            }
            conversation.step = 'send_message';
            await message.reply(
                `✅ Usuario destino: *${conversation.targetUser}*\n\n` +
                `📝 *Paso 2: Mensaje*\n\n` +
                `¿Qué mensaje quieres enviar?\n\n` +
                `Escribe el mensaje:`
            );
            break;

        case 'send_message':
            conversation.message = texto;
            if (!conversation.message) {
                await message.reply('❌ El mensaje no puede estar vacío. Por favor, escribe un mensaje.');
                return;
            }
            
            // Enviar mensaje
            try {
                const success = await botManager.sendMessageToUser(conversation.targetUser!, conversation.message);
                if (success) {
                    await message.reply(
                        `✅ *Mensaje Enviado Exitosamente*\n\n` +
                        `📤 *Destinatario:* ${conversation.targetUser}\n` +
                        `💬 *Mensaje:* ${conversation.message.substring(0, 50)}${conversation.message.length > 50 ? '...' : ''}\n\n` +
                        `El mensaje se ha entregado correctamente.`
                    );
                } else {
                    await message.reply(
                        `❌ Error al enviar el mensaje.\n\n` +
                        `Verifica que el número de teléfono sea correcto y que el usuario tenga WhatsApp.`
                    );
                }
            } catch (error: any) {
                logger.error('Error enviando mensaje:', error);
                await message.reply(`❌ Error al enviar mensaje: ${error.message || 'Error desconocido'}`);
            }
            
            conversations.delete(userNumber);
            break;

        case 'redirect_target':
            conversation.targetUser = texto.replace(/[^0-9]/g, '');
            if (!conversation.targetUser || conversation.targetUser.length < 10) {
                await message.reply('❌ Número de teléfono inválido. Por favor, escribe un número válido.');
                return;
            }
            conversation.step = 'redirect_message';
            await message.reply(
                `✅ Usuario origen: *${conversation.targetUser}*\n\n` +
                `📝 *Paso 2: Mensaje a Redirigir*\n\n` +
                `Escribe el mensaje que quieres redirigir, o envía "último" para redirigir el último mensaje de ese usuario:\n\n` +
                `¿Cuál es el mensaje?`
            );
            break;

        case 'redirect_message':
            let mensajeRedirigir = texto;
            if (texto.toLowerCase() === 'último' || texto.toLowerCase() === 'ultimo') {
                // TODO: Implementar lógica para obtener último mensaje del usuario
                await message.reply(
                    `⚠️ Función de último mensaje aún en desarrollo.\n\n` +
                    `Por favor, escribe el mensaje que quieres redirigir.`
                );
                return;
            }
            
            conversation.message = mensajeRedirigir;
            conversation.step = 'send_user'; // Ahora necesitamos saber a quién redirigir
            await message.reply(
                `✅ Mensaje a redirigir: *${mensajeRedirigir.substring(0, 50)}${mensajeRedirigir.length > 50 ? '...' : ''}*\n\n` +
                `📤 *Paso 3: Destinatario*\n\n` +
                `¿A qué número quieres redirigir este mensaje?\n\n` +
                `Escribe el número de teléfono de destino:`
            );
            break;

        case 'pause_user':
            const usuarioPausar = texto.replace(/[^0-9]/g, '');
            if (!usuarioPausar || usuarioPausar.length < 10) {
                await message.reply('❌ Número de teléfono inválido. Por favor, escribe un número válido.');
                return;
            }
            
            try {
                await ContactModel.findOneAndUpdate(
                    { phoneNumber: usuarioPausar },
                    { 
                        $set: { 
                            botPaused: true,
                            botPausedAt: new Date()
                        }
                    },
                    { upsert: true }
                );
                
                await message.reply(
                    `✅ *Usuario Pausado Exitosamente*\n\n` +
                    `👤 *Usuario:* ${usuarioPausar}\n` +
                    `⏸️ *Estado:* Pausado\n\n` +
                    `El bot no responderá automáticamente a este usuario hasta que sea reanudado.`
                );
                
                // Notificar al usuario que fue pausado
                await botManager.sendMessageToUser(
                    usuarioPausar,
                    `⏸️ *Bot Pausado*\n\n` +
                    `Tu acceso al bot ha sido pausado temporalmente.\n\n` +
                    `📧 Para reactivarlo, contacta al administrador.`
                );
            } catch (error: any) {
                logger.error('Error pausando usuario:', error);
                await message.reply(`❌ Error al pausar usuario: ${error.message || 'Error desconocido'}`);
            }
            
            conversations.delete(userNumber);
            break;

        case 'resume_user':
            const usuarioReanudar = texto.replace(/[^0-9]/g, '');
            if (!usuarioReanudar || usuarioReanudar.length < 10) {
                await message.reply('❌ Número de teléfono inválido. Por favor, escribe un número válido.');
                return;
            }
            
            try {
                await ContactModel.findOneAndUpdate(
                    { phoneNumber: usuarioReanudar },
                    { 
                        $set: { botPaused: false },
                        $unset: { botPausedAt: "" }
                    }
                );
                
                await message.reply(
                    `✅ *Usuario Reanudado Exitosamente*\n\n` +
                    `👤 *Usuario:* ${usuarioReanudar}\n` +
                    `▶️ *Estado:* Activo\n\n` +
                    `El bot ahora responderá automáticamente a este usuario.`
                );
                
                // Notificar al usuario que fue reanudado
                await botManager.sendMessageToUser(
                    usuarioReanudar,
                    `▶️ *Bot Reanudado*\n\n` +
                    `Tu acceso al bot ha sido reactivado.\n\n` +
                    `¡Puedes volver a usar todos los comandos normalmente!`
                );
            } catch (error: any) {
                logger.error('Error reanudando usuario:', error);
                await message.reply(`❌ Error al reanudar usuario: ${error.message || 'Error desconocido'}`);
            }
            
            conversations.delete(userNumber);
            break;
    }

    conversations.set(userNumber, conversation);
}

async function listarUsuarios(message: Message) {
    try {
        const usuarios = await ContactModel.find({})
            .sort({ lastInteraction: -1 })
            .limit(20)
            .lean();

        if (usuarios.length === 0) {
            await message.reply('📋 No hay usuarios registrados en el sistema.');
            return;
        }

        let lista = `👥 *Usuarios del Sistema* (Mostrando últimos 20)\n\n`;

        usuarios.forEach((user: any, index: number) => {
            const estado = user.botPaused ? '⏸️ Pausado' : '✅ Activo';
            const rol = user.role || 'user';
            const nombre = user.name || user.pushName || 'Sin nombre';
            const fecha = new Date(user.lastInteraction).toLocaleDateString('es-MX');
            
            lista += `${index + 1}. *${nombre}*\n`;
            lista += `   📱 ${user.phoneNumber}\n`;
            lista += `   🎭 Rol: ${rol}\n`;
            lista += `   ${estado}\n`;
            lista += `   📅 Última interacción: ${fecha}\n\n`;
        });

        await message.reply(lista);
    } catch (error: any) {
        logger.error("Error listando usuarios:", error);
        await message.reply(`❌ Error al obtener usuarios: ${error.message || 'Error desconocido'}`);
    }
}

async function mostrarEstadisticas(message: Message) {
    try {
        const totalUsuarios = await ContactModel.countDocuments();
        const usuariosActivos = await ContactModel.countDocuments({ botPaused: { $ne: true } });
        const usuariosPausados = await ContactModel.countDocuments({ botPaused: true });
        
        const usuariosPorRol = await ContactModel.aggregate([
            {
                $group: {
                    _id: '$role',
                    count: { $sum: 1 }
                }
            }
        ]);

        let stats = `📊 *Estadísticas del Sistema*\n\n`;
        stats += `👥 *USUARIOS*\n`;
        stats += `• Total: ${totalUsuarios}\n`;
        stats += `• Activos: ${usuariosActivos}\n`;
        stats += `• Pausados: ${usuariosPausados}\n\n`;
        
        if (usuariosPorRol.length > 0) {
            stats += `🎭 *USUARIOS POR ROL*\n`;
            usuariosPorRol.forEach((rol: any) => {
                const nombreRol = rol._id || 'Sin rol';
                stats += `• ${nombreRol}: ${rol.count}\n`;
            });
        }

        await message.reply(stats);
    } catch (error: any) {
        logger.error("Error mostrando estadísticas:", error);
        await message.reply(`❌ Error al obtener estadísticas: ${error.message || 'Error desconocido'}`);
    }
}

