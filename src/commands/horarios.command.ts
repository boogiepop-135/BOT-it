import { Message } from "whatsapp-web.js";
import { UserI18n } from "../utils/i18n.util";
import logger from "../configs/logger.config";
import {
    agregarHorario,
    modificarHorario,
    eliminarHorario,
    consultarHorarios,
    buscarHorarioPorFechaHora,
    consultarUsuarioPorTelefono,
    marcarUsoSinReserva,
    marcarNoAsistencia,
    registrarStrikePorNoRespetarHorario,
    parsearFecha,
    parsearHora,
    validarFecha,
    validarHora,
    validarRangoHoras,
    normalizarTelefono,
} from "../utils/horarios.util";

// Estado de conversación para reservas
export interface ReservaConversation {
    step: 'telefono' | 'nombre' | 'fecha' | 'hora_inicio' | 'hora_fin' | 'titulo' | 'none';
    telefono?: string;
    nombre?: string;
    fecha?: string;
    hora_inicio?: string;
    hora_fin?: string;
    titulo?: string;
    usuarioExiste?: boolean;
    strikes?: number;
}

export const conversations = new Map<string, ReservaConversation>();

export const run = async (message: Message, args: string[] | null, userI18n: UserI18n) => {
    try {
        const contact = await message.getContact();
        const userNumber = contact.number;
        const mensajeCompleto = message.body.toLowerCase().trim();
        const textoMensaje = args ? args.join(" ") : mensajeCompleto;

        // Verificar si hay una conversación activa de reserva
        const conversation = conversations.get(userNumber);

        // Si el usuario escribe "cancel" o "cancelar" en cualquier momento
        if (mensajeCompleto === 'cancel' || mensajeCompleto === 'cancelar' || mensajeCompleto === 'salir') {
            conversations.delete(userNumber);
            await message.reply('✅ Conversación cancelada. Puedes crear una nueva reserva cuando quieras.');
            return;
        }

        // Si hay una conversación activa, procesarla
        if (conversation && conversation.step !== 'none') {
            await processReservaConversation(message, conversation, userNumber);
            return;
        }

        // Detectar intención del usuario
        if (mensajeCompleto.includes("agregar") || mensajeCompleto.includes("agrega") || 
            mensajeCompleto.includes("crear") || mensajeCompleto.includes("crea") ||
            mensajeCompleto.includes("nuevo") || mensajeCompleto.includes("nueva") ||
            mensajeCompleto.includes("reservar") || mensajeCompleto.includes("reserva")) {
            await iniciarReserva(message, userNumber);
            return;
        }

        if (mensajeCompleto.includes("eliminar") || mensajeCompleto.includes("elimina") ||
            mensajeCompleto.includes("borrar") || mensajeCompleto.includes("borra") ||
            mensajeCompleto.includes("quitar") || mensajeCompleto.includes("quita")) {
            await manejarEliminarHorario(message, textoMensaje, args);
            return;
        }

        if (mensajeCompleto.includes("modificar") || mensajeCompleto.includes("modifica") ||
            mensajeCompleto.includes("cambiar") || mensajeCompleto.includes("cambia") ||
            mensajeCompleto.includes("editar") || mensajeCompleto.includes("edita") ||
            mensajeCompleto.includes("actualizar") || mensajeCompleto.includes("actualiza")) {
            await manejarModificarHorario(message, textoMensaje, args);
            return;
        }

        if (mensajeCompleto.includes("cancelar") || mensajeCompleto.includes("cancela")) {
            await manejarCancelarHorario(message, textoMensaje, args);
            return;
        }

        if (mensajeCompleto.includes("consultar") || mensajeCompleto.includes("consulta") ||
            mensajeCompleto.includes("ver") || mensajeCompleto.includes("listar") ||
            mensajeCompleto.includes("mostrar") || mensajeCompleto.includes("muestra")) {
            await manejarConsultarHorarios(message, textoMensaje, args);
            return;
        }

        // Si no se detecta intención clara, mostrar ayuda
        await message.reply(
            `📅 *Gestión de Reservas de Sala de Conferencias*\n\n` +
            `*Comandos disponibles:*\n\n` +
            `➕ *RESERVAR SALA*\n` +
            `"Quiero reservar la sala" o "Reservar sala"\n` +
            `Te guiaré paso a paso para hacer tu reserva.\n\n` +
            `✏️ *MODIFICAR RESERVA*\n` +
            `"Cambia la hora de la reunión del 15 de enero de las 10:00 a las 15:00"\n\n` +
            `❌ *ELIMINAR RESERVA*\n` +
            `"Elimina la reunión de mañana a las 10"\n\n` +
            `👀 *CONSULTAR HORARIOS*\n` +
            `"Ver horarios de mañana"\n\n` +
            `_Escribe \`cancel\` en cualquier momento para cancelar una operación._`
        );
    } catch (error) {
        logger.error("Error en horarios.command:", error);
        await message.reply("❌ Ocurrió un error al procesar tu solicitud. Por favor, intenta de nuevo.");
    }
};

/**
 * Iniciar proceso de reserva - Versión optimizada
 */
async function iniciarReserva(message: Message, userNumber: string) {
    const textoMensaje = message.body.trim();
    
    // Intentar extraer información del mensaje inicial
    let fecha: string | null = null;
    let hora_inicio: string | null = null;
    let hora_fin: string | null = null;
    let titulo: string | null = null;
    
    // Buscar fecha
    const fechaRegex = /(\d{1,2})[\/\-](\d{1,2})[\/\-]?(\d{2,4})?/;
    const matchFecha = textoMensaje.match(fechaRegex);
    if (matchFecha) {
        fecha = parsearFecha(matchFecha[0]);
    }
    
    if (!fecha) {
        if (textoMensaje.toLowerCase().includes("mañana") || textoMensaje.toLowerCase().includes("tomorrow")) {
            fecha = parsearFecha("mañana");
        } else if (textoMensaje.toLowerCase().includes("hoy") || textoMensaje.toLowerCase().includes("today")) {
            fecha = parsearFecha("hoy");
        }
    }
    
    // Buscar horas
    const horaInicioRegex = /(?:a\s*las?|desde|from|at)\s*(\d{1,2}[:\.]?\d{0,2})\s*(?:am|pm|hrs|horas)?/i;
    const matchHoraInicio = textoMensaje.match(horaInicioRegex);
    if (matchHoraInicio) {
        hora_inicio = parsearHora(matchHoraInicio[1]);
    }
    
    const horaFinRegex = /(?:hasta|to|a|until|-\s*)(\d{1,2}[:\.]?\d{0,2})\s*(?:am|pm|hrs|horas)?/i;
    const matchHoraFin = textoMensaje.match(horaFinRegex);
    if (matchHoraFin) {
        hora_fin = parsearHora(matchHoraFin[1]);
    }
    
    // Buscar título
    const tituloRegex = /(?:titulada?|titulo|title|nombre|name|para|for|reunión|reunion|meeting)\s*["']?([^"'\n]+?)["']?/i;
    const matchTitulo = textoMensaje.match(tituloRegex);
    if (matchTitulo) {
        titulo = matchTitulo[1].trim();
    }
    
    const conversation: ReservaConversation = {
        step: 'telefono',
        fecha: fecha || undefined,
        hora_inicio: hora_inicio || undefined,
        hora_fin: hora_fin || undefined,
        titulo: titulo || undefined
    };
    conversations.set(userNumber, conversation);

    // Mensaje optimizado según información obtenida
    let mensaje = `📅 *Reserva de Sala de Conferencias*\n\n`;
    
    if (fecha && hora_inicio && hora_fin && titulo) {
        // Tiene toda la información, solo pedir teléfono
        mensaje += `Veo que quieres reservar:\n`;
        mensaje += `📅 ${fecha} | ⏰ ${hora_inicio}-${hora_fin} | 📝 ${titulo}\n\n`;
        mensaje += `Solo necesito tu número de teléfono para continuar.`;
    } else if (fecha || hora_inicio || titulo) {
        // Tiene algo de información
        mensaje += `Para hacer la reserva necesito tu número de teléfono`;
        if (!fecha) mensaje += ` y la fecha`;
        if (!hora_inicio || !hora_fin) mensaje += ` y el horario`;
        if (!titulo) mensaje += ` y el título`;
        mensaje += `.\n\n`;
        if (fecha) mensaje += `✅ Fecha: ${fecha}\n`;
        if (hora_inicio) mensaje += `✅ Hora inicio: ${hora_inicio}\n`;
        if (hora_fin) mensaje += `✅ Hora fin: ${hora_fin}\n`;
        if (titulo) mensaje += `✅ Título: ${titulo}\n`;
        mensaje += `\nPor favor, proporciona tu número de teléfono primero.`;
    } else {
        // No tiene información, mensaje normal
        mensaje += `Para hacer la reserva necesito tu número de teléfono, por favor.`;
    }
    
    mensaje += `\n\n_Escribe \`cancel\` para cancelar._`;

    await message.reply(mensaje);
}

/**
 * Procesar conversación de reserva
 */
async function processReservaConversation(message: Message, conversation: ReservaConversation, userNumber: string) {
    const texto = message.body.trim();

    switch (conversation.step) {
        case 'telefono':
            // Normalizar teléfono
            const telefono = normalizarTelefono(texto);
            if (!telefono || telefono.length < 8) {
                await message.reply(`❌ Número de teléfono inválido. Por favor, proporciona tu número de teléfono:\n\nEjemplo: 5551234567`);
                return;
            }

            conversation.telefono = telefono;

            // Verificar usuario y strikes
            const usuario = await consultarUsuarioPorTelefono(telefono);
            
            if (usuario.error && usuario.error === "Usuario no encontrado") {
                // Usuario nuevo, pedir nombre
                conversation.step = 'nombre';
                conversation.usuarioExiste = false;
                await message.reply(`¿Cuál es tu nombre?`);
            } else if (usuario.error) {
                await message.reply(`❌ Error al consultar usuario: ${usuario.error}`);
                conversations.delete(userNumber);
                return;
            } else {
                // Usuario existente
                conversation.usuarioExiste = true;
                conversation.nombre = usuario.nombre;
                conversation.strikes = usuario.strikes || 0;

                // Verificar bloqueo (3+ strikes)
                if (usuario.strikes !== undefined && usuario.strikes >= 3) {
                    let mensajeBloqueo = `❌ *Lo siento, no puedo procesar tu reserva.*\n\n`;
                    mensajeBloqueo += `Tienes ${usuario.strikes} strikes en el sistema, lo que significa que estás bloqueado de hacer nuevas reservas.\n\n`;

                    if (usuario.strikes_detalle && usuario.strikes_detalle.length > 0) {
                        mensajeBloqueo += `*Los strikes fueron por:*\n`;
                        usuario.strikes_detalle.forEach((strike: any, index: number) => {
                            mensajeBloqueo += `${index + 1}. ${strike.motivo || strike.fecha || 'Motivo no especificado'}\n`;
                        });
                        mensajeBloqueo += `\n`;
                    }

                    mensajeBloqueo += `Para resolver esto, contacta al administrador.`;
                    
                    await message.reply(mensajeBloqueo);
                    conversations.delete(userNumber);
                    return;
                }

                // Usuario válido, continuar
                // Si ya tenemos fecha del mensaje inicial, saltar ese paso
                if (conversation.fecha) {
                    conversation.step = 'hora_inicio';
                    let mensajeSaludo = `✅ Hola ${usuario.nombre || 'usuario'}!`;
                    if (usuario.strikes && usuario.strikes > 0) {
                        mensajeSaludo += ` Tienes ${usuario.strikes} strike(s). `;
                    }
                    mensajeSaludo += `\n\n✅ Fecha: ${conversation.fecha}`;
                    
                    if (!conversation.hora_inicio) {
                        mensajeSaludo += `\n\n¿A qué hora quieres que inicie? (formato: HH:MM)`;
                    } else {
                        conversation.step = 'hora_fin';
                        mensajeSaludo += `\n✅ Hora inicio: ${conversation.hora_inicio}`;
                        if (!conversation.hora_fin) {
                            mensajeSaludo += `\n\n¿A qué hora quieres que termine? (formato: HH:MM)`;
                        } else {
                            conversation.step = 'titulo';
                            mensajeSaludo += `\n✅ Hora fin: ${conversation.hora_fin}`;
                            if (!conversation.titulo) {
                                mensajeSaludo += `\n\n¿Cuál es el título de la reunión?`;
                            }
                        }
                    }
                    await message.reply(mensajeSaludo);
                } else {
                    // No tenemos fecha, preguntar
                    if (usuario.strikes && usuario.strikes > 0) {
                        await message.reply(
                            `✅ Hola ${usuario.nombre || 'usuario'}! Tienes ${usuario.strikes} strike(s). ` +
                            `Recuerda: 3 strikes = bloqueo.\n\n` +
                            `¿Qué fecha? (ej: mañana, 15/01/2024)`
                        );
                    } else {
                        await message.reply(
                            `✅ Hola ${usuario.nombre || 'usuario'}!\n\n` +
                            `¿Qué fecha? (ej: mañana, 15/01/2024)`
                        );
                    }
                    conversation.step = 'fecha';
                }
            }
            break;

        case 'nombre':
            if (texto.length < 2) {
                await message.reply(`❌ El nombre debe tener al menos 2 caracteres. Por favor, proporciona tu nombre.`);
                return;
            }
            conversation.nombre = texto;
            
            // Si ya tenemos fecha del mensaje inicial, saltar ese paso
            if (conversation.fecha) {
                conversation.step = 'hora_inicio';
                let mensaje = `✅ ${texto}, tu usuario será creado.\n\n✅ Fecha: ${conversation.fecha}`;
                if (!conversation.hora_inicio) {
                    mensaje += `\n\n¿Hora de inicio? (HH:MM)`;
                } else {
                    conversation.step = 'hora_fin';
                    mensaje += `\n✅ Hora inicio: ${conversation.hora_inicio}`;
                    if (!conversation.hora_fin) {
                        mensaje += `\n\n¿Hora de fin? (HH:MM)`;
                    } else {
                        conversation.step = 'titulo';
                        mensaje += `\n✅ Hora fin: ${conversation.hora_fin}`;
                        if (!conversation.titulo) {
                            mensaje += `\n\n¿Título de la reunión?`;
                        }
                    }
                }
                await message.reply(mensaje);
            } else {
                conversation.step = 'fecha';
                await message.reply(
                    `✅ Gracias ${texto}! Tu usuario será creado.\n\n` +
                    `¿Qué fecha? (ej: mañana, 15/01/2024)`
                );
            }
            break;

        case 'fecha':
            // Intentar extraer hora del mensaje también (ej: "el lunes a las 11 am")
            let fechaDelMensaje = texto;
            let horaExtraidaDelMensaje: string | null = null;
            
            // Buscar hora en el mensaje (buscar patrón "a las X am/pm" o "las X am/pm")
            const horaEnMensajeRegex = /(?:a\s*las?|las?)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i;
            const matchHoraEnMensaje = texto.match(horaEnMensajeRegex);
            if (matchHoraEnMensaje) {
                // Construir hora para parsear
                const horaNum = matchHoraEnMensaje[1];
                const minutosNum = matchHoraEnMensaje[2] || '00';
                const ampm = matchHoraEnMensaje[3].toLowerCase();
                horaExtraidaDelMensaje = parsearHora(`${horaNum}:${minutosNum} ${ampm}`);
                
                // Si encontramos hora, extraerla del texto para parsear fecha
                if (horaExtraidaDelMensaje) {
                    fechaDelMensaje = texto.replace(horaEnMensajeRegex, '').trim();
                    // Limpiar espacios extra y palabras comunes
                    fechaDelMensaje = fechaDelMensaje.replace(/^\s*(el|la|las|los)\s+/i, '').trim();
                }
            }
            
            const fecha = parsearFecha(fechaDelMensaje);
            if (!fecha || !validarFecha(fecha)) {
                await message.reply(
                    `❌ Fecha no válida. Ejemplos:\n` +
                    `• "mañana" o "hoy"\n` +
                    `• "lunes" o "martes"\n` +
                    `• "15/01/2024" o "3 de noviembre 2025"\n` +
                    `• "el 3 de noviembre del 2025"`
                );
                return;
            }
            conversation.fecha = fecha;
            
            // Si extrajimos hora del mensaje, usarla
            if (horaExtraidaDelMensaje) {
                conversation.hora_inicio = horaExtraidaDelMensaje;
            }
            
            // Si ya tenemos hora_inicio (del mensaje inicial o extraída), saltar ese paso
            if (conversation.hora_inicio) {
                conversation.step = 'hora_fin';
                let mensaje = `✅ Fecha: ${fecha}\n✅ Hora inicio: ${conversation.hora_inicio}`;
                if (!conversation.hora_fin) {
                    mensaje += `\n\n¿Hora de fin? (HH:MM o ej: "3 pm")`;
                } else {
                    conversation.step = 'titulo';
                    mensaje += `\n✅ Hora fin: ${conversation.hora_fin}`;
                    if (!conversation.titulo) {
                        mensaje += `\n\n¿Título?`;
                    }
                }
                await message.reply(mensaje);
            } else {
                conversation.step = 'hora_inicio';
                await message.reply(`✅ Fecha: ${fecha}\n\n¿Hora de inicio? (HH:MM o ej: "11 am")`);
            }
            break;

        case 'hora_inicio':
            const horaInicio = parsearHora(texto);
            if (!horaInicio || !validarHora(horaInicio)) {
                await message.reply(`❌ Formato inválido. Usa HH:MM o ej: "11 am", "2:30 pm", "14:00"`);
                return;
            }
            conversation.hora_inicio = horaInicio;
            
            // Si ya tenemos hora_fin del mensaje inicial, saltar ese paso
            if (conversation.hora_fin) {
                // Validar rango
                if (!validarRangoHoras(horaInicio, conversation.hora_fin)) {
                    await message.reply(`❌ La hora de fin debe ser posterior a ${horaInicio}. Por favor, corrige.`);
                    return;
                }
                conversation.step = 'titulo';
                let mensaje = `✅ Hora inicio: ${horaInicio}\n✅ Hora fin: ${conversation.hora_fin}`;
                if (!conversation.titulo) {
                    mensaje += `\n\n¿Título?`;
                } else {
                    // Ya tenemos todo, completar
                    await completarReserva(message, conversation, userNumber);
                    return;
                }
                await message.reply(mensaje);
            } else {
                conversation.step = 'hora_fin';
                await message.reply(`✅ Hora inicio: ${horaInicio}\n\n¿Hora de fin? (HH:MM, ej: 16:00)`);
            }
            break;

        case 'hora_fin':
            const horaFin = parsearHora(texto);
            if (!horaFin || !validarHora(horaFin)) {
                await message.reply(`❌ Formato inválido. Usa HH:MM o ej: "3 pm", "16:00"`);
                return;
            }

            if (conversation.hora_inicio && !validarRangoHoras(conversation.hora_inicio, horaFin)) {
                await message.reply(`❌ La hora de fin debe ser posterior a ${conversation.hora_inicio}. Por favor, corrige.`);
                return;
            }

            conversation.hora_fin = horaFin;
            
            // Si ya tenemos título del mensaje inicial, completar directamente
            if (conversation.titulo) {
                await completarReserva(message, conversation, userNumber);
                return;
            }
            
            conversation.step = 'titulo';
            await message.reply(`✅ Hora fin: ${horaFin}\n\n¿Título de la reunión?`);
            break;

        case 'titulo':
            if (texto.length < 3) {
                await message.reply(`❌ El título debe tener al menos 3 caracteres. Por favor, proporciona un título para la reunión.`);
                return;
            }
            conversation.titulo = texto;
            
            // Completar la reserva
            await completarReserva(message, conversation, userNumber);
            break;

        default:
            conversations.delete(userNumber);
            await message.reply('❌ Estado de conversación inválido. Por favor, inicia una nueva reserva.');
    }
}

/**
 * Completar proceso de reserva
 */
async function completarReserva(message: Message, conversation: ReservaConversation, userNumber: string) {
    try {
        if (!conversation.telefono || !conversation.fecha || !conversation.hora_inicio || 
            !conversation.hora_fin || !conversation.titulo) {
            await message.reply('❌ Faltan datos para completar la reserva. Por favor, inicia una nueva reserva.');
            conversations.delete(userNumber);
            return;
        }

        // Preparar datos para enviar
        const datosHorario: any = {
            fecha: conversation.fecha,
            hora_inicio: conversation.hora_inicio,
            hora_fin: conversation.hora_fin,
            titulo: conversation.titulo,
            usuario_telefono: conversation.telefono,
            estado: "activo"
        };

        // Si es usuario nuevo, incluir nombre
        if (!conversation.usuarioExiste && conversation.nombre) {
            datosHorario.usuario_nombre = conversation.nombre;
        }

        // Hacer la petición
        const resultado = await agregarHorario(datosHorario);

        if (resultado.error) {
            if (resultado.error.includes("bloqueado") || resultado.error.includes("403")) {
                await message.reply(
                    `❌ *No puedo procesar tu reserva*\n\n` +
                    `Estás bloqueado por tener 3 o más strikes en el sistema.\n\n` +
                    `Para resolver esto, contacta al administrador.`
                );
            } else if (resultado.error.includes("Conflicto")) {
                let mensajeError = `⚠️ *Conflicto de horario*\n\nYa existe un horario en ese rango de tiempo.\n\n`;
                
                if (resultado.conflicto) {
                    mensajeError += `*Horario conflictivo:*\n`;
                    mensajeError += `📅 Fecha: ${resultado.conflicto.fecha || conversation.fecha}\n`;
                    mensajeError += `⏰ Hora: ${resultado.conflicto.hora_inicio || conversation.hora_inicio} - ${resultado.conflicto.hora_fin || conversation.hora_fin}\n`;
                    mensajeError += `📝 Título: ${resultado.conflicto.titulo || "N/A"}\n\n`;
                }
                
                mensajeError += `💡 *Sugerencias:*\n`;
                // Calcular horarios alternativos
                const [hInicio, mInicio] = conversation.hora_inicio.split(':').map(Number);
                const [hFin, mFin] = conversation.hora_fin.split(':').map(Number);
                const duracion = (hFin * 60 + mFin) - (hInicio * 60 + mInicio);
                
                // Sugerir 30 minutos después
                const minutosSugeridos = hInicio * 60 + mInicio + 30;
                const hSugerida1 = Math.floor(minutosSugeridos / 60);
                const mSugerida1 = minutosSugeridos % 60;
                const hFinSugerida1 = Math.floor((minutosSugeridos + duracion) / 60);
                const mFinSugerida1 = (minutosSugeridos + duracion) % 60;
                
                mensajeError += `• ${String(hSugerida1).padStart(2, '0')}:${String(mSugerida1).padStart(2, '0')} - ${String(hFinSugerida1).padStart(2, '0')}:${String(mFinSugerida1).padStart(2, '0')}\n`;
                
                // Sugerir 1 hora después
                const minutosSugeridos2 = hInicio * 60 + mInicio + 60;
                const hSugerida2 = Math.floor(minutosSugeridos2 / 60);
                const mSugerida2 = minutosSugeridos2 % 60;
                const hFinSugerida2 = Math.floor((minutosSugeridos2 + duracion) / 60);
                const mFinSugerida2 = (minutosSugeridos2 + duracion) % 60;
                
                mensajeError += `• ${String(hSugerida2).padStart(2, '0')}:${String(mSugerida2).padStart(2, '0')} - ${String(hFinSugerida2).padStart(2, '0')}:${String(mFinSugerida2).padStart(2, '0')}\n`;
                
                mensajeError += `\nIntenta con uno de estos horarios.`;
                
                await message.reply(mensajeError);
            } else {
                await message.reply(`❌ Error al agregar horario: ${resultado.error}`);
            }
            conversations.delete(userNumber);
            return;
        }

        // Éxito - Mensaje optimizado
        let mensajeExito = `✅ *¡Reserva confirmada!*\n\n`;
        mensajeExito += `📅 ${conversation.fecha} | ⏰ ${conversation.hora_inicio}-${conversation.hora_fin}\n`;
        mensajeExito += `📝 ${conversation.titulo}\n`;
        
        if (!conversation.usuarioExiste && conversation.nombre) {
            mensajeExito += `\n✅ Usuario creado en el sistema.`;
        }
        
        if (conversation.strikes !== undefined && conversation.strikes > 0) {
            mensajeExito += `\n⚠️ Tienes ${conversation.strikes}/3 strikes.`;
        }
        
        mensajeExito += `\n\n📌 Recuerda: Llegar a tiempo, respetar horario y cancelar si no puedes asistir.`;

        await message.reply(mensajeExito);
        conversations.delete(userNumber);
    } catch (error) {
        logger.error("Error en completarReserva:", error);
        await message.reply("❌ Ocurrió un error al procesar la reserva.");
        conversations.delete(userNumber);
    }
}

/**
 * Manejar eliminar un horario
 */
async function manejarEliminarHorario(message: Message, textoMensaje: string, args: string[] | null) {
    try {
        // Buscar ID en el mensaje (24 caracteres hexadecimales)
        let id: string | null = null;
        const idRegex = /([0-9a-fA-F]{24})/;
        const matchId = textoMensaje.match(idRegex);
        if (matchId) {
            id = matchId[1];
        }
        
        // Si no hay ID, buscar por fecha y hora
        if (!id) {
            let fecha: string | null = null;
            
            // Buscar fecha
            const fechaRegex = /(\d{1,2})[\/\-](\d{1,2})[\/\-]?(\d{2,4})?/;
            const matchFecha = textoMensaje.match(fechaRegex);
            if (matchFecha) {
                fecha = parsearFecha(matchFecha[0]);
            }
            
            if (!fecha) {
                if (textoMensaje.includes("mañana") || textoMensaje.includes("tomorrow")) {
                    fecha = parsearFecha("mañana");
                } else if (textoMensaje.includes("hoy") || textoMensaje.includes("today")) {
                    fecha = parsearFecha("hoy");
                }
            }
            
            if (!fecha) {
                await message.reply(
                    `❌ No pude identificar la fecha o ID del horario.\n\n` +
                    `Proporciona:\n` +
                    `• El ID del horario (24 caracteres)\n` +
                    `• O la fecha (ejemplo: "elimina la reunión de mañana a las 10")`
                );
                return;
            }
            
            // Buscar hora opcional
            let hora: string | undefined = undefined;
            const horaRegex = /(?:a\s*las?|las?)\s*(\d{1,2}[:\.]?\d{0,2})/i;
            const matchHora = textoMensaje.match(horaRegex);
            if (matchHora) {
                hora = parsearHora(matchHora[1]) || undefined;
            }
            
            // Buscar horario
            const busqueda = await buscarHorarioPorFechaHora(fecha, hora);
            
            if (busqueda.error) {
                await message.reply(`❌ ${busqueda.error}`);
                return;
            }
            
            if (!busqueda.id) {
                await message.reply(`❌ No se encontró ningún horario para la fecha y hora especificadas.`);
                return;
            }
            
            id = busqueda.id;
        }
        
        // Confirmar eliminación
        const resultado = await eliminarHorario(id);
        
        if (resultado.error) {
            await message.reply(`❌ ${resultado.error}`);
            return;
        }
        
        await message.reply(
            `✅ *Reserva eliminada exitosamente*\n\n` +
            `El horario con ID ${id} ha sido eliminado del sistema.`
        );
    } catch (error) {
        logger.error("Error en manejarEliminarHorario:", error);
        await message.reply("❌ Ocurrió un error al procesar la solicitud de eliminar horario.");
    }
}

/**
 * Manejar modificar un horario
 */
async function manejarModificarHorario(message: Message, textoMensaje: string, args: string[] | null) {
    try {
        // Buscar ID
        let id: string | null = null;
        const idRegex = /([0-9a-fA-F]{24})/;
        const matchId = textoMensaje.match(idRegex);
        if (matchId) {
            id = matchId[1];
        }
        
        // Si no hay ID, buscar por fecha y hora
        if (!id) {
            let fecha: string | null = null;
            
            const fechaRegex = /(\d{1,2})[\/\-](\d{1,2})[\/\-]?(\d{2,4})?/;
            const matchFecha = textoMensaje.match(fechaRegex);
            if (matchFecha) {
                fecha = parsearFecha(matchFecha[0]);
            }
            
            if (!fecha) {
                if (textoMensaje.includes("mañana") || textoMensaje.includes("tomorrow")) {
                    fecha = parsearFecha("mañana");
                } else if (textoMensaje.includes("hoy") || textoMensaje.includes("today")) {
                    fecha = parsearFecha("hoy");
                }
            }
            
            if (!fecha) {
                await message.reply(
                    `❌ No pude identificar la fecha o ID del horario.\n\n` +
                    `Proporciona la fecha para buscar el horario.`
                );
                return;
            }
            
            // Buscar hora aproximada
            let hora: string | undefined = undefined;
            const horaRegex = /(?:a\s*las?|las?)\s*(\d{1,2}[:\.]?\d{0,2})/i;
            const matchHora = textoMensaje.match(horaRegex);
            if (matchHora) {
                hora = parsearHora(matchHora[1]) || undefined;
            }
            
            const busqueda = await buscarHorarioPorFechaHora(fecha, hora);
            
            if (busqueda.error || !busqueda.id) {
                await message.reply(`❌ ${busqueda.error || "No se encontró el horario"}`);
                return;
            }
            
            id = busqueda.id;
        }
        
        // Extraer qué se quiere cambiar
        const datosCambio: any = {};
        
        // Cambiar título
        if (textoMensaje.includes("título") || textoMensaje.includes("titulo") || textoMensaje.includes("title")) {
            const tituloMatch = textoMensaje.match(/(?:título|titulo|title|nombre|name)\s*(?:a|por|to|by)?\s*["']?([^"'\n]+?)["']?/i);
            if (tituloMatch) {
                datosCambio.titulo = tituloMatch[1].trim();
            }
        }
        
        // Cambiar hora
        if (textoMensaje.includes("hora") || textoMensaje.includes("time")) {
            const horaCambioRegex = /(?:de\s*las?|from)\s*(\d{1,2}[:\.]?\d{0,2})\s*(?:a|to|hasta)\s*(\d{1,2}[:\.]?\d{0,2})/i;
            const matchHoraCambio = textoMensaje.match(horaCambioRegex);
            if (matchHoraCambio) {
                const horaInicio = parsearHora(matchHoraCambio[1]);
                const horaFin = parsearHora(matchHoraCambio[2]);
                if (horaInicio) datosCambio.hora_inicio = horaInicio;
                if (horaFin) datosCambio.hora_fin = horaFin;
            } else {
                // Cambiar solo hora de inicio
                const horaInicioRegex = /(?:a\s*las?|las?)\s*(\d{1,2}[:\.]?\d{0,2})/i;
                const matchHoraInicio = textoMensaje.match(horaInicioRegex);
                if (matchHoraInicio) {
                    const horaInicio = parsearHora(matchHoraInicio[1]);
                    if (horaInicio) datosCambio.hora_inicio = horaInicio;
                }
            }
        }
        
        // Si no se especificó qué cambiar
        if (Object.keys(datosCambio).length === 0) {
            await message.reply(
                `❌ No pude identificar qué quieres cambiar.\n\n` +
                `Ejemplos:\n` +
                `• "Cambia el título a 'Reunión urgente'"\n` +
                `• "Modifica la hora de las 10:00 a las 15:00"\n` +
                `• "Cambia el organizador a Juan Pérez"`
            );
            return;
        }
        
        // Realizar modificación
        const resultado = await modificarHorario(id, datosCambio);
        
        if (resultado.error) {
            if (resultado.error.includes("Conflicto")) {
                await message.reply(`⚠️ Conflicto de horario: ${resultado.error}\n\nEl nuevo horario entra en conflicto con otro existente.`);
            } else {
                await message.reply(`❌ ${resultado.error}`);
            }
            return;
        }
        
        let mensajeConfirmacion = `✅ *Reserva modificada exitosamente*\n\n`;
        if (datosCambio.titulo) mensajeConfirmacion += `📝 Título: ${datosCambio.titulo}\n`;
        if (datosCambio.hora_inicio) mensajeConfirmacion += `⏰ Hora inicio: ${datosCambio.hora_inicio}\n`;
        if (datosCambio.hora_fin) mensajeConfirmacion += `⏰ Hora fin: ${datosCambio.hora_fin}\n`;
        
        await message.reply(mensajeConfirmacion);
    } catch (error) {
        logger.error("Error en manejarModificarHorario:", error);
        await message.reply("❌ Ocurrió un error al procesar la solicitud de modificar horario.");
    }
}

/**
 * Manejar cancelar un horario (cambiar estado a cancelado)
 */
async function manejarCancelarHorario(message: Message, textoMensaje: string, args: string[] | null) {
    try {
        // Buscar ID
        let id: string | null = null;
        const idRegex = /([0-9a-fA-F]{24})/;
        const matchId = textoMensaje.match(idRegex);
        if (matchId) {
            id = matchId[1];
        }
        
        // Si no hay ID, buscar por fecha
        if (!id) {
            let fecha: string | null = null;
            
            const fechaRegex = /(\d{1,2})[\/\-](\d{1,2})[\/\-]?(\d{2,4})?/;
            const matchFecha = textoMensaje.match(fechaRegex);
            if (matchFecha) {
                fecha = parsearFecha(matchFecha[0]);
            }
            
            if (!fecha) {
                if (textoMensaje.includes("mañana") || textoMensaje.includes("tomorrow")) {
                    fecha = parsearFecha("mañana");
                } else if (textoMensaje.includes("hoy") || textoMensaje.includes("today")) {
                    fecha = parsearFecha("hoy");
                }
            }
            
            if (!fecha) {
                await message.reply(`❌ No pude identificar la fecha del horario.`);
                return;
            }
            
            const busqueda = await buscarHorarioPorFechaHora(fecha);
            
            if (busqueda.error || !busqueda.id) {
                await message.reply(`❌ ${busqueda.error || "No se encontró el horario"}`);
                return;
            }
            
            id = busqueda.id;
        }
        
        // Cambiar estado a cancelado
        const resultado = await modificarHorario(id, { estado: "cancelado" });
        
        if (resultado.error) {
            await message.reply(`❌ ${resultado.error}`);
            return;
        }
        
        await message.reply(
            `✅ *Reserva cancelada exitosamente*\n\n` +
            `El horario con ID ${id} ha sido cancelado.`
        );
    } catch (error) {
        logger.error("Error en manejarCancelarHorario:", error);
        await message.reply("❌ Ocurrió un error al procesar la solicitud de cancelar horario.");
    }
}

/**
 * Manejar consultar horarios
 */
async function manejarConsultarHorarios(message: Message, textoMensaje: string, args: string[] | null) {
    try {
        const filtros: any = {};
        
        // Buscar fecha
        let fecha: string | null = null;
        const fechaRegex = /(\d{1,2})[\/\-](\d{1,2})[\/\-]?(\d{2,4})?/;
        const matchFecha = textoMensaje.match(fechaRegex);
        if (matchFecha) {
            fecha = parsearFecha(matchFecha[0]);
        }
        
        if (!fecha) {
            if (textoMensaje.includes("mañana") || textoMensaje.includes("tomorrow")) {
                fecha = parsearFecha("mañana");
            } else if (textoMensaje.includes("hoy") || textoMensaje.includes("today")) {
                fecha = parsearFecha("hoy");
            }
        }
        
        if (fecha) {
            filtros.fecha = fecha;
        }
        
        // Buscar estado
        if (textoMensaje.includes("cancelado") || textoMensaje.includes("canceled")) {
            filtros.estado = "cancelado";
        } else if (textoMensaje.includes("activo") || textoMensaje.includes("active")) {
            filtros.estado = "activo";
        }
        
        // Consultar horarios
        const resultado = await consultarHorarios(filtros);
        
        if (resultado.error) {
            await message.reply(`❌ ${resultado.error}`);
            return;
        }
        
        if (!resultado.data || resultado.data.length === 0) {
            const mensajeFiltro = fecha ? ` para la fecha ${fecha}` : "";
            await message.reply(`📅 No se encontraron horarios${mensajeFiltro}.`);
            return;
        }
        
        // Formatear respuesta
        let mensaje = `📅 *Horarios encontrados*\n\n`;
        
        resultado.data.forEach((horario: any, index: number) => {
            const id = horario.id || horario._id || "N/A";
            const fecha = horario.fecha || "N/A";
            const horaInicio = horario.hora_inicio || "N/A";
            const horaFin = horario.hora_fin || "N/A";
            const titulo = horario.titulo || "Sin título";
            const estado = horario.estado || "activo";
            const estadoEmoji = estado === "cancelado" ? "🚫" : "✅";
            
            mensaje += `${estadoEmoji} *${index + 1}. ${titulo}*\n`;
            mensaje += `📅 ${fecha}\n`;
            mensaje += `⏰ ${horaInicio} - ${horaFin}\n`;
            mensaje += `🆔 ${id}\n`;
            if (horario.organizador) mensaje += `👤 ${horario.organizador}\n`;
            mensaje += `\n`;
        });
        
        await message.reply(mensaje);
    } catch (error) {
        logger.error("Error en manejarConsultarHorarios:", error);
        await message.reply("❌ Ocurrió un error al procesar la consulta de horarios.");
    }
}

/**
 * FUNCIONES PARA MARCAR STRIKES (disponibles para uso administrativo o detección automática)
 */

/**
 * Marcar uso sin reserva
 * @param idHorario ID del horario donde se detectó el uso
 * @param usuarioTelefono Teléfono del usuario
 * @param usuarioNombre Nombre del usuario
 */
export async function marcarUsoSinReservaComando(idHorario: string, usuarioTelefono: string, usuarioNombre: string): Promise<string> {
    try {
        const resultado = await marcarUsoSinReserva(idHorario, usuarioTelefono, usuarioNombre);
        
        if (resultado.error) {
            return `❌ Error: ${resultado.error}`;
        }
        
        const strikesActuales = resultado.strikes || 0;
        return `⚠️ *Has usado la sala sin reserva previa.*\n\n` +
               `Se te ha agregado un strike por esta infracción.\n\n` +
               `Actualmente tienes ${strikesActuales} strike(s) de 3 permitidos.\n\n` +
               `Recuerda que 3 strikes te bloqueará de hacer reservas.`;
    } catch (error: any) {
        logger.error("Error en marcarUsoSinReservaComando:", error);
        return `❌ Error al procesar: ${error.message}`;
    }
}

/**
 * Marcar no asistencia
 * @param idHorario ID del horario donde no se registró asistencia
 */
export async function marcarNoAsistenciaComando(idHorario: string): Promise<string> {
    try {
        const resultado = await marcarNoAsistencia(idHorario);
        
        if (resultado.error) {
            return `❌ Error: ${resultado.error}`;
        }
        
        const strikesActuales = resultado.strikes || 0;
        const usuario = resultado.usuario;
        
        return `📢 *Recordatorio: No asistencia registrada*\n\n` +
               `No se registró tu asistencia a la reserva programada.\n\n` +
               `Se te ha agregado un strike por no asistir sin cancelar.\n\n` +
               `Actualmente tienes ${strikesActuales} strike(s).\n\n` +
               `Por favor cancela tus reservas si no puedes asistir para evitar más strikes.`;
    } catch (error: any) {
        logger.error("Error en marcarNoAsistenciaComando:", error);
        return `❌ Error al procesar: ${error.message}`;
    }
}

/**
 * Registrar strike por no respetar horario
 * @param idHorario ID del horario
 * @param motivo Motivo del strike (ej: "Llegó 25 minutos tarde sin avisar")
 */
export async function registrarStrikeNoRespetarHorarioComando(idHorario: string, motivo: string): Promise<string> {
    try {
        const resultado = await registrarStrikePorNoRespetarHorario(idHorario, motivo);
        
        if (resultado.error) {
            return `❌ Error: ${resultado.error}`;
        }
        
        const strikesActuales = resultado.strikes || 0;
        
        return `⚠️ *No respetaste el horario*\n\n` +
               `Motivo: ${motivo}\n\n` +
               `Se te ha agregado un strike.\n\n` +
               `Actualmente tienes ${strikesActuales} strike(s).\n\n` +
               `Por favor respeta los horarios reservados.`;
    } catch (error: any) {
        logger.error("Error en registrarStrikeNoRespetarHorarioComando:", error);
        return `❌ Error al procesar: ${error.message}`;
    }
}
