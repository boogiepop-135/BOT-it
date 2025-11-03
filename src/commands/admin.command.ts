import { Message } from "whatsapp-web.js";
import { UserI18n } from "../utils/i18n.util";
import { BotManager } from "../bot.manager";
import { ContactModel } from "../crm/models/contact.model";
import logger from "../configs/logger.config";

export interface AdminConversation {
    step: 'command' | 'send_user' | 'send_message' | 'redirect_target' | 'redirect_message' | 'pause_user' | 'resume_user' | 'resolve_ticket' | 'resolve_solution' | 'none';
    action?: string;
    targetUser?: string;
    message?: string;
    ticketId?: string;
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

        if (textoMensaje.includes("tickets abiertos") || textoMensaje.includes("ver tickets") ||
            textoMensaje.includes("tickets pendientes") || textoMensaje.includes("lista tickets")) {
            await verTicketsAbiertos(message);
            return;
        }

        if (textoMensaje.includes("resolver ticket") || textoMensaje.includes("cerrar ticket") ||
            textoMensaje.includes("resolver") || textoMensaje.match(/resolver.*tkt|resolver.*ticket/i)) {
            await iniciarResolverTicket(message, userNumber);
            return;
        }

        if (textoMensaje.includes("métricas tickets") || textoMensaje.includes("metricas tickets") ||
            textoMensaje.includes("estadísticas tickets") || textoMensaje.includes("estadisticas tickets")) {
            await mostrarMetricasTickets(message);
            return;
        }

        // Si no se detecta intención, mostrar menú mejorado para Levi
        await message.reply(
            `🔧 *Panel de Administración - Levi Villarreal*\n\n` +
            `👋 ¡Hola Levi! Menú administrativo personalizado:\n\n` +
            `📋 *GESTIÓN DE TICKETS* (Tu área principal)\n` +
            `"tickets abiertos" o "ver tickets"\n` +
            `Ver todos los tickets pendientes de resolución.\n\n` +
            `✅ *RESOLVER TICKET*\n` +
            `"resolver ticket" o "cerrar ticket"\n` +
            `Resolver un ticket específico con solución.\n\n` +
            `📊 *MÉTRICAS DE TICKETS*\n` +
            `"métricas tickets" o "estadísticas tickets"\n` +
            `Ver estadísticas de tickets (abiertos, resueltos, tiempos).\n\n` +
            `👥 *GESTIÓN DE USUARIOS*\n` +
            `"usuarios" - Ver lista de usuarios\n` +
            `"pausar usuario [número]" - Pausar acceso\n` +
            `"reanudar usuario [número]" - Reactivar acceso\n\n` +
            `💬 *COMUNICACIÓN*\n` +
            `"enviar mensaje" - Enviar mensaje a usuario\n` +
            `"redireccionar" - Redirigir mensaje entre usuarios\n\n` +
            `📊 *ESTADÍSTICAS DEL SISTEMA*\n` +
            `"estadisticas" o "stats"\n` +
            `Ver métricas generales del sistema.\n\n` +
            `🔧 *OTROS COMANDOS*\n` +
            `"proyectos" - Ver proyectos IT\n` +
            `"tareas" - Ver tareas activas\n` +
            `"reportes" - Ver reportes programados\n\n` +
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

        case 'resolve_ticket':
            const ticketId = texto.trim();
            if (!ticketId) {
                await message.reply('❌ Por favor, proporciona el número del ticket.');
                return;
            }
            
            try {
                const { TicketModel } = await import('../crm/models/ticket.model');
                
                // Buscar ticket por número o ID
                const ticket = await TicketModel.findOne({
                    $or: [
                        { ticketNumber: ticketId },
                        { _id: ticketId }
                    ]
                }).lean();
                
                if (!ticket) {
                    await message.reply(`❌ Ticket no encontrado: ${ticketId}\n\nVerifica el número del ticket e intenta de nuevo.`);
                    return;
                }
                
                if ((ticket as any).status === 'resolved' || (ticket as any).status === 'closed') {
                    await message.reply(`⚠️ Este ticket ya está ${(ticket as any).status === 'resolved' ? 'resuelto' : 'cerrado'}.\n\nTicket: ${(ticket as any).ticketNumber || ticketId}`);
                    conversations.delete(userNumber);
                    return;
                }
                
                conversation.ticketId = (ticket as any)._id?.toString() || ticketId;
                conversation.step = 'resolve_solution';
                
                await message.reply(
                    `✅ *Ticket Encontrado*\n\n` +
                    `🎫 *Ticket:* ${(ticket as any).ticketNumber || ticketId}\n` +
                    `📝 *Título:* ${(ticket as any).title || 'Sin título'}\n` +
                    `📍 *Sucursal:* ${(ticket as any).sucursal || 'N/A'}\n` +
                    `🏷️ *Categoría:* ${(ticket as any).category || 'N/A'}\n\n` +
                    `📝 *Paso 2: Solución*\n\n` +
                    `¿Cuál fue la solución aplicada?\n\n` +
                    `Escribe la descripción de la solución:`
                );
            } catch (error: any) {
                logger.error('Error buscando ticket:', error);
                await message.reply(`❌ Error al buscar ticket: ${error.message || 'Error desconocido'}`);
                conversations.delete(userNumber);
            }
            break;

        case 'resolve_solution':
            const solution = texto.trim();
            if (!solution) {
                await message.reply('❌ La solución no puede estar vacía. Por favor, describe la solución aplicada.');
                return;
            }
            
            try {
                const { TicketModel } = await import('../crm/models/ticket.model');
                const ticket = await TicketModel.findById(conversation.ticketId);
                
                if (!ticket) {
                    await message.reply('❌ Ticket no encontrado. La sesión ha sido cancelada.');
                    conversations.delete(userNumber);
                    return;
                }
                
                // Actualizar ticket
                ticket.status = 'resolved';
                ticket.resolvedAt = new Date();
                ticket.solution = solution;
                
                // Calcular tiempo de resolución
                if (ticket.createdAt) {
                    const resolutionTime = (ticket.resolvedAt.getTime() - ticket.createdAt.getTime()) / (1000 * 60);
                    ticket.resolutionTime = Math.round(resolutionTime);
                }
                
                await ticket.save();
                
                // Enviar mensaje al usuario
                const autoMessage = `✅ Tu ticket *${ticket.ticketNumber}* "${ticket.title}" ha sido resuelto.\n\n` +
                    `🔧 *Solución:*\n${solution}\n\n` +
                    `Gracias por usar nuestro sistema de soporte.`;
                
                await botManager.sendMessageToUser(ticket.createdBy, autoMessage);
                
                await message.reply(
                    `✅ *Ticket Resuelto Exitosamente*\n\n` +
                    `🎫 *Ticket:* ${ticket.ticketNumber}\n` +
                    `📝 *Título:* ${ticket.title}\n` +
                    `✅ *Solución aplicada*\n` +
                    `⏱️ *Tiempo de resolución:* ${ticket.resolutionTime || 'N/A'} minutos\n\n` +
                    `El usuario ha sido notificado.`
                );
                
                conversations.delete(userNumber);
            } catch (error: any) {
                logger.error('Error resolviendo ticket:', error);
                await message.reply(`❌ Error al resolver ticket: ${error.message || 'Error desconocido'}`);
                conversations.delete(userNumber);
            }
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

async function verTicketsAbiertos(message: Message) {
    try {
        const { TicketModel } = await import('../crm/models/ticket.model');
        
        const tickets = await TicketModel.find({
            status: { $in: ['open', 'assigned', 'in_progress'] }
        })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

        if (tickets.length === 0) {
            await message.reply('✅ No hay tickets abiertos pendientes.');
            return;
        }

        let lista = `🔧 *Tickets Abiertos* (Mostrando últimos 10)\n\n`;
        
        tickets.forEach((ticket: any, index: number) => {
            const prioridad = ticket.priority || 'medium';
            const emojiPrioridad = prioridad === 'urgent' ? '🔴' : prioridad === 'high' ? '🟠' : prioridad === 'medium' ? '🟡' : '🟢';
            const estado = ticket.status === 'open' ? 'Abierto' : ticket.status === 'assigned' ? 'Asignado' : 'En Progreso';
            
            lista += `${index + 1}. ${emojiPrioridad} *${ticket.ticketNumber || 'N/A'}*\n`;
            lista += `   📝 ${ticket.title || 'Sin título'}\n`;
            lista += `   📍 Sucursal: ${ticket.sucursal || 'N/A'}\n`;
            lista += `   🏷️ Categoría: ${ticket.category || 'N/A'}\n`;
            lista += `   📊 Estado: ${estado}\n`;
            lista += `   📅 Creado: ${new Date(ticket.createdAt).toLocaleDateString('es-MX')}\n\n`;
        });

        await message.reply(lista);
    } catch (error: any) {
        logger.error("Error listando tickets:", error);
        await message.reply(`❌ Error al obtener tickets: ${error.message || 'Error desconocido'}`);
    }
}

async function iniciarResolverTicket(message: Message, userNumber: string) {
    const conversation: AdminConversation = {
        step: 'resolve_ticket',
        action: 'resolve'
    };
    conversations.set(userNumber, conversation);
    
    await message.reply(
        `✅ *Resolver Ticket*\n\n` +
        `¿Cuál es el número o ID del ticket que quieres resolver?\n\n` +
        `Ejemplos:\n` +
        `• TKT-000001\n` +
        `• 69081eb4f040bc571433931b\n\n` +
        `Escribe el número del ticket:`
    );
}

async function mostrarMetricasTickets(message: Message) {
    try {
        const { TicketModel } = await import('../crm/models/ticket.model');
        
        const total = await TicketModel.countDocuments();
        const abiertos = await TicketModel.countDocuments({ status: { $in: ['open', 'assigned', 'in_progress'] } });
        const resueltos = await TicketModel.countDocuments({ status: 'resolved' });
        const cerrados = await TicketModel.countDocuments({ status: 'closed' });
        
        const ticketsPorCategoria = await TicketModel.aggregate([
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        let stats = `📊 *Métricas de Tickets*\n\n`;
        stats += `📋 *ESTADO GENERAL*\n`;
        stats += `• Total: ${total}\n`;
        stats += `• Abiertos: ${abiertos}\n`;
        stats += `• Resueltos: ${resueltos}\n`;
        stats += `• Cerrados: ${cerrados}\n\n`;
        
        if (ticketsPorCategoria.length > 0) {
            stats += `🏷️ *POR CATEGORÍA*\n`;
            ticketsPorCategoria.slice(0, 5).forEach((cat: any) => {
                const nombre = cat._id || 'Sin categoría';
                stats += `• ${nombre}: ${cat.count}\n`;
            });
        }

        await message.reply(stats);
    } catch (error: any) {
        logger.error("Error mostrando métricas de tickets:", error);
        await message.reply(`❌ Error al obtener métricas: ${error.message || 'Error desconocido'}`);
    }
}

