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
    
    // Detectar intención de reserva de sala ANTES de las otras opciones
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
    
    // Opciones de menú por número
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
        try {
            const contact = await message.getContact();
            const dbContact = await require('../crm/models/contact.model').ContactModel.findOne({ phoneNumber: contact.number });
            if (dbContact) {
                userRole = dbContact.role || 'user';
                userName = dbContact.name || dbContact.pushName || '';
            }
        } catch (error) {
            logger.error('Error getting contact role:', error);
        }
        
        // Personalized greetings based on role
        let greeting = '👋 ¡Hola!';
        let welcomeMsg = '¡Bienvenido al Sistema de Soporte IT de San Cosme Orgánico! 🤩';
        
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
