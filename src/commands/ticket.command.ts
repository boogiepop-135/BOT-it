import { Message } from "whatsapp-web.js";
import { UserI18n } from "../utils/i18n.util";
import { TicketModel } from "../crm/models/ticket.model";
import logger from "../configs/logger.config";
import { ContactModel } from "../crm/models/contact.model";
import { ScheduleUtil } from "../utils/schedule.util";

// Detectar si el mensaje es sobre IT
export function isITRelated(message: string): boolean {
    const itKeywords = [
        'pos', 'impresora', 'correo', 'email', 'microsoft', 'outlook', 
        'word', 'excel', 'teams', 'onedrive', 'sharepoint',
        'no funciona', 'no imprime', 'se cayó', 'se cayó',
        'internet', 'red', 'wifi', 'conexión', 'conectividad',
        'backup', 'respaldar', 'copias', 'servidor',
        'computadora', 'pc', 'laptop', 'equipo',
        'software', 'programa', 'aplicación',
        'security', 'seguridad', 'acceso', 'password',
        'hardware', 'problema técnico', 'soporte técnico',
        'error', 'bug', 'falla', 'se cuelga'
    ];
    
    const lowerMessage = message.toLowerCase();
    return itKeywords.some(keyword => lowerMessage.includes(keyword));
}

// Estado de conversación para cada usuario
export interface TicketConversation {
    step: string;
    sucursal?: string;
    category?: string;
    title?: string;
    description?: string;
}

export const conversations = new Map<string, TicketConversation>();

export const run = async (message: Message, args: string[] = null, userI18n: UserI18n) => {
    try {
        const contact = await message.getContact();
        const chat = await message.getChat();
        const userNumber = contact.number;
        
        // Verificar si hay una conversación activa
        const conversation = conversations.get(userNumber);
        
        // Subcomandos disponibles
        const subcommands = ['create', 'list', 'view', 'comment', 'status', 'cancel'];
        
        // Si el usuario escribe "cancel" o "cancelar" en cualquier momento
        const messageText = message.body.toLowerCase().trim();
        if (messageText === 'cancel' || messageText === 'cancelar' || messageText === 'salir') {
            conversations.delete(userNumber);
            await message.reply('✅ Conversación cancelada. Puedes crear un nuevo ticket cuando quieras.');
            return;
        }
        
        // Si hay una conversación activa, procesar la respuesta
        if (conversation && conversation.step !== 'none') {
            await processConversation(message, conversation, userNumber, chat);
            return;
        }
        
        if (!args || args.length === 0) {
            // If no arguments, automatically start ticket creation
            const conversation: TicketConversation = {
                step: 'sucursal'
            };
            conversations.set(userNumber, conversation);
            
            const question = `🔧 *Creación de Ticket - Paso 1/4*

📍 Primero, selecciona la sucursal donde ocurre el problema:

1️⃣ Lomas
2️⃣ Decathlon  
3️⃣ Centro Sur
4️⃣ Ninguna/General

*Responde con el número o el nombre de la sucursal.*
*Escribe \`cancel\` para salir.*`;

            await message.reply(question);
            return;
        }
        
        const subcommand = args[0].toLowerCase();
        
        switch(subcommand) {
            case 'create':
            case 'new':
            case 'crear':
                // Iniciar conversación guiada
                await startTicketConversation(message, userNumber);
                break;
            case 'list':
            case 'lista':
            case 'mis':
                await listTickets(message, contact);
                break;
            case 'view':
            case 'ver':
            case 'detalle':
                await viewTicket(message, args.slice(1), contact);
                break;
            case 'comment':
            case 'comentario':
            case 'comentar':
                await addComment(message, args.slice(1), contact);
                break;
            case 'status':
            case 'estado':
                await getTicketStatus(message, args.slice(1));
                break;
            case 'help':
            case 'ayuda':
                await message.reply(`🔧 *Comandos disponibles:*
• \`!ticket\` - Crear ticket (modo guiado) ⭐
• \`!ticket list\` - Ver mis tickets
• \`!ticket view TKT-000001\` - Ver detalles
• \`!ticket comment TKT-000001 mensaje\` - Agregar comentario
• \`cancel\` - Cancelar conversación`);
                break;
            default:
                // Si no es un comando válido, iniciar creación directamente
                await startTicketConversation(message, userNumber);
        }
        
    } catch (error) {
        logger.error('Ticket command error:', error);
        await message.reply('❌ Ocurrió un error al procesar tu solicitud.');
    }
};

async function createTicket(message: Message, args: string[], contact: any, chat: any) {
    const categories = ['hardware', 'software', 'network', 'security', 'm365', 'pos', 'backup', 'other'];
    
    if (args.length < 2) {
        await message.reply('❌ Formato incorrecto.\n\n`!ticket create <categoría> <título> <descripción>`');
        return;
    }
    
    const category = args[0].toLowerCase();
    if (!categories.includes(category)) {
        await message.reply(`❌ Categoría inválida. Categorías válidas: ${categories.join(', ')}`);
        return;
    }
    
    const title = args[1];
    const description = args.slice(2).join(' ') || 'Sin descripción';
    
    // Determinar prioridad basada en palabras clave
    let priority = 'medium';
    const urgentKeywords = ['urgente', 'caído', 'crítico', 'emergencia', 'no funciona'];
    const highKeywords = ['importante', 'rápido', 'necesita', 'problema'];
    const lowKeywords = ['consultar', 'duda', 'pregunta', 'mejorar'];
    
    const text = `${title} ${description}`.toLowerCase();
    if (urgentKeywords.some(kw => text.includes(kw))) priority = 'urgent';
    else if (highKeywords.some(kw => text.includes(kw))) priority = 'high';
    else if (lowKeywords.some(kw => text.includes(kw))) priority = 'low';
    
    try {
        const ticket = new TicketModel({
            title,
            description,
            category,
            priority,
            createdBy: contact.number,
            creatorName: contact.name || contact.pushname,
            status: 'open'
        });
        
        await ticket.save();
        
        const priorityEmoji = {
            'urgent': '🔴',
            'high': '🟠',
            'medium': '🟡',
            'low': '🟢'
        };
        
        const statusEmoji = {
            'open': '📝',
            'assigned': '👤',
            'in_progress': '⚙️',
            'resolved': '✅',
            'closed': '🔒'
        };
        
        const categoryEmoji = {
            'hardware': '💻',
            'software': '📱',
            'network': '🌐',
            'security': '🔒',
            'm365': '📧',
            'pos': '💳',
            'backup': '💾',
            'other': '📋'
        };
        
        // Verificar si es fuera de horario para agregar aviso
        const isBusinessHours = ScheduleUtil.isBusinessHours();
        let response = `✅ *Ticket creado exitosamente*

📊 *${ticket.ticketNumber}*
${categoryEmoji[category]} *${title}*

📝 ${description}
${statusEmoji[ticket.status]} Estado: ${ticket.status}
${priorityEmoji[priority]} Prioridad: ${priority}

Tu ticket ha sido registrado y será atendido por el equipo de IT.`;

        // Agregar aviso si es fuera de horario
        if (!isBusinessHours) {
            const nextBusinessHours = ScheduleUtil.getNextBusinessHours();
            const nextDate = nextBusinessHours.toLocaleString('es-MX', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'America/Mexico_City'
            });
            
            response += `\n\n⏰ *Aviso:* Fuera de horario de atención. Tu ticket será atendido en el siguiente horario hábil de IT (Lunes a Viernes, 9 AM - 5 PM) a partir del ${nextDate}.`;
        }
        
        await message.reply(response);
        
    } catch (error) {
        logger.error('Error creating ticket:', error);
        await message.reply('❌ Error al crear el ticket. Por favor, inténtalo de nuevo.');
    }
}

async function listTickets(message: Message, contact: any) {
    try {
        const tickets = await TicketModel.find({ createdBy: contact.number })
            .sort({ createdAt: -1 })
            .limit(10);
        
        if (tickets.length === 0) {
            await message.reply('📋 No tienes tickets registrados.');
            return;
        }
        
        let response = `📋 *Tus Últimos Tickets*\n\n`;
        
        tickets.forEach((ticket, index) => {
            const statusEmoji = {
                'open': '📝',
                'assigned': '👤',
                'in_progress': '⚙️',
                'resolved': '✅',
                'closed': '🔒'
            };
            
            const priorityEmoji = {
                'urgent': '🔴',
                'high': '🟠',
                'medium': '🟡',
                'low': '🟢'
            };
            
            response += `${index + 1}. *${ticket.ticketNumber}*\n`;
            response += `   📌 ${ticket.title}\n`;
            response += `   ${statusEmoji[ticket.status]} ${ticket.status} | ${priorityEmoji[ticket.priority]} ${ticket.priority}\n\n`;
        });
        
        await message.reply(response);
        
    } catch (error) {
        logger.error('Error listing tickets:', error);
        await message.reply('❌ Error al obtener tus tickets.');
    }
}

async function viewTicket(message: Message, args: string[], contact: any) {
    if (args.length === 0) {
        await message.reply('❌ Debes especificar el número de ticket.\n\n`!ticket view TKT-000001`');
        return;
    }
    
    const ticketNumber = args[0].toUpperCase();
    
    try {
        const ticket = await TicketModel.findOne({ 
            ticketNumber,
            createdBy: contact.number 
        });
        
        if (!ticket) {
            await message.reply('❌ No se encontró el ticket especificado.');
            return;
        }
        
        const statusEmoji = {
            'open': '📝 Abierto',
            'assigned': '👤 Asignado',
            'in_progress': '⚙️ En Progreso',
            'resolved': '✅ Resuelto',
            'closed': '🔒 Cerrado'
        };
        
        const priorityEmoji = {
            'urgent': '🔴 Urgente',
            'high': '🟠 Alta',
            'medium': '🟡 Media',
            'low': '🟢 Baja'
        };
        
        const categoryEmoji = {
            'hardware': '💻',
            'software': '📱',
            'network': '🌐',
            'security': '🔒',
            'm365': '📧',
            'pos': '💳',
            'backup': '💾',
            'other': '📋'
        };
        
        let response = `📊 *Detalles del Ticket*\n\n`;
        response += `*${ticket.ticketNumber}*\n\n`;
        response += `📌 *${ticket.title}*\n`;
        response += `📝 ${ticket.description}\n\n`;
        response += `${categoryEmoji[ticket.category]} ${ticket.category}\n`;
        response += `Estado: ${statusEmoji[ticket.status]}\n`;
        response += `Prioridad: ${priorityEmoji[ticket.priority]}\n`;
        response += `Creado: ${ticket.createdAt.toLocaleDateString('es-ES')}\n`;
        
        if (ticket.comments && ticket.comments.length > 0) {
            response += `\n💬 *Comentarios (${ticket.comments.length}):*\n`;
            ticket.comments.slice(-3).forEach((comment, index) => {
                response += `\n${index + 1}. ${comment.user}:\n   ${comment.message}\n`;
            });
        }
        
        if (ticket.solution) {
            response += `\n✅ *Solución:*\n${ticket.solution}`;
        }
        
        await message.reply(response);
        
    } catch (error) {
        logger.error('Error viewing ticket:', error);
        await message.reply('❌ Error al obtener el ticket.');
    }
}

async function addComment(message: Message, args: string[], contact: any) {
    if (args.length < 2) {
        await message.reply('❌ Formato incorrecto.\n\n`!ticket comment <número> <mensaje>`');
        return;
    }
    
    const ticketNumber = args[0].toUpperCase();
    const commentText = args.slice(1).join(' ');
    
    try {
        const ticket = await TicketModel.findOne({ 
            ticketNumber,
            createdBy: contact.number 
        });
        
        if (!ticket) {
            await message.reply('❌ No se encontró el ticket especificado.');
            return;
        }
        
        const creatorName = contact.name || contact.pushname || contact.number;
        ticket.comments.push({
            user: creatorName,
            message: commentText,
            createdAt: new Date()
        });
        
        await ticket.save();
        
        await message.reply(`✅ Comentario agregado al ticket ${ticketNumber}`);
        
    } catch (error) {
        logger.error('Error adding comment:', error);
        await message.reply('❌ Error al agregar el comentario.');
    }
}

async function getTicketStatus(message: Message, args: string[]) {
    if (args.length === 0) {
        await message.reply('❌ Debes especificar el número de ticket.');
        return;
    }
    
    const ticketNumber = args[0].toUpperCase();
    
    try {
        const ticket = await TicketModel.findOne({ ticketNumber });
        
        if (!ticket) {
            await message.reply('❌ No se encontró el ticket especificado.');
            return;
        }
        
        const statusEmoji = {
            'open': '📝',
            'assigned': '👤',
            'in_progress': '⚙️',
            'resolved': '✅',
            'closed': '🔒'
        };
        
        await message.reply(`Estado del ticket ${ticketNumber}: ${statusEmoji[ticket.status]} ${ticket.status}`);
        
    } catch (error) {
        logger.error('Error getting ticket status:', error);
        await message.reply('❌ Error al consultar el estado del ticket.');
    }
}

// Nueva función para iniciar conversación guiada
export async function startTicketConversation(message: Message, userNumber: string) {
    const conversation: TicketConversation = {
        step: 'sucursal'
    };
    conversations.set(userNumber, conversation);
    
    const question = `🔧 *Creación de Ticket - Paso 1/4*

📍 Primero, selecciona la sucursal donde ocurre el problema:

1️⃣ Lomas
2️⃣ Decathlon
3️⃣ Centro Sur
4️⃣ Ninguna/General

*Responde con el número o el nombre de la sucursal.*
*Escribe \`cancel\` para salir.*`;

    await message.reply(question);
}

// Procesar respuestas de la conversación
async function processConversation(message: Message, conversation: TicketConversation, userNumber: string, chat: any) {
    const response = message.body.trim();
    const contact = await message.getContact();
    
    const categoryMap: { [key: string]: string } = {
        '1': 'hardware',
        '2': 'software',
        '3': 'network',
        '4': 'security',
        '5': 'm365',
        '6': 'pos',
        '7': 'backup',
        '8': 'other',
        'hardware': 'hardware',
        'software': 'software',
        'network': 'network',
        'security': 'security',
        'm365': 'm365',
        'pos': 'pos',
        'backup': 'backup',
        'other': 'other'
    };
    
    const categoryEmoji: { [key: string]: string } = {
        'hardware': '💻',
        'software': '📱',
        'network': '🌐',
        'security': '🔒',
        'm365': '📧',
        'pos': '💳',
        'backup': '💾',
        'other': '📋'
    };
    
    const sucursalMap: { [key: string]: string } = {
        '1': 'lomas',
        '2': 'decathlon',
        '3': 'centro-sur',
        '4': 'ninguna',
        'lomas': 'lomas',
        'decathlon': 'decathlon',
        'centro sur': 'centro-sur',
        'centro-sur': 'centro-sur',
        'centrosur': 'centro-sur',
        'ninguna': 'ninguna',
        'general': 'ninguna'
    };
    
    const sucursalEmoji: { [key: string]: string } = {
        'lomas': '🏢',
        'decathlon': '🏃',
        'centro-sur': '📍',
        'ninguna': '🏠'
    };
    
    try {
        if (conversation.step === 'sucursal') {
            const sucursal = sucursalMap[response.toLowerCase()];
            
            if (!sucursal) {
                await message.reply('❌ Sucursal no válida. Por favor, selecciona un número del 1 al 4 o escribe el nombre de la sucursal.\n\nEscribe \`cancel\` para salir.');
                return;
            }
            
            conversation.sucursal = sucursal;
            conversation.step = 'category';
            
            await message.reply(
                `${sucursalEmoji[sucursal]} Sucursal seleccionada: *${sucursal.replace('-', ' ')}*\n\n` +
                `🔧 *Paso 2/4*\n\n` +
                `Selecciona la categoría del problema:\n\n` +
                `1️⃣ Hardware (equipos, impresoras)\n` +
                `2️⃣ Software (programas, aplicaciones)\n` +
                `3️⃣ Network (red, internet, WiFi)\n` +
                `4️⃣ Security (seguridad, accesos)\n` +
                `5️⃣ Microsoft 365 (correo, Teams)\n` +
                `6️⃣ POS (punto de venta)\n` +
                `7️⃣ Backup (copias de seguridad)\n` +
                `8️⃣ Other (otro)\n\n` +
                `Escribe \`cancel\` para salir.`
            );
            
        } else if (conversation.step === 'category') {
            const category = categoryMap[response.toLowerCase()];
            
            if (!category) {
                await message.reply('❌ Categoría no válida. Por favor, selecciona un número del 1 al 8 o escribe el nombre de la categoría.\n\nEscribe \`cancel\` para salir.');
                return;
            }
            
            conversation.category = category;
            conversation.step = 'title';
            
            await message.reply(
                `${categoryEmoji[category]} Categoría seleccionada: *${category}*\n\n` +
                `📝 *Paso 3/4*\n\n` +
                `¿Cuál es el título o resumen del problema?\n\n` +
                `*Ejemplo:* "La impresora no funciona" o "No puedo acceder al correo"\n\n` +
                `Escribe \`cancel\` para salir.`
            );
            
        } else if (conversation.step === 'title') {
            if (response.length < 5) {
                await message.reply('❌ El título debe tener al menos 5 caracteres. Por favor, proporciona más detalles.\n\nEscribe \`cancel\` para salir.');
                return;
            }
            
            conversation.title = response;
            conversation.step = 'description';
            
            await message.reply(
                `✅ Título: *${response}*\n\n` +
                `📄 *Paso 4/4 - Final*\n\n` +
                `Ahora describe el problema con más detalle:\n` +
                `• ¿Cuándo empezó?\n` +
                `• ¿Qué estabas haciendo?\n` +
                `• ¿Qué error ves?\n` +
                `• Cualquier información adicional importante\n\n` +
                `Escribe \`cancel\` para salir.`
            );
            
        } else if (conversation.step === 'description') {
            conversation.description = response;
            
            // Crear el ticket
            await createTicketFromConversation(message, conversation, contact);
            
            // Limpiar conversación
            conversations.delete(userNumber);
        }
        
    } catch (error) {
        logger.error('Error processing conversation:', error);
        await message.reply('❌ Ocurrió un error. La conversación ha sido cancelada.');
        conversations.delete(userNumber);
    }
}

async function createTicketFromConversation(message: Message, conversation: TicketConversation, contact: any) {
    try {
        // Determinar prioridad
        let priority = 'medium';
        const urgentKeywords = ['urgente', 'caído', 'crítico', 'emergencia', 'no funciona', 'caído', 'caida'];
        const highKeywords = ['importante', 'rápido', 'necesita', 'problema', 'necesito'];
        const lowKeywords = ['consultar', 'duda', 'pregunta', 'mejorar', 'sugerencia'];
        
        const text = `${conversation.title} ${conversation.description}`.toLowerCase();
        if (urgentKeywords.some(kw => text.includes(kw))) priority = 'urgent';
        else if (highKeywords.some(kw => text.includes(kw))) priority = 'high';
        else if (lowKeywords.some(kw => text.includes(kw))) priority = 'low';
        
        // Generate ticket number first
        const count = await TicketModel.countDocuments();
        const ticketNumber = `TKT-${String(count + 1).padStart(6, '0')}`;
        
        const ticket = new TicketModel({
            ticketNumber,
            title: conversation.title,
            description: conversation.description,
            category: conversation.category,
            sucursal: conversation.sucursal || 'ninguna',
            priority,
            createdBy: contact.number,
            creatorName: contact.name || contact.pushname,
            status: 'open'
        });
        
        await ticket.save();
        
        const priorityEmoji = {
            'urgent': '🔴 URGENTE',
            'high': '🟠 ALTA',
            'medium': '🟡 MEDIA',
            'low': '🟢 BAJA'
        };
        
        const categoryEmoji = {
            'hardware': '💻',
            'software': '📱',
            'network': '🌐',
            'security': '🔒',
            'm365': '📧',
            'pos': '💳',
            'backup': '💾',
            'other': '📋'
        };
        
        // Verificar si es fuera de horario para agregar aviso
        const isBusinessHours = ScheduleUtil.isBusinessHours();
        let response = `✅ *Ticket creado exitosamente*

📊 *${ticket.ticketNumber}*
${categoryEmoji[conversation.category!]} *${conversation.title}*

📝 ${conversation.description}
⚙️ Estado: Abierto
${priorityEmoji[priority]} Prioridad: ${priority}

✅ Tu ticket ha sido registrado y será atendido por el equipo de IT.
Recibirás actualizaciones en cuanto haya progreso.`;

        // Agregar aviso si es fuera de horario
        if (!isBusinessHours) {
            const nextBusinessHours = ScheduleUtil.getNextBusinessHours();
            const nextDate = nextBusinessHours.toLocaleString('es-MX', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'America/Mexico_City'
            });
            
            response += `\n\n⏰ *Aviso:* Fuera de horario de atención. Tu ticket será atendido en el siguiente horario hábil de IT (Lunes a Viernes, 9 AM - 5 PM) a partir del ${nextDate}.`;
        }

        response += `\n\n*Ver mis tickets:* \`!ticket list\`
*Ver este ticket:* \`!ticket view ${ticket.ticketNumber}\`
*Agregar comentario:* \`!ticket comment ${ticket.ticketNumber} tu mensaje\``;
        
        await message.reply(response);
        
    } catch (error) {
        logger.error('Error creating ticket from conversation:', error);
        await message.reply('❌ Error al crear el ticket. Por favor, inténtalo de nuevo.');
    }
}

