import { Message } from "whatsapp-web.js";
import { UserI18n } from "../utils/i18n.util";
import logger from "../configs/logger.config";
import { ProjectModel } from "../crm/models/project.model";
import { TaskModel } from "../crm/models/task.model";

export const run = async (message: Message, args: string[] | null, userI18n: UserI18n) => {
    try {
        const textoMensaje = message.body.trim().toLowerCase();
        const argsArray = args || textoMensaje.split(' ');

        // Verificar si hay una conversación activa
        const contact = await message.getContact();
        const userNumber = contact.number;
        const conversation = conversations.get(userNumber);

        // Si el usuario escribe "cancel" o "cancelar"
        if (textoMensaje === 'cancel' || textoMensaje === 'cancelar' || textoMensaje === 'salir') {
            conversations.delete(userNumber);
            await message.reply('✅ Operación cancelada.');
            return;
        }

        // Si hay una conversación activa, procesarla
        if (conversation && conversation.step !== 'none') {
            await processConversation(message, conversation, userNumber);
            return;
        }

        // Detectar intención - Mejorado para ser más intuitivo
        if (textoMensaje.includes("actualizar") || textoMensaje.includes("actualiza") ||
            textoMensaje.includes("update") || textoMensaje.includes("progreso") ||
            textoMensaje.includes("status") || textoMensaje.includes("estado") ||
            textoMensaje.includes("avance") || textoMensaje.includes("%") ||
            textoMensaje.match(/\d+%/)) {
            // Si el mensaje tiene un porcentaje directo, extraerlo
            const porcentajeMatch = textoMensaje.match(/(\d+)%/);
            if (porcentajeMatch) {
                const porcentaje = parseInt(porcentajeMatch[1]);
                // Buscar nombre de proyecto/tarea en el mensaje
                const nombreMatch = textoMensaje.replace(/\d+%/, '').trim();
                if (nombreMatch && nombreMatch.length > 2) {
                    await actualizarPorNombre(nombreMatch, porcentaje, message, userNumber);
                    return;
                }
            }
            await iniciarActualizacion(message, userNumber);
            return;
        }

        if (textoMensaje.includes("crear") || textoMensaje.includes("nuevo") ||
            textoMensaje.includes("agregar") || textoMensaje.includes("agrega")) {
            await iniciarCreacion(message, userNumber);
            return;
        }

        if (textoMensaje.includes("listar") || textoMensaje.includes("lista") ||
            textoMensaje.includes("ver") || textoMensaje.includes("mostrar")) {
            await listarProyectos(message);
            return;
        }

        // Si no se detecta intención, mostrar ayuda
        await message.reply(
            `🚀 *Gestión de Proyectos y Tareas*\n\n` +
            `*Comandos disponibles:*\n\n` +
            `📊 *ACTUALIZAR PROGRESO*\n` +
            `"actualizar proyecto" o "update tarea"\n` +
            `Te guiaré para actualizar el progreso o status.\n\n` +
            `➕ *CREAR PROYECTO/TAREA*\n` +
            `"crear proyecto" o "nueva tarea"\n\n` +
            `👀 *VER PROYECTOS*\n` +
            `"listar proyectos" o "ver proyectos"\n\n` +
            `_Escribe \`cancel\` en cualquier momento para cancelar._`
        );
    } catch (error) {
        logger.error("Error en proyectos.command:", error);
        await message.reply("❌ Ocurrió un error al procesar tu solicitud.");
    }
};

interface ProjectConversation {
    step: 'tipo' | 'nombre' | 'progreso' | 'status' | 'none';
    tipo?: 'proyecto' | 'tarea';
    nombre?: string;
    id?: string;
    progreso?: number;
    status?: string;
}

export const conversations = new Map<string, ProjectConversation>();

/**
 * Iniciar actualización de progreso/status
 */
async function iniciarActualizacion(message: Message, userNumber: string) {
    const conversation: ProjectConversation = {
        step: 'tipo'
    };
    conversations.set(userNumber, conversation);

    await message.reply(
        `📊 *Actualizar Progreso*\n\n` +
        `¿Qué quieres actualizar?\n\n` +
        `1️⃣ Proyecto\n` +
        `2️⃣ Tarea\n\n` +
        `Responde con "1" o "2" o escribe "proyecto" o "tarea".`
    );
}

/**
 * Iniciar creación de proyecto/tarea
 */
async function iniciarCreacion(message: Message, userNumber: string) {
    const conversation: ProjectConversation = {
        step: 'tipo'
    };
    conversations.set(userNumber, conversation);

    await message.reply(
        `➕ *Crear Nuevo*\n\n` +
        `¿Qué quieres crear?\n\n` +
        `1️⃣ Proyecto\n` +
        `2️⃣ Tarea\n\n` +
        `Responde con "1" o "2" o escribe "proyecto" o "tarea".`
    );
}

/**
 * Procesar conversación
 */
async function processConversation(message: Message, conversation: ProjectConversation, userNumber: string) {
    const texto = message.body.trim();

    switch (conversation.step) {
        case 'tipo':
            if (texto.includes('1') || texto.includes('proyecto') || texto.includes('project')) {
                conversation.tipo = 'proyecto';
                conversation.step = 'nombre';
                await message.reply(
                    `✅ Proyecto seleccionado.\n\n` +
                    `¿Cuál es el nombre del proyecto? (puedes usar el ID también)`
                );
            } else if (texto.includes('2') || texto.includes('tarea') || texto.includes('task')) {
                conversation.tipo = 'tarea';
                conversation.step = 'nombre';
                await message.reply(
                    `✅ Tarea seleccionada.\n\n` +
                    `¿Cuál es el nombre de la tarea? (puedes usar el ID también)`
                );
            } else {
                await message.reply(`❌ Por favor, responde con "1" o "2", o escribe "proyecto" o "tarea".`);
            }
            break;

        case 'nombre':
            // Buscar por nombre o ID
            if (conversation.tipo === 'proyecto') {
                const proyectos = await ProjectModel.find({
                    $or: [
                        { name: { $regex: texto, $options: 'i' } },
                        { _id: texto.length === 24 ? texto : null }
                    ]
                }).limit(5).lean();

                if (proyectos.length === 0) {
                    await message.reply(
                        `❌ No se encontró el proyecto "${texto}".\n\n` +
                        `¿Quieres crear uno nuevo o buscar con otro nombre?`
                    );
                    return;
                }

                if (proyectos.length === 1) {
                    conversation.id = proyectos[0]._id.toString();
                    conversation.nombre = proyectos[0].name;
                    conversation.step = 'progreso';
                    await mostrarEstadoProyecto(message, proyectos[0]);
                    await message.reply(
                        `\n✅ Proyecto encontrado.\n\n` +
                        `¿Qué quieres actualizar?\n\n` +
                        `1️⃣ Progreso (%)\n` +
                        `2️⃣ Status\n\n` +
                        `O escribe el porcentaje directamente (ej: "60") o el status (ej: "in_progress").`
                    );
                } else {
                    // Múltiples resultados
                    let lista = `Se encontraron ${proyectos.length} proyectos:\n\n`;
                    proyectos.forEach((p: any, index: number) => {
                        lista += `${index + 1}. *${p.name}* (${p.status})\n`;
                    });
                    lista += `\nResponde con el número del proyecto.`;
                    await message.reply(lista);
                    // Guardar lista para siguiente paso
                    conversation.step = 'nombre';
                }
            } else if (conversation.tipo === 'tarea') {
                const tareas = await TaskModel.find({
                    $or: [
                        { name: { $regex: texto, $options: 'i' } },
                        { _id: texto.length === 24 ? texto : null }
                    ]
                }).populate('projectId', 'name').limit(5).lean();

                if (tareas.length === 0) {
                    await message.reply(
                        `❌ No se encontró la tarea "${texto}".\n\n` +
                        `¿Quieres crear una nueva o buscar con otro nombre?`
                    );
                    return;
                }

                if (tareas.length === 1) {
                    conversation.id = tareas[0]._id.toString();
                    conversation.nombre = tareas[0].name;
                    conversation.step = 'progreso';
                    await mostrarEstadoTarea(message, tareas[0]);
                    await message.reply(
                        `\n✅ Tarea encontrada.\n\n` +
                        `¿Qué quieres actualizar?\n\n` +
                        `1️⃣ Progreso (%)\n` +
                        `2️⃣ Status\n\n` +
                        `O escribe el porcentaje directamente (ej: "75") o el status (ej: "doing").`
                    );
                } else {
                    let lista = `Se encontraron ${tareas.length} tareas:\n\n`;
                    tareas.forEach((t: any, index: number) => {
                        const proyecto = t.projectId?.name || 'Sin proyecto';
                        lista += `${index + 1}. *${t.name}* (${t.status}) - ${proyecto}\n`;
                    });
                    lista += `\nResponde con el número de la tarea.`;
                    await message.reply(lista);
                }
            }
            break;

        case 'progreso':
            // Intentar parsear como porcentaje o status
            const numeroMatch = texto.match(/(\d{1,3})/);
            if (numeroMatch && parseInt(numeroMatch[1]) >= 0 && parseInt(numeroMatch[1]) <= 100) {
                const progreso = parseInt(numeroMatch[1]);
                conversation.progreso = progreso;
                
                if (conversation.tipo === 'proyecto') {
                    await actualizarProyecto(conversation.id!, { progress: progreso }, message);
                } else {
                    await actualizarTarea(conversation.id!, { progress: progreso }, message);
                }
                conversations.delete(userNumber);
            } else {
                // Intentar parsear como status
                const status = parsearStatus(texto, conversation.tipo!);
                if (status) {
                    if (conversation.tipo === 'proyecto') {
                        await actualizarProyecto(conversation.id!, { status }, message);
                    } else {
                        await actualizarTarea(conversation.id!, { status }, message);
                    }
                    conversations.delete(userNumber);
                } else {
                    await message.reply(
                        `❌ Formato inválido. Por favor, escribe:\n` +
                        `• Un número del 0 al 100 para progreso (ej: "75")\n` +
                        `• O un status válido (ej: "in_progress", "done")`
                    );
                }
            }
            break;

        default:
            conversations.delete(userNumber);
            await message.reply('❌ Estado de conversación inválido. Por favor, inicia de nuevo.');
    }
}

/**
 * Parsear status desde texto
 */
function parsearStatus(texto: string, tipo: 'proyecto' | 'tarea'): string | null {
    const textoLower = texto.toLowerCase().trim();
    
    if (tipo === 'proyecto') {
        const statusMap: Record<string, string> = {
            'planned': 'planned',
            'planificado': 'planned',
            'planning': 'planned',
            'in_progress': 'in_progress',
            'en progreso': 'in_progress',
            'progreso': 'in_progress',
            'paused': 'paused',
            'pausado': 'paused',
            'done': 'done',
            'completado': 'done',
            'finalizado': 'done'
        };
        return statusMap[textoLower] || null;
    } else {
        const statusMap: Record<string, string> = {
            'todo': 'todo',
            'pendiente': 'todo',
            'doing': 'doing',
            'en progreso': 'doing',
            'progreso': 'doing',
            'blocked': 'blocked',
            'bloqueada': 'blocked',
            'done': 'done',
            'completada': 'done',
            'finalizada': 'done'
        };
        return statusMap[textoLower] || null;
    }
}

/**
 * Actualizar proyecto
 */
async function actualizarProyecto(id: string, data: any, message: Message) {
    try {
        // Calcular progreso promedio de tareas si no se especifica directamente
        if (data.progress === undefined && data.status) {
            // Si solo se cambia el status, mantener el progreso actual
            const proyectoActual = await ProjectModel.findById(id).lean();
            if (proyectoActual && (proyectoActual as any).progress !== undefined) {
                data.progress = (proyectoActual as any).progress;
            }
        }
        
        const proyecto = await ProjectModel.findByIdAndUpdate(id, data, { new: true }).lean();
        
        if (!proyecto) {
            await message.reply(`❌ Proyecto no encontrado.`);
            return;
        }

        let mensaje = `✅ *Proyecto actualizado exitosamente*\n\n`;
        mensaje += `📋 *${proyecto.name}*\n`;
        if (data.progress !== undefined) {
            const barra = generarBarraProgreso(data.progress);
            mensaje += `📊 Progreso: ${barra} ${data.progress}%\n`;
        }
        if (data.status) {
            const statusName = {
                'planned': 'Planificado',
                'in_progress': 'En Progreso',
                'paused': 'Pausado',
                'done': 'Completado'
            }[data.status] || data.status;
            mensaje += `📈 Status: ${statusName}\n`;
        }
        
        mensaje += `\n✅ Cambios guardados. El reporte semanal incluirá esta actualización.`;
        
        await message.reply(mensaje);
    } catch (error: any) {
        logger.error("Error actualizando proyecto:", error);
        await message.reply(`❌ Error al actualizar proyecto: ${error.message}`);
    }
}

/**
 * Actualizar tarea
 */
async function actualizarTarea(id: string, data: any, message: Message) {
    try {
        const tarea = await TaskModel.findByIdAndUpdate(id, data, { new: true })
            .populate('projectId', 'name').lean();
        
        if (!tarea) {
            await message.reply(`❌ Tarea no encontrada.`);
            return;
        }

        // Si la tarea se completó, actualizar automáticamente el progreso
        if (data.status === 'done' && data.progress === undefined) {
            await TaskModel.findByIdAndUpdate(id, { progress: 100 });
            data.progress = 100;
        }

        let mensaje = `✅ *Tarea actualizada exitosamente*\n\n`;
        mensaje += `📋 *${tarea.name}*\n`;
        if (tarea.projectId && (tarea.projectId as any).name) {
            mensaje += `🚀 Proyecto: ${(tarea.projectId as any).name}\n`;
        }
        if (data.progress !== undefined || (tarea as any).progress !== undefined) {
            const progress = data.progress !== undefined ? data.progress : (tarea as any).progress || 0;
            const barra = generarBarraProgreso(progress);
            mensaje += `📊 Progreso: ${barra} ${progress}%\n`;
        }
        if (data.status) {
            const statusName = {
                'todo': 'Pendiente',
                'doing': 'En Progreso',
                'blocked': 'Bloqueada',
                'done': 'Completada'
            }[data.status] || data.status;
            mensaje += `📈 Status: ${statusName}\n`;
        }
        
        mensaje += `\n✅ Cambios guardados. El reporte semanal incluirá esta actualización.`;
        
        await message.reply(mensaje);
    } catch (error: any) {
        logger.error("Error actualizando tarea:", error);
        await message.reply(`❌ Error al actualizar tarea: ${error.message}`);
    }
}

/**
 * Mostrar estado de proyecto
 */
async function mostrarEstadoProyecto(message: Message, proyecto: any) {
    let estado = `📋 *${proyecto.name}*\n`;
    estado += `📈 Status: ${proyecto.status}\n`;
    if (proyecto.priority) estado += `🔥 Prioridad: ${proyecto.priority}\n`;
    estado += `\nEstado actual del proyecto.`;
    await message.reply(estado);
}

/**
 * Mostrar estado de tarea
 */
async function mostrarEstadoTarea(message: Message, tarea: any) {
    let estado = `📋 *${tarea.name}*\n`;
    estado += `📈 Status: ${tarea.status}\n`;
    if (tarea.progress !== undefined) {
        const barra = generarBarraProgreso(tarea.progress);
        estado += `📊 Progreso: ${barra} ${tarea.progress}%\n`;
    }
    if (tarea.projectId && (tarea.projectId as any).name) {
        estado += `🚀 Proyecto: ${(tarea.projectId as any).name}\n`;
    }
    estado += `\nEstado actual de la tarea.`;
    await message.reply(estado);
}

/**
 * Listar proyectos
 */
async function listarProyectos(message: Message) {
    try {
        const proyectos = await ProjectModel.find({ status: { $in: ['planned', 'in_progress'] } })
            .sort({ updatedAt: -1 }).limit(10).lean();

        if (proyectos.length === 0) {
            await message.reply(`📋 No hay proyectos activos en este momento.`);
            return;
        }

        let lista = `🚀 *Proyectos Activos*\n\n`;
        proyectos.forEach((p: any, index: number) => {
            const statusEmoji = {
                'planned': '📋',
                'in_progress': '🚀',
                'paused': '⏸️'
            }[p.status] || '📝';
            
            lista += `${statusEmoji} *${p.name}*\n`;
            lista += `   Status: ${p.status} | Prioridad: ${p.priority || 'media'}\n\n`;
        });

        await message.reply(lista);
    } catch (error: any) {
        logger.error("Error listando proyectos:", error);
        await message.reply(`❌ Error al listar proyectos: ${error.message}`);
    }
}

/**
 * Actualizar por nombre directamente (shortcut)
 */
async function actualizarPorNombre(nombre: string, porcentaje: number, message: Message, userNumber: string) {
    try {
        // Buscar proyecto primero
        let proyecto = await ProjectModel.findOne({ name: { $regex: nombre, $options: 'i' } }).lean();
        
        if (proyecto) {
            await actualizarProyecto(proyecto._id.toString(), { progress: porcentaje }, message);
            return;
        }
        
        // Buscar tarea
        const tarea = await TaskModel.findOne({ name: { $regex: nombre, $options: 'i' } })
            .populate('projectId', 'name').lean();
        
        if (tarea) {
            await actualizarTarea(tarea._id.toString(), { progress: porcentaje }, message);
            return;
        }
        
        await message.reply(
            `❌ No se encontró "${nombre}".\n\n` +
            `Por favor, usa el comando completo:\n` +
            `"actualizar proyecto [nombre] [porcentaje]"`
        );
    } catch (error: any) {
        logger.error("Error en actualizarPorNombre:", error);
        await message.reply(`❌ Error: ${error.message}`);
    }
}

/**
 * Generar barra de progreso visual
 */
function generarBarraProgreso(progress: number): string {
    const filled = Math.round(progress / 10);
    const empty = 10 - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}

