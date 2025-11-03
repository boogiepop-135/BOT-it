import { BotManager } from '../bot.manager';
import logger from '../configs/logger.config';
import { ContactRole } from '../crm/models/contact.model';

/**
 * Obtener nombre del rol en español
 */
export function getRoleDisplayName(role: ContactRole): string {
    const roleNames: Record<ContactRole, string> = {
        'user': 'Usuario',
        'salma': 'Salma',
        'francisco': 'Francisco',
        'rh_karina': 'RH Karina',
        'rh_nubia': 'RH Nubia',
        'desarrollo_estrategia_inrra': 'Desarrollo y Estrategia Inrra',
        'boss': 'Jefe',
        'ceo': 'CEO',
        'admin': 'Administrador',
        'levi': 'Levi Villarreal',
        'super_admin': 'Super Administrador'
    };
    
    return roleNames[role] || role;
}

/**
 * Obtener descripción del rol para el mensaje de confirmación
 */
export function getRoleDescription(role: ContactRole): string {
    const descriptions: Record<ContactRole, string> = {
        'user': 'usuario estándar del sistema',
        'salma': 'Salma - Directiva',
        'francisco': 'Francisco - Directivo',
        'rh_karina': 'Recursos Humanos - Karina',
        'rh_nubia': 'Recursos Humanos - Nubia',
        'desarrollo_estrategia_inrra': 'Desarrollo y Estrategia - Inrra',
        'boss': 'Jefe - Acceso ejecutivo',
        'ceo': 'CEO - Acceso completo',
        'admin': 'Administrador - Acceso total',
        'levi': 'Levi Villarreal - Super Administrador - Acceso total y privilegios administrativos completos',
        'super_admin': 'Super Administrador - Acceso total y privilegios administrativos completos'
    };
    
    return descriptions[role] || 'usuario del sistema';
}

/**
 * Generar mensaje personalizado de asignación de rol
 */
export function generateRoleAssignmentMessage(role: ContactRole, userName: string): string {
    const roleName = getRoleDisplayName(role);
    const roleDescription = getRoleDescription(role);
    
    let message = `✅ *Asignación de Rol Confirmada*\n\n`;
    message += `Hola ${userName},\n\n`;
    message += `Se te ha asignado el rol de *${roleName}* en el Sistema de Soporte IT de San Cosme Orgánico.\n\n`;
    
    // Mensajes personalizados según el rol
    switch (role) {
        case 'salma':
            message += `👋 *¡Bienvenida Salma!*\n\n`;
            message += `Como directiva, tienes acceso completo al sistema con privilegios ejecutivos.\n\n`;
            message += `Puedes:\n`;
            message += `📊 Ver proyectos y tareas en curso\n`;
            message += `📈 Consultar reportes y estadísticas\n`;
            message += `🎫 Gestionar tickets IT\n`;
            message += `📅 Consultar reservas de sala\n`;
            break;
            
        case 'francisco':
            message += `👋 *¡Bienvenido Francisco!*\n\n`;
            message += `Como directivo, tienes acceso completo al sistema con privilegios ejecutivos.\n\n`;
            message += `Puedes:\n`;
            message += `📊 Ver proyectos y tareas en curso\n`;
            message += `📈 Consultar reportes y estadísticas\n`;
            message += `🎫 Gestionar tickets IT\n`;
            message += `📅 Consultar reservas de sala\n`;
            break;
            
        case 'rh_karina':
            message += `👋 *¡Bienvenida Karina!*\n\n`;
            message += `Como parte del equipo de Recursos Humanos, tienes acceso especializado para gestionar información relacionada con RRHH.\n\n`;
            message += `Puedes:\n`;
            message += `👥 Consultar información de contactos\n`;
            message += `📊 Ver reportes relacionados con RRHH\n`;
            message += `🎫 Gestionar tickets relacionados\n`;
            break;
            
        case 'rh_nubia':
            message += `👋 *¡Bienvenida Nubia!*\n\n`;
            message += `Como parte del equipo de Recursos Humanos, tienes acceso especializado para gestionar información relacionada con RRHH.\n\n`;
            message += `Puedes:\n`;
            message += `👥 Consultar información de contactos\n`;
            message += `📊 Ver reportes relacionados con RRHH\n`;
            message += `🎫 Gestionar tickets relacionados\n`;
            break;
            
        case 'desarrollo_estrategia_inrra':
            message += `👋 *¡Bienvenida Inrra!*\n\n`;
            message += `Como parte del equipo de Desarrollo y Estrategia, tienes acceso especializado para gestionar proyectos y tareas.\n\n`;
            message += `Puedes:\n`;
            message += `🚀 Ver y gestionar proyectos\n`;
            message += `📋 Ver y gestionar tareas\n`;
            message += `📊 Consultar reportes de desarrollo\n`;
            message += `📈 Ver estadísticas de proyectos\n`;
            break;
            
        case 'ceo':
            message += `👔 *¡Bienvenido CEO!*\n\n`;
            message += `Como CEO, tienes acceso prioritario y completo a todos los servicios del sistema.\n\n`;
            message += `Puedes:\n`;
            message += `📊 Acceso total a proyectos y tareas\n`;
            message += `📈 Reportes ejecutivos completos\n`;
            message += `🎫 Gestión completa de tickets\n`;
            message += `📅 Reservas y calendario completo\n`;
            break;
            
        case 'admin':
            message += `⚙️ *¡Bienvenido Administrador!*\n\n`;
            message += `Como Administrador, tienes acceso total al sistema con todos los privilegios.\n\n`;
            message += `Puedes:\n`;
            message += `🔧 Configurar el sistema\n`;
            message += `👥 Gestionar usuarios y roles\n`;
            message += `📊 Acceso a todas las funciones\n`;
            break;
            
        case 'boss':
            message += `🤝 *¡Bienvenido Jefe!*\n\n`;
            message += `Como Jefe, tienes acceso preferencial al sistema.\n\n`;
            message += `Puedes:\n`;
            message += `📊 Ver proyectos y tareas\n`;
            message += `📈 Consultar reportes\n`;
            message += `🎫 Gestionar tickets\n`;
            break;
            
        case 'levi':
        case 'super_admin':
            message += `🔧 *¡Bienvenido Levi Villarreal!*\n\n`;
            message += `Como Super Administrador, tienes acceso completo y privilegios administrativos totales.\n\n`;
            message += `*Comandos disponibles:*\n`;
            message += `📤 Enviar mensajes a usuarios específicos\n`;
            message += `🔄 Redireccionar mensajes entre usuarios\n`;
            message += `⏸️ Pausar/Reanudar usuarios\n`;
            message += `👥 Ver lista de usuarios\n`;
            message += `📊 Ver estadísticas del sistema\n`;
            message += `🔧 Control total del sistema\n\n`;
            message += `*Usa "!admin" o escribe "admin" para ver el menú completo.*\n`;
            message += `*Escribe "enviar mensaje", "pausar usuario", "usuarios", etc. para usar los comandos.*`;
            break;
            
        default:
            message += `Tienes acceso estándar al sistema como ${roleDescription}.\n\n`;
            message += `Puedes crear tickets, consultar tu información y usar los servicios básicos del sistema.`;
            break;
    }
    
    message += `\n\n📱 *Para comenzar, simplemente escribe "hola" o cualquier mensaje.*\n\n`;
    message += `¿Necesitas ayuda? Escribe "ayuda" para ver todos los comandos disponibles.`;
    
    return message;
}

/**
 * Enviar mensaje de confirmación de asignación de rol
 */
export async function sendRoleAssignmentMessage(
    botManager: BotManager,
    phoneNumber: string,
    role: ContactRole,
    userName: string
): Promise<boolean> {
    try {
        const message = generateRoleAssignmentMessage(role, userName);
        const success = await botManager.sendMessageToUser(phoneNumber, message);
        
        if (success) {
            logger.info(`Role assignment message sent successfully to ${phoneNumber} for role ${role}`);
        } else {
            logger.warn(`Failed to send role assignment message to ${phoneNumber}`);
        }
        
        return success;
    } catch (error) {
        logger.error(`Error sending role assignment message to ${phoneNumber}:`, error);
        return false;
    }
}

