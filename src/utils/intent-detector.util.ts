import { aiCompletion } from "./ai-fallback.util";
import logger from "../configs/logger.config";

export type IntentType = 
    | 'ticket'           // Crear o consultar ticket
    | 'greeting'         // Saludo simple
    | 'help'             // Solicita ayuda
    | 'project'           // Consulta sobre proyectos
    | 'task'              // Consulta sobre tareas
    | 'report'            // Solicita reportes
    | 'reservation'       // Reserva de sala
    | 'rh'                // Comandos de RH
    | 'admin'             // Comandos administrativos
    | 'sheets'            // Comandos de Google Sheets
    | 'conversation'      // Conversación general que necesita IA
    | 'it_support'        // Problema técnico que requiere ticket
    | 'unknown';          // No se puede determinar

export interface IntentAnalysis {
    intent: IntentType;
    confidence: number;
    shouldUseAI: boolean;
    suggestedAction?: string;
    extractedInfo?: Record<string, any>;
}

/**
 * Analiza un mensaje usando IA para determinar la intención del usuario
 * de manera más inteligente que solo keywords
 */
export async function analyzeIntent(message: string, userRole?: string): Promise<IntentAnalysis> {
    const lowerMessage = message.toLowerCase().trim();
    const normalizedMessage = message.trim();

    // Si el mensaje está vacío o es muy corto, es probablemente un saludo
    if (!normalizedMessage || normalizedMessage.length <= 3) {
        return {
            intent: 'greeting',
            confidence: 0.9,
            shouldUseAI: false
        };
    }

    // Análisis rápido con keywords para casos obvios (más rápido)
    const quickCheck = quickIntentCheck(lowerMessage, normalizedMessage, userRole);
    if (quickCheck.confidence > 0.85) {
        return quickCheck;
    }

    // Solo usar IA si la confianza es baja (< 0.7) y el mensaje es ambiguo
    // Esto evita llamadas innecesarias a la IA
    if (quickCheck.confidence < 0.7 && normalizedMessage.length > 10) {
        try {
            const aiAnalysis = await analyzeWithAI(normalizedMessage, userRole);
            // Solo usar si la IA tiene mayor confianza
            if (aiAnalysis.confidence > quickCheck.confidence) {
                return aiAnalysis;
            }
        } catch (error) {
            logger.warn('Error en análisis de intención con IA, usando análisis básico:', error);
        }
    }
    
    return quickCheck;
}

/**
 * Verificación rápida con keywords para casos obvios
 */
function quickIntentCheck(
    lowerMessage: string, 
    normalizedMessage: string,
    userRole?: string
): IntentAnalysis {
    
    // Comandos explícitos
    if (lowerMessage.startsWith('!ticket') || lowerMessage === 'ticket' || lowerMessage === '1') {
        return { intent: 'ticket', confidence: 0.95, shouldUseAI: false, suggestedAction: 'create_ticket' };
    }
    
    if (lowerMessage.startsWith('!proyectos') || lowerMessage.includes('proyectos')) {
        return { intent: 'project', confidence: 0.9, shouldUseAI: false };
    }
    
    if (lowerMessage.startsWith('!rh') || (userRole?.startsWith('rh') && (lowerMessage.includes('alta') || lowerMessage.includes('baja')))) {
        return { intent: 'rh', confidence: 0.95, shouldUseAI: false };
    }
    
    if (lowerMessage.includes('reservar') || lowerMessage.includes('sala') || lowerMessage.includes('horario')) {
        return { intent: 'reservation', confidence: 0.85, shouldUseAI: false };
    }
    
    // Saludos simples
    const simpleGreetings = ['hola', 'hi', 'hello', 'hey', 'buenos dias', 'buen dia', 'buenas tardes', 'buenas noches'];
    if (simpleGreetings.some(g => lowerMessage.startsWith(g) && normalizedMessage.length <= 30)) {
        return { intent: 'greeting', confidence: 0.9, shouldUseAI: false };
    }
    
    // Detección mejorada de problemas IT
    const itKeywords = [
        'no funciona', 'se cayó', 'se cae', 'error', 'problema', 'falla', 'se rompió',
        'impresora', 'pos', 'correo', 'email', 'internet', 'wifi', 'red', 'conexión',
        'computadora', 'laptop', 'pc', 'equipo', 'software', 'programa', 'aplicación',
        'acceso', 'password', 'contraseña', 'backup', 'servidor', 'no imprime',
        'no puedo', 'no puedo acceder', 'no abre', 'se cuelga', 'lento'
    ];
    
    const problemPhrases = [
        'no funciona', 'se cayó', 'se cae', 'error', 'problema', 'falla', 
        'se rompió', 'no puedo', 'no imprime', 'no abre', 'se cuelga'
    ];
    
    if (itKeywords.some(keyword => lowerMessage.includes(keyword))) {
        // Si menciona problema IT directamente, alta confianza de ticket
        if (problemPhrases.some(phrase => lowerMessage.includes(phrase))) {
            return { 
                intent: 'it_support', 
                confidence: 0.92, 
                shouldUseAI: false,
                suggestedAction: 'create_ticket'
            };
        }
        // Si menciona tecnología IT pero sin problema explícito, moderada confianza
        return { intent: 'it_support', confidence: 0.75, shouldUseAI: false };
    }
    
    // Detección de consultas sobre proyectos/tareas
    const projectKeywords = [
        'proyectos', 'proyecto', 'tareas', 'tarea', 'avance', 'progreso',
        'estado proyecto', 'estado de proyecto', 'qué proyectos', 'ver proyectos'
    ];
    
    if (projectKeywords.some(keyword => lowerMessage.includes(keyword))) {
        return { intent: 'project', confidence: 0.85, shouldUseAI: false };
    }
    
    // Detección de ayuda/comandos
    const helpKeywords = [
        'ayuda', 'help', 'comandos', 'qué puedo', 'qué se puede', 
        'cómo funciona', 'cómo usar', 'instrucciones'
    ];
    
    if (helpKeywords.some(keyword => lowerMessage.includes(keyword))) {
        return { intent: 'help', confidence: 0.85, shouldUseAI: false };
    }
    
    // Si es muy corto y no es comando, probablemente necesita contexto
    if (normalizedMessage.length < 15 && !lowerMessage.startsWith('!')) {
        return { intent: 'conversation', confidence: 0.6, shouldUseAI: true };
    }
    
    // Por defecto, es conversación que necesita IA
    return { intent: 'conversation', confidence: 0.5, shouldUseAI: true };
}

/**
 * Usa IA para analizar intenciones de manera más inteligente
 */
async function analyzeWithAI(message: string, userRole?: string): Promise<IntentAnalysis> {
    // Prompt más corto y eficiente para análisis de intenciones
    const prompt = `Analiza este mensaje de WhatsApp para bot de soporte IT "San Cosme Orgánico".

Rol usuario: ${userRole || 'user'}

Mensaje: "${message}"

Responde SOLO JSON válido:
{"intent":"ticket|greeting|help|project|task|report|reservation|rh|admin|sheets|conversation|it_support|unknown","confidence":0.0-1.0,"shouldUseAI":true|false}

Intenciones:
- ticket: crear/consultar ticket soporte
- it_support: problema técnico claro
- project: consultar proyectos
- greeting: saludo simple
- help: solicita ayuda/comandos
- conversation: mensaje general que necesita IA

Solo JSON:`;

    try {
        const result = await aiCompletion(prompt);
        const responseText = result.text.trim();
        
        // Intentar extraer JSON de la respuesta
        let jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            // Si no hay JSON, intentar parsear toda la respuesta
            jsonMatch = [responseText];
        }
        
        const parsed = JSON.parse(jsonMatch[0]);
        
        return {
            intent: parsed.intent || 'unknown',
            confidence: parsed.confidence || 0.5,
            shouldUseAI: parsed.shouldUseAI !== false,
            suggestedAction: parsed.suggestedAction,
            extractedInfo: parsed.extractedInfo
        };
    } catch (error) {
        logger.warn('Error parseando respuesta de IA para análisis de intención:', error);
        // Fallback a análisis básico
        return quickIntentCheck(message.toLowerCase(), message, userRole);
    }
}

