import logger from "../configs/logger.config";

const API_BASE_URL = "https://horariossaladeconferencias-production.up.railway.app/api";

interface HorarioData {
    fecha: string; // YYYY-MM-DD
    hora_inicio: string; // HH:MM (24h)
    hora_fin: string; // HH:MM (24h)
    titulo: string;
    usuario_telefono: string; // REQUERIDO
    usuario_nombre?: string; // Opcional (solo si usuario es nuevo)
    descripcion?: string;
    organizador?: string;
    participantes?: string[];
    estado?: "activo" | "cancelado";
}

interface HorarioResponse {
    id?: string;
    message?: string;
    error?: string;
    conflicto?: any;
}

interface UsuarioResponse {
    telefono?: string;
    nombre?: string;
    strikes?: number;
    bloqueado?: boolean;
    strikes_detalle?: Array<{ fecha: string; motivo: string }>;
    error?: string;
}

/**
 * Validar formato de fecha (YYYY-MM-DD)
 */
export function validarFecha(fecha: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(fecha)) {
        return false;
    }
    const date = new Date(fecha);
    return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Validar formato de hora (HH:MM en 24h)
 */
export function validarHora(hora: string): boolean {
    const regex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    return regex.test(hora);
}

/**
 * Validar que hora_inicio sea anterior a hora_fin
 */
export function validarRangoHoras(hora_inicio: string, hora_fin: string): boolean {
    if (!validarHora(hora_inicio) || !validarHora(hora_fin)) {
        return false;
    }
    
    const [hInicio, mInicio] = hora_inicio.split(':').map(Number);
    const [hFin, mFin] = hora_fin.split(':').map(Number);
    
    const minutosInicio = hInicio * 60 + mInicio;
    const minutosFin = hFin * 60 + mFin;
    
    return minutosInicio < minutosFin;
}

/**
 * Convertir fecha natural a formato YYYY-MM-DD
 */
export function parsearFecha(fechaTexto: string): string | null {
    const hoy = new Date();
    const mañana = new Date(hoy);
    mañana.setDate(hoy.getDate() + 1);
    
    const fechaTextoLower = fechaTexto.toLowerCase().trim();
    
    // Fechas relativas comunes
    if (fechaTextoLower === 'hoy' || fechaTextoLower === 'today') {
        return formatFecha(hoy);
    }
    if (fechaTextoLower === 'mañana' || fechaTextoLower === 'tomorrow') {
        return formatFecha(mañana);
    }
    
    // Intentar parsear como fecha
    try {
        // Formato: DD/MM/YYYY o DD-MM-YYYY
        if (fechaTexto.includes('/') || fechaTexto.includes('-')) {
            const partes = fechaTexto.split(/[\/\-]/);
            if (partes.length === 3) {
                let dia = parseInt(partes[0]);
                let mes = parseInt(partes[1]);
                const año = parseInt(partes[2]);
                
                // Si el año tiene solo 2 dígitos
                if (año < 100) {
                    const añoCompleto = año < 50 ? 2000 + año : 1900 + año;
                    return `${añoCompleto}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
                }
                
                return `${año}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
            }
        }
        
        // Intentar parsear como fecha natural
        const fecha = new Date(fechaTexto);
        if (!isNaN(fecha.getTime())) {
            return formatFecha(fecha);
        }
    } catch (error) {
        logger.error('Error parseando fecha:', error);
    }
    
    return null;
}

/**
 * Convertir fecha a formato YYYY-MM-DD
 */
function formatFecha(fecha: Date): string {
    const año = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${año}-${mes}-${dia}`;
}

/**
 * Convertir hora natural a formato HH:MM (24h)
 */
export function parsearHora(horaTexto: string): string | null {
    const horaTextoLower = horaTexto.toLowerCase().trim();
    
    // Formato: HH:MM (ya está en formato correcto)
    if (validarHora(horaTexto)) {
        return horaTexto;
    }
    
    // Formato: H:MM (agregar 0 al inicio)
    const regexHora = /^(\d{1,2}):(\d{2})$/;
    const matchHora = horaTexto.match(regexHora);
    if (matchHora) {
        const hora = parseInt(matchHora[1]);
        const minutos = matchHora[2];
        if (hora >= 0 && hora < 24) {
            return `${String(hora).padStart(2, '0')}:${minutos}`;
        }
    }
    
    // Formato: HHMM (sin dos puntos)
    const regexHoraSinPuntos = /^(\d{3,4})$/;
    const matchHoraSinPuntos = horaTexto.match(regexHoraSinPuntos);
    if (matchHoraSinPuntos) {
        const numero = matchHoraSinPuntos[1];
        if (numero.length === 3) {
            return `0${numero[0]}:${numero.substring(1)}`;
        } else if (numero.length === 4) {
            return `${numero.substring(0, 2)}:${numero.substring(2)}`;
        }
    }
    
    // Formato: 10am, 2pm, etc.
    const regexAmPm = /^(\d{1,2})\s*(am|pm)$/i;
    const matchAmPm = horaTextoLower.match(regexAmPm);
    if (matchAmPm) {
        let hora = parseInt(matchAmPm[1]);
        const ampm = matchAmPm[2].toLowerCase();
        
        if (ampm === 'pm' && hora !== 12) {
            hora += 12;
        } else if (ampm === 'am' && hora === 12) {
            hora = 0;
        }
        
        if (hora >= 0 && hora < 24) {
            return `${String(hora).padStart(2, '0')}:00`;
        }
    }
    
    return null;
}

/**
 * Normalizar número de teléfono
 */
export function normalizarTelefono(telefono: string): string {
    // Eliminar caracteres no numéricos excepto +
    return telefono.replace(/[^\d+]/g, '');
}

/**
 * Consultar usuario por teléfono
 */
export async function consultarUsuarioPorTelefono(telefono: string): Promise<UsuarioResponse> {
    try {
        const telefonoNormalizado = normalizarTelefono(telefono);
        
        if (!telefonoNormalizado || telefonoNormalizado.length < 8) {
            return { error: "Número de teléfono inválido" };
        }
        
        const response = await fetch(`${API_BASE_URL}/usuarios/telefono/${telefonoNormalizado}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        });
        
        const result: UsuarioResponse = await response.json();
        
        if (response.status === 200) {
            logger.info(`Usuario consultado exitosamente: ${telefonoNormalizado}`);
            return result;
        } else if (response.status === 404) {
            logger.info(`Usuario no encontrado: ${telefonoNormalizado}`);
            return { error: "Usuario no encontrado" };
        } else {
            logger.error(`Error al consultar usuario: ${response.status} - ${JSON.stringify(result)}`);
            return { error: result.error || `Error ${response.status}: Error desconocido` };
        }
    } catch (error: any) {
        logger.error("Error en consultarUsuarioPorTelefono:", error);
        return { error: `Error de conexión: ${error.message}` };
    }
}

/**
 * Agregar un nuevo horario (REQUIERE usuario_telefono)
 */
export async function agregarHorario(data: HorarioData): Promise<HorarioResponse> {
    try {
        // Validaciones
        if (!data.usuario_telefono) {
            return { error: "Se requiere el número de teléfono del usuario" };
        }
        
        if (!validarFecha(data.fecha)) {
            return { error: "Formato de fecha inválido. Use YYYY-MM-DD (ejemplo: 2024-01-15)" };
        }
        
        if (!validarHora(data.hora_inicio)) {
            return { error: "Formato de hora_inicio inválido. Use HH:MM formato 24h (ejemplo: 10:00)" };
        }
        
        if (!validarHora(data.hora_fin)) {
            return { error: "Formato de hora_fin inválido. Use HH:MM formato 24h (ejemplo: 11:30)" };
        }
        
        if (!validarRangoHoras(data.hora_inicio, data.hora_fin)) {
            return { error: "La hora de inicio debe ser anterior a la hora de fin" };
        }
        
        // Normalizar teléfono
        const dataConTelefonoNormalizado = {
            ...data,
            usuario_telefono: normalizarTelefono(data.usuario_telefono)
        };
        
        const response = await fetch(`${API_BASE_URL}/horarios`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(dataConTelefonoNormalizado),
        });
        
        const result: HorarioResponse = await response.json();
        
        if (response.status === 201 || response.status === 200) {
            logger.info(`Horario creado exitosamente: ${result.id}`);
            return result;
        } else if (response.status === 403) {
            logger.warn(`Usuario bloqueado: ${data.usuario_telefono}`);
            return { ...result, error: "Usuario bloqueado por tener 3 o más strikes" };
        } else if (response.status === 409) {
            logger.warn(`Conflicto de horario: ${JSON.stringify(result)}`);
            return { ...result, error: "Conflicto de horario", conflicto: result };
        } else {
            logger.error(`Error al crear horario: ${response.status} - ${JSON.stringify(result)}`);
            return { error: result.message || `Error ${response.status}: ${result.error || "Error desconocido"}` };
        }
    } catch (error: any) {
        logger.error("Error en agregarHorario:", error);
        return { error: `Error de conexión: ${error.message}` };
    }
}

/**
 * Modificar un horario existente
 */
export async function modificarHorario(id: string, data: Partial<HorarioData>): Promise<HorarioResponse> {
    try {
        // Validar ID (debe ser ObjectId de MongoDB - 24 caracteres hexadecimales)
        if (!id || id.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(id)) {
            return { error: "ID inválido. Debe ser un ObjectId de MongoDB (24 caracteres hexadecimales)" };
        }
        
        // Validaciones opcionales
        if (data.fecha && !validarFecha(data.fecha)) {
            return { error: "Formato de fecha inválido. Use YYYY-MM-DD" };
        }
        
        if (data.hora_inicio && !validarHora(data.hora_inicio)) {
            return { error: "Formato de hora_inicio inválido. Use HH:MM formato 24h" };
        }
        
        if (data.hora_fin && !validarHora(data.hora_fin)) {
            return { error: "Formato de hora_fin inválido. Use HH:MM formato 24h" };
        }
        
        if (data.hora_inicio && data.hora_fin && !validarRangoHoras(data.hora_inicio, data.hora_fin)) {
            return { error: "La hora de inicio debe ser anterior a la hora de fin" };
        }
        
        // Normalizar teléfono si está presente
        const dataNormalizado = { ...data };
        if (data.usuario_telefono) {
            dataNormalizado.usuario_telefono = normalizarTelefono(data.usuario_telefono);
        }
        
        const response = await fetch(`${API_BASE_URL}/horarios/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(dataNormalizado),
        });
        
        const result: HorarioResponse = await response.json();
        
        if (response.status === 200) {
            logger.info(`Horario modificado exitosamente: ${id}`);
            return result;
        } else if (response.status === 404) {
            return { error: "Horario no encontrado" };
        } else if (response.status === 409) {
            return { ...result, error: "Conflicto de horario", conflicto: result };
        } else {
            logger.error(`Error al modificar horario: ${response.status} - ${JSON.stringify(result)}`);
            return { error: result.message || `Error ${response.status}: ${result.error || "Error desconocido"}` };
        }
    } catch (error: any) {
        logger.error("Error en modificarHorario:", error);
        return { error: `Error de conexión: ${error.message}` };
    }
}

/**
 * Eliminar un horario
 */
export async function eliminarHorario(id: string): Promise<HorarioResponse> {
    try {
        // Validar ID
        if (!id || id.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(id)) {
            return { error: "ID inválido. Debe ser un ObjectId de MongoDB (24 caracteres hexadecimales)" };
        }
        
        const response = await fetch(`${API_BASE_URL}/horarios/${id}`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
            },
        });
        
        const result: HorarioResponse = await response.json();
        
        if (response.status === 200) {
            logger.info(`Horario eliminado exitosamente: ${id}`);
            return result;
        } else if (response.status === 404) {
            return { error: "Horario no encontrado" };
        } else {
            logger.error(`Error al eliminar horario: ${response.status} - ${JSON.stringify(result)}`);
            return { error: result.message || `Error ${response.status}: ${result.error || "Error desconocido"}` };
        }
    } catch (error: any) {
        logger.error("Error en eliminarHorario:", error);
        return { error: `Error de conexión: ${error.message}` };
    }
}

/**
 * Marcar uso sin reserva (agrega 1 strike automáticamente)
 */
export async function marcarUsoSinReserva(idHorario: string, usuarioTelefono: string, usuarioNombre: string): Promise<{ message?: string; strikes?: number; error?: string }> {
    try {
        // Validar ID
        if (!idHorario || idHorario.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(idHorario)) {
            return { error: "ID de horario inválido" };
        }
        
        if (!usuarioTelefono) {
            return { error: "Se requiere el número de teléfono del usuario" };
        }
        
        if (!usuarioNombre || usuarioNombre.trim().length === 0) {
            return { error: "Se requiere el nombre del usuario" };
        }
        
        const telefonoNormalizado = normalizarTelefono(usuarioTelefono);
        
        const response = await fetch(`${API_BASE_URL}/horarios/${idHorario}/uso-sin-reserva`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                usuario_telefono: telefonoNormalizado,
                usuario_nombre: usuarioNombre.trim()
            }),
        });
        
        const result = await response.json();
        
        if (response.status === 200 || response.status === 201) {
            logger.info(`Uso sin reserva marcado: ${idHorario} - ${telefonoNormalizado}`);
            return { message: result.message || "Strike agregado por uso sin reserva", strikes: result.strikes || result.strikes_actuales };
        } else {
            logger.error(`Error al marcar uso sin reserva: ${response.status} - ${JSON.stringify(result)}`);
            return { error: result.message || result.error || `Error ${response.status}: Error desconocido` };
        }
    } catch (error: any) {
        logger.error("Error en marcarUsoSinReserva:", error);
        return { error: `Error de conexión: ${error.message}` };
    }
}

/**
 * Marcar no asistencia (agrega 1 strike automáticamente)
 */
export async function marcarNoAsistencia(idHorario: string): Promise<{ message?: string; strikes?: number; usuario?: any; error?: string }> {
    try {
        // Validar ID
        if (!idHorario || idHorario.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(idHorario)) {
            return { error: "ID de horario inválido" };
        }
        
        const response = await fetch(`${API_BASE_URL}/horarios/${idHorario}/no-asistio`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
        });
        
        const result = await response.json();
        
        if (response.status === 200 || response.status === 201) {
            logger.info(`No asistencia marcada: ${idHorario}`);
            return { 
                message: result.message || "Strike agregado por no asistencia",
                strikes: result.strikes || result.strikes_actuales,
                usuario: result.usuario
            };
        } else if (response.status === 404) {
            return { error: "Horario no encontrado" };
        } else {
            logger.error(`Error al marcar no asistencia: ${response.status} - ${JSON.stringify(result)}`);
            return { error: result.message || result.error || `Error ${response.status}: Error desconocido` };
        }
    } catch (error: any) {
        logger.error("Error en marcarNoAsistencia:", error);
        return { error: `Error de conexión: ${error.message}` };
    }
}

/**
 * Registrar strike por no respetar horario
 */
export async function registrarStrikePorNoRespetarHorario(idHorario: string, motivo: string): Promise<{ message?: string; strikes?: number; error?: string }> {
    try {
        // Validar ID
        if (!idHorario || idHorario.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(idHorario)) {
            return { error: "ID de horario inválido" };
        }
        
        if (!motivo || motivo.trim().length === 0) {
            return { error: "Se requiere un motivo para el strike" };
        }
        
        const response = await fetch(`${API_BASE_URL}/horarios/${idHorario}/strike`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                motivo: motivo.trim()
            }),
        });
        
        const result = await response.json();
        
        if (response.status === 200 || response.status === 201) {
            logger.info(`Strike registrado por no respetar horario: ${idHorario} - ${motivo}`);
            return { 
                message: result.message || "Strike agregado por no respetar horario",
                strikes: result.strikes || result.strikes_actuales
            };
        } else if (response.status === 404) {
            return { error: "Horario no encontrado" };
        } else {
            logger.error(`Error al registrar strike: ${response.status} - ${JSON.stringify(result)}`);
            return { error: result.message || result.error || `Error ${response.status}: Error desconocido` };
        }
    } catch (error: any) {
        logger.error("Error en registrarStrikePorNoRespetarHorario:", error);
        return { error: `Error de conexión: ${error.message}` };
    }
}

/**
 * Consultar horarios (con filtros opcionales)
 */
export async function consultarHorarios(filtros?: { fecha?: string; estado?: string }): Promise<{ data?: any[]; error?: string }> {
    try {
        const params = new URLSearchParams();
        
        if (filtros?.fecha) {
            if (!validarFecha(filtros.fecha)) {
                return { error: "Formato de fecha inválido en filtro. Use YYYY-MM-DD" };
            }
            params.append("fecha", filtros.fecha);
        }
        
        if (filtros?.estado) {
            params.append("estado", filtros.estado);
        }
        
        const response = await fetch(`${API_BASE_URL}/horarios${params.toString() ? '?' + params.toString() : ''}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        });
        
        const result = await response.json();
        
        if (response.status === 200) {
            logger.info(`Horarios consultados exitosamente`);
            return { data: Array.isArray(result) ? result : result.data || [] };
        } else {
            logger.error(`Error al consultar horarios: ${response.status} - ${JSON.stringify(result)}`);
            return { error: result.message || `Error ${response.status}: ${result.error || "Error desconocido"}` };
        }
    } catch (error: any) {
        logger.error("Error en consultarHorarios:", error);
        return { error: `Error de conexión: ${error.message}` };
    }
}

/**
 * Buscar horario por fecha y hora aproximada
 */
export async function buscarHorarioPorFechaHora(fecha: string, hora?: string): Promise<{ id?: string; horario?: any; error?: string }> {
    try {
        const { data, error } = await consultarHorarios({ fecha });
        
        if (error) {
            return { error };
        }
        
        if (!data || data.length === 0) {
            return { error: "No se encontraron horarios para la fecha especificada" };
        }
        
        // Si se proporciona hora, buscar el más cercano
        if (hora && validarHora(hora)) {
            const [hBuscada, mBuscada] = hora.split(':').map(Number);
            const minutosBuscada = hBuscada * 60 + mBuscada;
            
            // Buscar horario que coincida mejor con la hora
            const horarioEncontrado = data.find((h: any) => {
                if (!h.hora_inicio) return false;
                const [hInicio, mInicio] = h.hora_inicio.split(':').map(Number);
                const minutosInicio = hInicio * 60 + mInicio;
                // Diferencia de máximo 30 minutos
                return Math.abs(minutosInicio - minutosBuscada) <= 30;
            });
            
            if (horarioEncontrado) {
                return { id: horarioEncontrado.id || horarioEncontrado._id, horario: horarioEncontrado };
            }
        }
        
        // Si no hay hora o no se encontró coincidencia, devolver el primero
        const primerHorario = data[0];
        return { id: primerHorario.id || primerHorario._id, horario: primerHorario };
    } catch (error: any) {
        logger.error("Error en buscarHorarioPorFechaHora:", error);
        return { error: `Error de conexión: ${error.message}` };
    }
}

