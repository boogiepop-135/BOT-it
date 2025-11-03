import { Message } from "whatsapp-web.js";
import { UserI18n } from "../utils/i18n.util";
import logger from "../configs/logger.config";
import { RequestModel } from "../crm/models/request.model";
import { getBossInfo } from "../utils/report-generator.util";

export interface RHConversation {
    step: 'tipo' | 'nombre' | 'rol' | 'plataforma' | 'confirmacion' | 'none';
    type?: 'alta' | 'baja';
    employeeName?: string;
    userRole?: string;
    platform?: string;
    notes?: string;
}

export const conversations = new Map<string, RHConversation>();

export const run = async (message: Message, args: string[] | null, userI18n: UserI18n) => {
    try {
        const contact = await message.getContact();
        const userNumber = contact.number;
        const textoMensaje = message.body.trim().toLowerCase();
        const argsArray = args || textoMensaje.split(' ');

        // Verificar si el usuario tiene rol de RH
        const bossInfo = getBossInfo(userNumber);
        const isRH = bossInfo?.role === 'rh_karina' || bossInfo?.role === 'rh_nubia';
        
        if (!isRH) {
            await message.reply(
                `❌ No tienes permiso para usar este comando.\n\n` +
                `Este comando está disponible solo para el equipo de Recursos Humanos.`
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
            await processRHConversation(message, conversation, userNumber);
            return;
        }

        // Detectar intención - crear solicitud de alta o baja
        if (textoMensaje.includes("alta") || textoMensaje.includes("crear usuario") || 
            textoMensaje.includes("dar de alta") || textoMensaje.includes("agregar usuario")) {
            await iniciarSolicitud(message, userNumber, 'alta');
            return;
        }

        if (textoMensaje.includes("baja") || textoMensaje.includes("eliminar usuario") ||
            textoMensaje.includes("dar de baja") || textoMensaje.includes("quitar usuario")) {
            await iniciarSolicitud(message, userNumber, 'baja');
            return;
        }

        if (textoMensaje.includes("ver") || textoMensaje.includes("listar") || 
            textoMensaje.includes("mis solicitudes") || textoMensaje.includes("solicitudes")) {
            await listarSolicitudes(message, userNumber);
            return;
        }

        // Si no se detecta intención, mostrar ayuda
        await message.reply(
            `👥 *Sistema de Solicitudes RH*\n\n` +
            `Puedo ayudarte a gestionar solicitudes de alta y baja de usuarios en plataformas externas.\n\n` +
            `*Comandos disponibles:*\n\n` +
            `➕ *DAR DE ALTA*\n` +
            `"dar de alta" o "crear usuario"\n` +
            `Te guiaré paso a paso para crear una solicitud de alta.\n\n` +
            `➖ *DAR DE BAJA*\n` +
            `"dar de baja" o "eliminar usuario"\n` +
            `Te guiaré paso a paso para crear una solicitud de baja.\n\n` +
            `📋 *VER SOLICITUDES*\n` +
            `"ver solicitudes" o "mis solicitudes"\n\n` +
            `_Escribe \`cancel\` en cualquier momento para cancelar._`
        );
    } catch (error) {
        logger.error("Error en rh.command:", error);
        await message.reply("❌ Ocurrió un error al procesar tu solicitud.");
    }
};

async function iniciarSolicitud(message: Message, userNumber: string, type: 'alta' | 'baja') {
    const conversation: RHConversation = {
        step: 'nombre',
        type: type
    };
    conversations.set(userNumber, conversation);

    const tipoTexto = type === 'alta' ? 'alta' : 'baja';
    const emoji = type === 'alta' ? '➕' : '➖';
    
    await message.reply(
        `${emoji} *Solicitud de ${tipoTexto.toUpperCase()} de Usuario*\n\n` +
        `Vamos a crear una solicitud para dar de ${tipoTexto} a un usuario en las plataformas externas.\n\n` +
        `📝 *Paso 1: Nombre del empleado*\n\n` +
        `¿Cuál es el nombre completo del empleado?`
    );
}

async function processRHConversation(message: Message, conversation: RHConversation, userNumber: string) {
    const texto = message.body.trim();

    switch (conversation.step) {
        case 'nombre':
            conversation.employeeName = texto;
            conversation.step = 'rol';
            
            await message.reply(
                `✅ Nombre registrado: *${texto}*\n\n` +
                `👤 *Paso 2: Tipo de Usuario*\n\n` +
                `¿Qué tipo de usuario es?\n\n` +
                `1️⃣ Cajero\n` +
                `2️⃣ Líder de Piso\n` +
                `3️⃣ Sub-líder de Piso\n` +
                `4️⃣ Cocina\n` +
                `5️⃣ Gerente\n` +
                `6️⃣ Supervisor\n` +
                `7️⃣ Otro\n\n` +
                `Responde con el número o el nombre del tipo.`
            );
            break;

        case 'rol':
            const rolesMap: Record<string, string> = {
                '1': 'cajero',
                '2': 'lider_piso',
                '3': 'sublider_piso',
                '4': 'cocina',
                '5': 'gerente',
                '6': 'supervisor',
                '7': 'otro',
                'cajero': 'cajero',
                'líder': 'lider_piso',
                'lider': 'lider_piso',
                'sublider': 'sublider_piso',
                'sub-líder': 'sublider_piso',
                'cocina': 'cocina',
                'gerente': 'gerente',
                'supervisor': 'supervisor',
                'otro': 'otro'
            };

            const rolSeleccionado = rolesMap[texto.toLowerCase()];
            if (!rolSeleccionado) {
                await message.reply(
                    `❌ Tipo de usuario no válido. Por favor, responde con un número (1-7) o el nombre del tipo.\n\n` +
                    `Opciones:\n` +
                    `1. Cajero\n` +
                    `2. Líder de Piso\n` +
                    `3. Sub-líder de Piso\n` +
                    `4. Cocina\n` +
                    `5. Gerente\n` +
                    `6. Supervisor\n` +
                    `7. Otro`
                );
                return;
            }

            conversation.userRole = rolSeleccionado;
            conversation.step = 'plataforma';
            
            const nombresRoles: Record<string, string> = {
                'cajero': 'Cajero',
                'lider_piso': 'Líder de Piso',
                'sublider_piso': 'Sub-líder de Piso',
                'cocina': 'Cocina',
                'gerente': 'Gerente',
                'supervisor': 'Supervisor',
                'otro': 'Otro'
            };

            await message.reply(
                `✅ Tipo de usuario: *${nombresRoles[rolSeleccionado]}*\n\n` +
                `💻 *Paso 3: Plataforma Externa*\n\n` +
                `¿En qué plataforma o sistema se debe ${conversation.type === 'alta' ? 'dar de alta' : 'dar de baja'} al usuario?\n\n` +
                `Ejemplos:\n` +
                `• POS Oracle\n` +
                `• Sistema de Ventas\n` +
                `• Punto de Venta\n` +
                `• Sistema de Inventario\n\n` +
                `Escribe el nombre de la plataforma:`
            );
            break;

        case 'plataforma':
            conversation.platform = texto;
            conversation.step = 'confirmacion';
            
            await message.reply(
                `✅ Plataforma: *${texto}*\n\n` +
                `📝 *Paso 4: Notas Adicionales (Opcional)*\n\n` +
                `¿Hay alguna información adicional que deba saber el equipo de IT?\n\n` +
                `Ejemplos:\n` +
                `• "Fecha de inicio: 15 de noviembre"\n` +
                `• "Acceso especial requerido"\n` +
                `• "Usuario temporal"\n\n` +
                `Escribe las notas o envía "sin notas" para continuar:`
            );
            break;

        case 'confirmacion':
            if (texto.toLowerCase() !== 'sin notas' && texto.trim() !== '') {
                conversation.notes = texto;
            }
            
            // Crear la solicitud
            await crearSolicitud(message, conversation, userNumber);
            break;
    }

    conversations.set(userNumber, conversation);
}

async function crearSolicitud(message: Message, conversation: RHConversation, userNumber: string) {
    try {
        const nombresRoles: Record<string, string> = {
            'cajero': 'Cajero',
            'lider_piso': 'Líder de Piso',
            'sublider_piso': 'Sub-líder de Piso',
            'cocina': 'Cocina',
            'gerente': 'Gerente',
            'supervisor': 'Supervisor',
            'otro': 'Otro'
        };

        const request = new RequestModel({
            type: conversation.type,
            entityType: 'usuario',
            entityName: conversation.employeeName,
            userRole: conversation.userRole,
            platform: conversation.platform,
            notes: conversation.notes,
            status: 'pending',
            requestedBy: userNumber
        });

        await request.save();

        conversations.delete(userNumber);

        const tipoTexto = conversation.type === 'alta' ? 'alta' : 'baja';
        const emoji = conversation.type === 'alta' ? '➕' : '➖';

        await message.reply(
            `${emoji} *¡Solicitud Creada Exitosamente!*\n\n` +
            `📋 *Resumen de la Solicitud:*\n\n` +
            `• *Tipo:* ${tipoTexto.toUpperCase()}\n` +
            `• *Empleado:* ${conversation.employeeName}\n` +
            `• *Rol:* ${nombresRoles[conversation.userRole || 'otro']}\n` +
            `• *Plataforma:* ${conversation.platform}\n` +
            `${conversation.notes ? `• *Notas:* ${conversation.notes}\n` : ''}` +
            `• *Estado:* Pendiente\n\n` +
            `✅ Tu solicitud ha sido registrada y el equipo de IT será notificado.\n\n` +
            `Puedes ver el estado de tus solicitudes escribiendo "ver solicitudes".`
        );
    } catch (error: any) {
        logger.error("Error creando solicitud RH:", error);
        await message.reply(
            `❌ Error al crear la solicitud: ${error.message || 'Error desconocido'}\n\n` +
            `Por favor, intenta de nuevo o contacta al equipo de IT.`
        );
    }
}

async function listarSolicitudes(message: Message, userNumber: string) {
    try {
        const solicitudes = await RequestModel.find({ requestedBy: userNumber })
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        if (solicitudes.length === 0) {
            await message.reply(
                `📋 No tienes solicitudes registradas.\n\n` +
                `Puedes crear una nueva escribiendo:\n` +
                `• "dar de alta" para crear solicitud de alta\n` +
                `• "dar de baja" para crear solicitud de baja`
            );
            return;
        }

        const nombresRoles: Record<string, string> = {
            'cajero': 'Cajero',
            'lider_piso': 'Líder de Piso',
            'sublider_piso': 'Sub-líder de Piso',
            'cocina': 'Cocina',
            'gerente': 'Gerente',
            'supervisor': 'Supervisor',
            'otro': 'Otro'
        };

        const estadosEmoji: Record<string, string> = {
            'pending': '⏳',
            'in_progress': '🔄',
            'completed': '✅',
            'cancelled': '❌'
        };

        const estadosNombre: Record<string, string> = {
            'pending': 'Pendiente',
            'in_progress': 'En Progreso',
            'completed': 'Completada',
            'cancelled': 'Cancelada'
        };

        let lista = `📋 *Tus Solicitudes de Usuario*\n\n`;

        solicitudes.forEach((req: any, index: number) => {
            const emoji = req.type === 'alta' ? '➕' : '➖';
            const fecha = new Date(req.createdAt).toLocaleDateString('es-MX');
            
            lista += `${emoji} *Solicitud ${index + 1}*\n`;
            lista += `• Tipo: ${req.type === 'alta' ? 'Alta' : 'Baja'}\n`;
            lista += `• Empleado: ${req.entityName}\n`;
            if (req.userRole) {
                lista += `• Rol: ${nombresRoles[req.userRole] || req.userRole}\n`;
            }
            if (req.platform) {
                lista += `• Plataforma: ${req.platform}\n`;
            }
            lista += `• Estado: ${estadosEmoji[req.status] || '📋'} ${estadosNombre[req.status] || req.status}\n`;
            lista += `• Fecha: ${fecha}\n`;
            if (req.completionNotes) {
                lista += `• Notas IT: ${req.completionNotes}\n`;
            }
            lista += `\n`;
        });

        await message.reply(lista);
    } catch (error: any) {
        logger.error("Error listando solicitudes RH:", error);
        await message.reply(`❌ Error al obtener solicitudes: ${error.message || 'Error desconocido'}`);
    }
}

