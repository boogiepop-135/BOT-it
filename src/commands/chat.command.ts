import { Message, MessageMedia, MessageTypes } from "whatsapp-web.js";
import { aiCompletion } from "../utils/ai-fallback.util";
import logger from "../configs/logger.config";
import { AppConfig } from "../configs/app.config";
import { speechToText } from "../utils/speech-to-text.util";
import { textToSpeech } from "../utils/text-to-speech.util";
import { del_file } from "../utils/common.util";
import { UserI18n } from "../utils/i18n.util";
import SalesTracker from "../utils/sales-tracker.util";

const fs = require('fs');
const path = require('path');

import { isITRelated } from "./ticket.command";

export const run = async (message: Message, args: string[], userI18n: UserI18n) => {
    let query = args.join(" ");
    const chat = await message.getChat();
    
    // Detectar saludos simples
    const saludosSimples = ['hola', 'hi', 'hello', 'buenos días', 'buenas tardes', 'buenas noches', 'hey'];
    const esSaludoSimple = saludosSimples.includes(query.toLowerCase().trim());
    
    // Verificar si hay una conversación activa de ticket o reserva
    try {
        const contact = await message.getContact();
        
        // Verificar conversación de reserva primero
        const horariosModule = require('./horarios.command');
        const reservaConversation = horariosModule.conversations.get(contact.number);
        
        if (reservaConversation && reservaConversation.step && reservaConversation.step !== 'none') {
            logger.info(`Active reservation conversation detected for ${contact.number}`);
            const { run: runHorarios } = await import('./horarios.command');
            await runHorarios(message, args, userI18n);
            return;
        }
        
        // Verificar conversación de ticket
        const ticketModule = require('./ticket.command');
        const userConversation = ticketModule.conversations.get(contact.number);
        
        // Si hay conversación activa, NO enviar mensajes del menú
        if (userConversation && userConversation.step && userConversation.step !== 'none') {
            logger.info(`Active conversation detected for ${contact.number}, skipping welcome message`);
            return; // No responder nada, dejar que el ticket.command maneje
        }
    } catch (error) {
        logger.error('Error checking active conversation:', error);
    }
    
    // Respuestas directas del menú (check these first!)
    const cleanQuery = query.trim().toLowerCase();
    
    // Detectar intención de consultar horarios/reuniones ANTES de reservas
    const consultaHorariosKeywords = [
        'ver horarios', 'horarios de', 'horarios para', 'que reuniones', 
        'qué reuniones', 'reuniones habran', 'reuniones habrán', 'hay reuniones',
        'consultar horarios', 'ver reuniones', 'listar horarios', 'mostrar horarios',
        'agenda', 'agenda de', 'calendario', 'eventos'
    ];
    
    const esConsultaHorarios = consultaHorariosKeywords.some(keyword => cleanQuery.includes(keyword)) ||
        cleanQuery.match(/(que|qué|cuáles|cuales)\s+(reuniones|eventos|horarios)/i) ||
        cleanQuery.match(/ver\s+horarios/i) ||
        cleanQuery.match(/habrán|habran|habrá|habra/i);
    
    if (esConsultaHorarios) {
        logger.info(`Horarios query intent detected: ${cleanQuery}`);
        const { run: runHorarios } = await import('./horarios.command');
        await runHorarios(message, args, userI18n);
        return;
    }
    
    // Detectar intención de reserva de sala
    const reservaKeywords = [
        'reservar', 'reserva', 'sala de conferencias', 'sala conferencias', 
        'sala', 'conferencia', 'conferencias', 'reunión', 'reunion', 'meeting',
        'quiero reservar', 'gustaría reservar', 'gustaria reservar', 'necesito reservar',
        'disponible la sala', 'horario disponible', 'agendar', 'agenda'
    ];
    
    const esReserva = reservaKeywords.some(keyword => cleanQuery.includes(keyword));
    
    if (esReserva) {
        logger.info(`Reservation intent detected: ${cleanQuery}`);
        const { run: runHorarios } = await import('./horarios.command');
        await runHorarios(message, args, userI18n);
        return;
    }
    
    // Detectar si el usuario es Levi (Super Admin) para comandos administrativos
    try {
        const contact = await message.getContact();
        const { ContactModel } = await import('../crm/models/contact.model');
        const contactDoc = await ContactModel.findOne({ phoneNumber: contact.number });
        const isLevi = contactDoc?.role === 'levi' || contactDoc?.role === 'super_admin';
        
        if (isLevi) {
            const adminKeywords = [
                'enviar mensaje', 'mandar mensaje', 'mensaje a',
                'redireccionar', 'redirigir', 'reenviar',
                'pausar usuario', 'reanudar usuario', 'activar usuario',
                'usuarios', 'lista usuarios', 'ver usuarios',
                'estadisticas', 'estadísticas', 'stats',
                'admin', 'administración'
            ];
            
            const esAdminRequest = adminKeywords.some(keyword => cleanQuery.includes(keyword));
            
            if (esAdminRequest || cleanQuery.startsWith('!admin')) {
                logger.info(`Admin command intent detected: ${cleanQuery}`);
                const { run: runAdmin } = await import('./admin.command');
                await runAdmin(message, args, userI18n);
                return;
            }
        }
    } catch (error) {
        // Ignorar errores de detección
    }
    
    // Detectar si el usuario es RH (Karina/Nubia) para solicitudes de usuarios
    try {
        const contact = await message.getContact();
        const { getBossInfo } = await import('../utils/report-generator.util');
        const bossInfo = getBossInfo(contact.number);
        const isRH = bossInfo?.role === 'rh_karina' || bossInfo?.role === 'rh_nubia';
        
        if (isRH) {
            const rhKeywords = [
                'alta', 'baja', 'crear usuario', 'eliminar usuario',
                'dar de alta', 'dar de baja', 'agregar usuario', 'quitar usuario',
                'solicitud', 'solicitudes', 'ver solicitudes', 'mis solicitudes',
                'usuario cajero', 'usuario líder', 'usuario cocina'
            ];
            
            const esRHRequest = rhKeywords.some(keyword => cleanQuery.includes(keyword));
            
            if (esRHRequest) {
                logger.info(`RH request intent detected: ${cleanQuery}`);
                const { run: runRH } = await import('./rh.command');
                await runRH(message, args, userI18n);
                return;
            }
        }
    } catch (error) {
        // Ignorar errores de detección
    }
    
    // Detectar si el usuario es un jefe (Salma/Francisco) para mostrar menú personalizado
    let isBossUser = false;
    let bossUserName = '';
    let bossUserRole = 'user';
    
    try {
        const contact = await message.getContact();
        const { getBossInfo } = await import('../utils/report-generator.util');
        const bossInfo = getBossInfo(contact.number);
        if (bossInfo) {
            isBossUser = true;
            bossUserName = bossInfo.name;
            bossUserRole = bossInfo.role;
        }
    } catch (error) {
        // Ignorar errores de detección
    }
    
    // Si es jefe y selecciona una opción del menú personalizado
    if (isBossUser && bossUserName) {
        if (cleanQuery === '1' || cleanQuery === '1️⃣' || cleanQuery === 'proyectos curso' || cleanQuery === 'proyectos activos' || cleanQuery === 'proyectos') {
            const { run: runProyectos } = await import('./proyectos.command');
            await runProyectos(message, ['list'], userI18n);
            return;
        }
        
        if (cleanQuery === '2' || cleanQuery === '2️⃣' || cleanQuery === 'proyectos futuros' || cleanQuery === 'futuros') {
            await mostrarProyectosFuturos(message);
            return;
        }
        
        if (cleanQuery === '3' || cleanQuery === '3️⃣' || cleanQuery === 'tareas activas' || cleanQuery === 'tareas') {
            await mostrarTareasActivas(message);
            return;
        }
        
        if (cleanQuery === '4' || cleanQuery === '4️⃣' || cleanQuery === 'estadísticas' || cleanQuery === 'estadisticas') {
            await mostrarEstadisticasProyectos(message);
            return;
        }
        
        if (cleanQuery === '5' || cleanQuery === '5️⃣' || cleanQuery === 'reporte semanal' || cleanQuery === 'reporte') {
            await mostrarReporteSemanal(message);
            return;
        }
        
        if (cleanQuery === '6' || cleanQuery === '6️⃣' || cleanQuery === 'métricas' || cleanQuery === 'metricas') {
            await mostrarMetricasIT(message);
            return;
        }
        
        if (cleanQuery === '7' || cleanQuery === '7️⃣' || cleanQuery === 'tickets' || cleanQuery === 'tickets abiertos') {
            const { run: runTicket } = await import('./ticket.command');
            await runTicket(message, ['list'], userI18n);
            return;
        }
        
        if (cleanQuery === '8' || cleanQuery === '8️⃣' || cleanQuery === 'reservas' || cleanQuery === 'horarios') {
            const { run: runHorarios } = await import('./horarios.command');
            await runHorarios(message, ['consultar'], userI18n);
            return;
        }
        
        if (cleanQuery === '9' || cleanQuery === '9️⃣' || cleanQuery === 'reportes programados') {
            await mostrarReportesProgramados(message);
            return;
        }
        
        if (cleanQuery === '0' || cleanQuery === '0️⃣' || cleanQuery === 'ayuda' || cleanQuery === 'help') {
            await mostrarAyudaJefe(message, bossUserName, bossUserRole);
            return;
        }
    }
    
    // Opciones de menú por número (para usuarios normales)
    if (cleanQuery === '1' || cleanQuery === '1️⃣' || cleanQuery === 'ticket' || cleanQuery === 'crear ticket' || cleanQuery === 'crear' || cleanQuery === 'nuevo') {
        // Start ticket conversation
        const { run: runTicket } = await import('./ticket.command');
        await runTicket(message, ['create'], userI18n);
        return;
    }
    
    if (cleanQuery === '2' || cleanQuery === '2️⃣' || cleanQuery === 'mis tickets' || cleanQuery === 'ver tickets' || cleanQuery === 'lista') {
        const { run: runTicket } = await import('./ticket.command');
        await runTicket(message, ['list'], userI18n);
        return;
    }
    
    if (cleanQuery === '3' || cleanQuery === '3️⃣' || cleanQuery === 'estado' || cleanQuery === 'consultar') {
        await message.reply(`📊 Para consultar el estado de un ticket, escribe:\n\`!ticket status TKT-000001\`\n\nO usa: \`!ticket view TKT-000001\` para ver detalles completos.`);
        return;
    }
    
    if (cleanQuery === '4' || cleanQuery === '4️⃣' || cleanQuery === 'comentario' || cleanQuery === 'comentar') {
        await message.reply(`💬 Para agregar un comentario a un ticket, escribe:\n\`!ticket comment TKT-000001 tu mensaje aquí\`\n\nEjemplo:\n\`!ticket comment TKT-000001 Ya revisé y sigue con el problema\``);
        return;
    }
    
    if (cleanQuery === '5' || cleanQuery === '5️⃣' || cleanQuery === 'hablar' || cleanQuery === 'contactar' || cleanQuery === 'agente' || cleanQuery === 'humano') {
        await message.reply(
            `📞 *Contactar al Equipo IT de San Cosme Orgánico*\n\n` +
            `Para contactar directamente con el equipo de IT:\n\n` +
            `📧 *Correo:*\n` +
            `sistemasit@sancosmeorg.com\n\n` +
            `📱 *Teléfono:*\n` +
            `+52 442 282 3539\n\n` +
            `⏰ *Horario de Soporte:*\n` +
            `Lunes a Viernes: 9:00 AM - 5:00 PM\n\n` +
            `💡 *O crea un ticket urgente:*\n` +
            `Escribe: \`!ticket\` o \`1\` y selecciona prioridad URGENTE\n\n` +
            `_Para emergencias fuera de horario, crea un ticket urgente y será atendido lo antes posible._`
        );
        return;
    }
    
    if (cleanQuery === '6' || cleanQuery === '6️⃣' || cleanQuery === 'servicios' || cleanQuery === 'información') {
        await message.reply(
            `🔧 *Servicios IT Disponibles - San Cosme Orgánico*\n\n` +
            `💻 **Hardware**\n` +
            `Reparación y mantenimiento de equipos, impresoras, computadoras\n\n` +
            `📱 **Software**\n` +
            `Instalación, actualización y soporte de programas\n\n` +
            `🌐 **Network**\n` +
            `Configuración de internet, WiFi, redes\n\n` +
            `🔒 **Security**\n` +
            `Gestión de accesos, contraseñas, permisos\n\n` +
            `📧 **Microsoft 365**\n` +
            `Correo, Teams, OneDrive, SharePoint\n\n` +
            `💳 **POS**\n` +
            `Sistema punto de venta Oracle POS\n\n` +
            `💾 **Backup**\n` +
            `Copias de seguridad y recuperación\n\n` +
            `📋 **Otros**\n` +
            `Cualquier otro problema IT\n\n` +
            `*Crear ticket:* \`1\` o \`!ticket\``
        );
        return;
    }
    
    if (cleanQuery === '7' || cleanQuery === '7️⃣' || cleanQuery === 'ayuda' || cleanQuery === 'help' || cleanQuery === 'comandos') {
        await message.reply(
            `❓ *Comandos Disponibles*\n\n` +
            `📝 **Crear Ticket:**\n` +
            `\`!ticket\` o \`1\`\n\n` +
            `📋 **Ver Mis Tickets:**\n` +
            `\`!ticket list\` o \`2\`\n\n` +
            `👁️ **Ver Detalles:**\n` +
            `\`!ticket view TKT-000001\` o \`3\`\n\n` +
            `💬 **Agregar Comentario:**\n` +
            `\`!ticket comment TKT-000001 mensaje\` o \`4\`\n\n` +
            `📞 **Contactar IT:**\n` +
            `\`5\`\n\n` +
            `ℹ️ **Información:**\n` +
            `\`6\` - Servicios IT\n` +
            `\`7\` - Esta ayuda\n\n` +
            `⏸️ **Control Bot:**\n` +
            `\`!stop\` - Pausar el bot\n` +
            `\`!start\` - Reanudar el bot\n\n` +
            `❌ **Cancelar:**\n` +
            `\`cancel\``
        );
        return;
    }
    
    // Detectar si el mensaje es sobre IT y redirigir automáticamente
    if (query && isITRelated(query)) {
        await message.reply(
            `🔧 Detecté que necesitas soporte técnico.\n\n` +
            `Voy a iniciar el asistente para crear tu ticket.\n\n` +
            `Responde las siguientes preguntas:`
        );
        // Automatically start ticket creation
        const { run: runTicket } = await import('./ticket.command');
        await runTicket(message, ['create'], userI18n);
        return;
    }
    
    // Si no es sobre IT, responder como bot IT general (solo si no es saludo simple)
    if (query && !esSaludoSimple) {
        await message.reply(
            `🔧 *Soporte IT - San Cosme Orgánico*\n\n` +
            `Para crear un ticket de soporte técnico, simplemente escribe:\n\n` +
            `\`ticket\` o \`!ticket\`\n\n` +
            `O describe tu problema:\n` +
            `• "La impresora no funciona"\n` +
            `• "No puedo acceder al correo"\n` +
            `• "El POS se cayó"\n\n` +
            `Escribe \`!help\` para ver todos los comandos.`
        );
        return;
    }

    if ((!query || esSaludoSimple) && message.type !== MessageTypes.VOICE) {
        // Get user role for personalized greeting
        let userRole = 'user';
        let userName = '';
        let isBoss = false;
        let bossName = '';
        
        try {
            const contact = await message.getContact();
            const ContactModel = require('../crm/models/contact.model').ContactModel;
            
            // Verificar si es Salma o Francisco usando variables de entorno
            const { getBossInfo } = await import('../utils/report-generator.util');
            const bossInfo = getBossInfo(contact.number);
            
            if (bossInfo) {
                isBoss = true;
                bossName = bossInfo.name;
                userRole = bossInfo.role; // Usar el rol configurado (boss, ceo, admin)
                // Asignar automáticamente el rol y nombre en la base de datos
                await ContactModel.findOneAndUpdate(
                    { phoneNumber: contact.number },
                    { 
                        $set: { 
                            role: bossInfo.role,
                            name: bossInfo.name 
                        } 
                    },
                    { upsert: true, new: true }
                );
                userName = bossInfo.name;
            }
            
            const dbContact = await ContactModel.findOne({ phoneNumber: contact.number });
            if (dbContact && !bossName) {
                userRole = dbContact.role || userRole;
                userName = dbContact.name || dbContact.pushName || userName;
            } else if (!userName) {
                userName = contact.name || contact.pushname || '';
            }
        } catch (error) {
            logger.error('Error getting contact role:', error);
        }
        
        // Personalized greetings based on role
        let greeting = '👋 ¡Hola!';
        let welcomeMsg = '¡Bienvenido al Sistema de Soporte IT de San Cosme Orgánico! 🤩';
        
        // Presentación personalizada para Salma y Francisco con menú personalizado
        if (isBoss && bossName) {
            greeting = `👋 ¡Hola ${bossName}!`;
            welcomeMsg = `Soy el asistente virtual de IT de San Cosme Orgánico. 🤖\n\nComo ${userRole === 'ceo' ? 'CEO' : userRole === 'admin' ? 'Administrador' : 'Directivo'}, tienes acceso completo al sistema.\n\n`;
            
            const menuPersonalizado = `
🔧 *¿En qué puedo ayudarte? Selecciona un número:*

📊 *PROYECTOS Y TAREAS:*
1️⃣ Ver proyectos en curso
2️⃣ Ver proyectos futuros/planificados
3️⃣ Ver todas las tareas activas
4️⃣ Ver estadísticas de proyectos

📈 *REPORTES Y MÉTRICAS:*
5️⃣ Ver reporte semanal
6️⃣ Ver métricas IT generales
7️⃣ Ver tickets abiertos

📅 *GESTIÓN:*
8️⃣ Consultar reservas de sala
9️⃣ Ver reportes programados

ℹ️ *INFORMACIÓN:*
0️⃣ Ayuda y comandos disponibles

*O escribe directamente:*
• "proyectos" - Ver proyectos
• "tareas" - Ver tareas
• "reporte" - Ver reportes
• "estadísticas" - Ver métricas`;

            await message.reply(
                `${greeting}\n\n${welcomeMsg}${menuPersonalizado}`
            );
            return;
        }
        
        if (userRole === 'ceo') {
            greeting = '👔 Buenos días, estimado';
            welcomeMsg = '¡Bienvenido al Sistema de Soporte IT! 🤩\n\nComo CEO, tiene acceso prioritario a nuestros servicios.';
        } else if (userRole === 'boss') {
            greeting = '🤝 Hola';
            welcomeMsg = '¡Bienvenido al Sistema de Soporte IT! 🤩\n\nComo directivo, tiene acceso preferencial.';
        } else {
            greeting = '👋 ¡Hola';
            welcomeMsg = '¡Bienvenido al Sistema de Soporte IT de San Cosme Orgánico! 🤩';
        }
        
        if (userName) {
            greeting = `${greeting} ${userName.split(' ')[0]}`;
        }
        
        const opcionesIniciales = `
${greeting}!

${welcomeMsg}

🔧 *¿En qué puedo ayudarte? Selecciona un número:*

*Sistema de Tickets:*
1️⃣ Crear nuevo ticket de soporte
2️⃣ Ver mis tickets
3️⃣ Consultar estado de un ticket
4️⃣ Agregar comentario a ticket

*Contacto Directo:*
5️⃣ Hablar con el equipo de IT

*Información:*
6️⃣ Ver servicios IT disponibles
7️⃣ Ayuda y comandos

*Responde solo con el número (ejemplo: 1) o escribe tu solicitud directa.*

Escribe \`cancel\` para salir.`;
        
        chat.sendMessage(AppConfig.instance.printMessage(opcionesIniciales));
        return;
    }

    if (message.type === MessageTypes.VOICE) {

        const audioPath = `${AppConfig.instance.getDownloadDir()}/${message.id.id}.wav`;
        const media = await message.downloadMedia();

        const base64 = media.data;
        const fileBuffer = Buffer.from(base64, 'base64');

        const dir = path.dirname(audioPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFile(audioPath, fileBuffer, (err) => {
            if (err) {
                logger.error(`Error saving file: ${err}`);
            } else {
                logger.info(`File saved successfully to ${audioPath}`);
            }
        });

        const transcript = await speechToText(audioPath);
        del_file(audioPath);
        query = transcript.text;

        if (!query || !query.length) {
            await message.reply(
                MessageMedia.fromFilePath(AppConfig.instance.getBotAvatar("confused")),
                null,
                { sendVideoAsGif: true, caption: AppConfig.instance.printMessage("Something went wrong. Please try again later.") },
            );
            return;
        }
    }

    try {
        const result = await aiCompletion(query);
        const chatReply = result.text;
        const provider = result.provider;

        // Detectar intención y hacer seguimiento de ventas
        const intent = SalesTracker.detectIntent(query);
        SalesTracker.trackInteraction(message, query, chatReply, intent);
        
        // Log del proveedor usado
        logger.info(`Respuesta generada por: ${provider}`);

        if (message.type === MessageTypes.VOICE) {
            if (!chat) await chat.sendStateRecording();

            try {
                const filePath = await textToSpeech(chatReply, `${message.id.id}.wav`);
                const voice = await MessageMedia.fromFilePath(filePath);
                await message.reply(voice, null, { sendAudioAsVoice: true });
                del_file(filePath);
                return;
            } catch (error) {
                logger.error(error);
                if (chat) chat.clearState().then(() => {
                    // wait for 1.5 seconds before sending typing to avoid ban :)
                    setTimeout(() => {
                        chat.sendStateTyping();
                    }, 1500);
                });
                if (chat) await chat.sendStateTyping();
                message.reply(AppConfig.instance.printMessage(`${chatReply}\n\n_Sorry btw but i was unable to send this as voice._`));
                return;
            }
        }

        // Determinar qué imagen enviar según la intención detectada
        let mediaPath: string;

        switch (intent) {
            case 'price':
                mediaPath = "public/precio.png";
                break;
            case 'payment':
                mediaPath = "public/pago.png";
                break;
            case 'info':
            case 'product':
                mediaPath = "public/info.png";
                break;
            default:
                // Para otras consultas, usar imagen de información por defecto
                mediaPath = "public/info.png";
                break;
        }

        // Delay de 10 segundos para simular tiempo de respuesta humano
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        const media = MessageMedia.fromFilePath(mediaPath);
        await message.reply(
            media,
            null,
            { 
                caption: AppConfig.instance.printMessage(chatReply) 
            },
        );

    } catch (err) {
        logger.error(err);
        
        // Manejar errores específicos de APIs de IA
        let errorMessage = "Error comunicándose con WhatsBot IT. Por favor intenta de nuevo o contacta a nuestro equipo de soporte.";
        
        if (err.message && (err.message.includes("503 Service Unavailable") || err.message.includes("Todas las APIs de IA están temporalmente no disponibles"))) {
            errorMessage = "Los servicios de IA están temporalmente sobrecargados. Por favor intenta de nuevo en unos minutos. Mientras tanto, puedes usar los comandos específicos:\n\n*Comandos disponibles:*\n💰 *precios* - Información de precios\n💳 *pago* - Métodos de pago\n📦 *productos* - Información del producto\n\n¡Gracias por tu paciencia! 😊";
        }
        
        // Delay de 10 segundos para simular tiempo de respuesta humano
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        await message.reply(
            MessageMedia.fromFilePath("public/info.png"),
            null,
            { caption: AppConfig.instance.printMessage(errorMessage) },
        );
        return;
    }
};

// Funciones helper para jefes (Salma/Francisco)
async function mostrarProyectosFuturos(message: Message) {
    try {
        const { ProjectModel } = await import('../crm/models/project.model');
        const proyectos = await ProjectModel.find({ 
            status: { $in: ['planned'] },
            startDate: { $gte: new Date() }
        }).sort({ startDate: 1 }).limit(10).lean();

        if (proyectos.length === 0) {
            await message.reply(`📋 No hay proyectos futuros planificados.`);
            return;
        }

        let lista = `🔮 *Proyectos Futuros/Planificados*\n\n`;
        proyectos.forEach((p: any) => {
            lista += `📋 *${p.name}*\n`;
            if (p.description) lista += `   ${p.description.substring(0, 50)}${p.description.length > 50 ? '...' : ''}\n`;
            if (p.startDate) {
                const fecha = new Date(p.startDate).toLocaleDateString('es-MX');
                lista += `   📅 Inicio: ${fecha}\n`;
            }
            if (p.endDate) {
                const fecha = new Date(p.endDate).toLocaleDateString('es-MX');
                lista += `   🏁 Fin: ${fecha}\n`;
            }
            lista += `   📊 Progreso: ${p.progress || 0}% | Prioridad: ${p.priority || 'media'}\n\n`;
        });

        await message.reply(lista);
    } catch (error: any) {
        logger.error('Error mostrando proyectos futuros:', error);
        await message.reply(`❌ Error al obtener proyectos futuros: ${error.message}`);
    }
}

async function mostrarTareasActivas(message: Message) {
    try {
        const { TaskModel } = await import('../crm/models/task.model');
        const tareas = await TaskModel.find({
            status: { $in: ['todo', 'doing'] }
        }).populate('projectId', 'name').sort({ updatedAt: -1 }).limit(15).lean();

        if (tareas.length === 0) {
            await message.reply(`✅ No hay tareas activas en este momento.`);
            return;
        }

        let lista = `📋 *Tareas Activas*\n\n`;
        tareas.forEach((t: any) => {
            const statusEmoji = t.status === 'doing' ? '🚀' : '📋';
            lista += `${statusEmoji} *${t.name}*\n`;
            if (t.projectId && (t.projectId as any).name) {
                lista += `   Proyecto: ${(t.projectId as any).name}\n`;
            }
            lista += `   Progreso: ${t.progress || 0}% | Status: ${t.status}\n`;
            if (t.endDate) {
                const fecha = new Date(t.endDate).toLocaleDateString('es-MX');
                lista += `   📅 Fin: ${fecha}\n`;
            }
            lista += `\n`;
        });

        await message.reply(lista);
    } catch (error: any) {
        logger.error('Error mostrando tareas activas:', error);
        await message.reply(`❌ Error al obtener tareas activas: ${error.message}`);
    }
}

async function mostrarEstadisticasProyectos(message: Message) {
    try {
        const { ProjectModel } = await import('../crm/models/project.model');
        const { TaskModel } = await import('../crm/models/task.model');
        
        const proyectos = await ProjectModel.find({}).lean();
        const tareas = await TaskModel.find({}).lean();
        
        const proyectosActivos = proyectos.filter((p: any) => p.status === 'in_progress').length;
        const proyectosPlanificados = proyectos.filter((p: any) => p.status === 'planned').length;
        const proyectosPausados = proyectos.filter((p: any) => p.status === 'paused').length;
        const proyectosCompletados = proyectos.filter((p: any) => p.status === 'done').length;
        
        let progresoTotal = 0;
        let proyectosConProgreso = 0;
        proyectos.forEach((p: any) => {
            if (p.progress !== undefined && p.progress !== null) {
                progresoTotal += p.progress;
                proyectosConProgreso++;
            }
        });
        const progresoPromedio = proyectosConProgreso > 0 ? Math.round(progresoTotal / proyectosConProgreso) : 0;
        
        const tareasCompletadas = tareas.filter((t: any) => t.status === 'done').length;
        const tareasEnProgreso = tareas.filter((t: any) => t.status === 'doing').length;
        const tareasPorHacer = tareas.filter((t: any) => t.status === 'todo').length;
        
        let progresoTareas = 0;
        let tareasConProgreso = 0;
        tareas.forEach((t: any) => {
            if (t.progress !== undefined && t.progress !== null) {
                progresoTareas += t.progress;
                tareasConProgreso++;
            }
        });
        const progresoTareasPromedio = tareasConProgreso > 0 ? Math.round(progresoTareas / tareasConProgreso) : 0;
        
        const estadisticas = `📊 *ESTADÍSTICAS DE PROYECTOS Y TAREAS*\n\n` +
            `🚀 *PROYECTOS*\n` +
            `• Total: ${proyectos.length}\n` +
            `• En curso: ${proyectosActivos}\n` +
            `• Planificados: ${proyectosPlanificados}\n` +
            `• Pausados: ${proyectosPausados}\n` +
            `• Completados: ${proyectosCompletados}\n` +
            `• Progreso promedio: ${progresoPromedio}%\n\n` +
            `📋 *TAREAS*\n` +
            `• Total: ${tareas.length}\n` +
            `• Por hacer: ${tareasPorHacer}\n` +
            `• En progreso: ${tareasEnProgreso}\n` +
            `• Completadas: ${tareasCompletadas}\n` +
            `• Progreso promedio: ${progresoTareasPromedio}%`;
        
        await message.reply(estadisticas);
    } catch (error: any) {
        logger.error('Error mostrando estadísticas:', error);
        await message.reply(`❌ Error al obtener estadísticas: ${error.message}`);
    }
}

async function mostrarReporteSemanal(message: Message) {
    try {
        await message.reply(`📊 Generando reporte semanal...`);
        
        // Obtener fecha de inicio de semana (lunes)
        const hoy = new Date();
        const diaSemana = hoy.getDay();
        const diasDesdeLunes = diaSemana === 0 ? 6 : diaSemana - 1;
        const inicioSemana = new Date(hoy);
        inicioSemana.setDate(hoy.getDate() - diasDesdeLunes);
        inicioSemana.setHours(0, 0, 0, 0);
        
        const finSemana = new Date(inicioSemana);
        finSemana.setDate(inicioSemana.getDate() + 6);
        finSemana.setHours(23, 59, 59, 999);
        
        // Generar reporte usando el generador
        const { generateReport } = await import('../utils/report-generator.util');
        
        // Crear configuración temporal para el reporte
        const reporteConfig = {
            reportType: 'full' as const,
            dateRange: {
                startDate: inicioSemana,
                endDate: finSemana
            },
            includeMetrics: true,
            filters: {},
            name: 'Reporte Semanal',
            recipients: { phoneNumbers: [] }
        };
        
        const reporte = await generateReport(reporteConfig as any, (await message.getContact()).number);
        await message.reply(reporte);
    } catch (error: any) {
        logger.error('Error mostrando reporte semanal:', error);
        await message.reply(`❌ Error al generar reporte semanal: ${error.message}`);
    }
}

async function mostrarMetricasIT(message: Message) {
    try {
        const { TicketModel } = await import('../crm/models/ticket.model');
        
        const ticketsAbiertos = await TicketModel.countDocuments({ status: 'open' });
        const ticketsResueltos = await TicketModel.countDocuments({ status: 'resolved' });
        const ticketsEnProgreso = await TicketModel.countDocuments({ status: 'in_progress' });
        
        const tickets = await TicketModel.find({}).lean();
        const ticketsPorCategoria: Record<string, number> = {};
        tickets.forEach((t: any) => {
            const categoria = t.category || 'other';
            ticketsPorCategoria[categoria] = (ticketsPorCategoria[categoria] || 0) + 1;
        });
        
        let metricas = `📈 *MÉTRICAS IT GENERALES*\n\n` +
            `🎫 *TICKETS*\n` +
            `• Abiertos: ${ticketsAbiertos}\n` +
            `• En progreso: ${ticketsEnProgreso}\n` +
            `• Resueltos: ${ticketsResueltos}\n` +
            `• Total: ${tickets.length}\n\n`;
        
        if (Object.keys(ticketsPorCategoria).length > 0) {
            metricas += `📊 *Por Categoría:*\n`;
            Object.entries(ticketsPorCategoria).forEach(([cat, count]) => {
                const emoji: Record<string, string> = {
                    'hardware': '💻',
                    'software': '📱',
                    'network': '🌐',
                    'security': '🔒',
                    'm365': '📧',
                    'pos': '💳',
                    'backup': '💾',
                    'other': '📋'
                };
                metricas += `${emoji[cat] || '📋'} ${cat}: ${count}\n`;
            });
        }
        
        await message.reply(metricas);
    } catch (error: any) {
        logger.error('Error mostrando métricas IT:', error);
        await message.reply(`❌ Error al obtener métricas: ${error.message}`);
    }
}

async function mostrarReportesProgramados(message: Message) {
    try {
        const { ScheduledReportModel } = await import('../crm/models/scheduled-report.model');
        const reportes = await ScheduledReportModel.find({ 'schedule.enabled': true })
            .sort({ createdAt: -1 }).limit(10).lean();
        
        if (reportes.length === 0) {
            await message.reply(`📋 No hay reportes programados activos.`);
            return;
        }
        
        let lista = `📅 *REPORTES PROGRAMADOS*\n\n`;
        reportes.forEach((r: any, index: number) => {
            lista += `${index + 1}. *${r.name}*\n`;
            if (r.description) lista += `   ${r.description}\n`;
            lista += `   Frecuencia: ${r.schedule.frequency === 'weekly' ? 'Semanal' : r.schedule.frequency === 'monthly' ? 'Mensual' : 'Una vez'}\n`;
            if (r.nextSendAt) {
                const fecha = new Date(r.nextSendAt).toLocaleDateString('es-MX', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                lista += `   Próximo envío: ${fecha}\n`;
            }
            lista += `   Destinatarios: ${r.recipients.phoneNumbers.length}\n\n`;
        });
        
        await message.reply(lista);
    } catch (error: any) {
        logger.error('Error mostrando reportes programados:', error);
        await message.reply(`❌ Error al obtener reportes programados: ${error.message}`);
    }
}

async function mostrarAyudaJefe(message: Message, bossName: string, role: string) {
    const ayuda = `ℹ️ *AYUDA Y COMANDOS DISPONIBLES - ${bossName.toUpperCase()}*\n\n` +
        `*Rol:* ${role === 'ceo' ? 'CEO' : role === 'admin' ? 'Administrador' : 'Directivo'}\n\n` +
        `📊 *MENÚ PRINCIPAL:*\n` +
        `1️⃣ Proyectos en curso\n` +
        `2️⃣ Proyectos futuros\n` +
        `3️⃣ Tareas activas\n` +
        `4️⃣ Estadísticas\n` +
        `5️⃣ Reporte semanal\n` +
        `6️⃣ Métricas IT\n` +
        `7️⃣ Tickets abiertos\n` +
        `8️⃣ Reservas de sala\n` +
        `9️⃣ Reportes programados\n` +
        `0️⃣ Esta ayuda\n\n` +
        `*COMANDOS DIRECTOS:*\n` +
        `• "proyectos" - Ver proyectos\n` +
        `• "tareas" - Ver tareas\n` +
        `• "reporte" - Reporte semanal\n` +
        `• "estadísticas" - Métricas generales\n` +
        `• "!proyectos actualizar [nombre] [%]" - Actualizar progreso\n` +
        `• "!horarios" - Gestionar reservas\n` +
        `• "!ticket" - Ver tickets`;
    
    await message.reply(ayuda);
}
