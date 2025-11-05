import { GoogleGenerativeAI } from "@google/generative-ai";
import EnvConfig from "../configs/env.config";
import logger from "../configs/logger.config";

export type AIProvider = "gemini" | "claude";

export interface AIResponse {
    text: string;
    provider: AIProvider;
}

export const aiCompletion = async (query: string): Promise<AIResponse> => {
    // Intentar primero con Gemini
    try {
        if (EnvConfig.GEMINI_API_KEY) {
            const geminiResponse = await tryGemini(query);
            return {
                text: geminiResponse,
                provider: "gemini"
            };
        }
    } catch (error) {
        logger.warn(`Gemini falló: ${error.message}`);
    }

    // Si Gemini falla, intentar con Claude
    try {
        if (EnvConfig.ANTHROPIC_API_KEY) {
            const claudeResponse = await tryClaude(query);
            return {
                text: claudeResponse,
                provider: "claude"
            };
        }
    } catch (error) {
        logger.warn(`Claude falló: ${error.message}`);
    }

    // Si ambas fallan, devolver mensaje de error
    throw new Error("Todas las APIs de IA están temporalmente no disponibles. Por favor intenta de nuevo más tarde.");
};

const tryGemini = async (query: string): Promise<string> => {
    const genAI = new GoogleGenerativeAI(EnvConfig.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash-exp", // Modelo actualizado
        generationConfig: {
            maxOutputTokens: 400, // Optimizado para respuestas concisas pero completas
            temperature: 0.8, // Creatividad moderada
            topP: 0.9,
            topK: 40
        }
    });
    
    // Prompt optimizado para soporte IT
    const systemPrompt = `Eres el asistente virtual de IT de San Cosme Orgánico. Respondes en español con emojis apropiados. Sé profesional, amigable y conciso.

CONTEXTO:
- Empresa: San Cosme Orgánico (retail orgánico)
- Servicios IT: Soporte técnico, tickets, proyectos, reservas de sala
- Sucursales: Lomas, Decathlon, Centro Sur

CAPACIDADES:
- Crear tickets de soporte técnico
- Consultar proyectos y tareas
- Reservar salas de conferencias
- Ayudar con problemas técnicos (impresoras, POS, correo, internet, etc.)

TONO:
- Profesional pero cercano
- Empatía cuando hay problemas técnicos
- Proactivo en sugerir soluciones
- Si el usuario tiene un problema técnico claro, sugiere crear un ticket: "Te ayudo a crear un ticket para resolverlo. Escribe: !ticket"

CUANDO RESPONDER:
- Si es saludo simple: saluda cordialmente y ofrece ayuda breve
- Si menciona problema técnico: empatiza y sugiere crear ticket
- Si pregunta algo general: responde de forma útil y directa
- Si no entiendes: pide aclaración amablemente

SÉ CONCISO. Máximo 3-4 oraciones. Usa emojis relevantes pero no excesivos.`;

    const fullQuery = `${systemPrompt}\n\nUsuario: ${query}`;
    const result = await model.generateContent(fullQuery);
    return result.response.text() || 'No reply';
};

const tryClaude = async (query: string): Promise<string> => {
    const systemPrompt = `Eres el asistente virtual de IT de San Cosme Orgánico. Respondes en español con emojis apropiados. Sé profesional, amigable y conciso.

CONTEXTO:
- Empresa: San Cosme Orgánico (retail orgánico)
- Servicios IT: Soporte técnico, tickets, proyectos, reservas de sala
- Sucursales: Lomas, Decathlon, Centro Sur

CAPACIDADES:
- Crear tickets de soporte técnico
- Consultar proyectos y tareas
- Reservar salas de conferencias
- Ayudar con problemas técnicos (impresoras, POS, correo, internet, etc.)

TONO:
- Profesional pero cercano
- Empatía cuando hay problemas técnicos
- Proactivo en sugerir soluciones
- Si el usuario tiene un problema técnico claro, sugiere crear un ticket: "Te ayudo a crear un ticket para resolverlo. Escribe: !ticket"

CUANDO RESPONDER:
- Si es saludo simple: saluda cordialmente y ofrece ayuda breve
- Si menciona problema técnico: empatiza y sugiere crear ticket
- Si pregunta algo general: responde de forma útil y directa
- Si no entiendes: pide aclaración amablemente

SÉ CONCISO. Máximo 3-4 oraciones. Usa emojis relevantes pero no excesivos.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': EnvConfig.ANTHROPIC_API_KEY,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-3-haiku-20240307', // Modelo más económico
            max_tokens: 300, // Reducido aún más para ahorrar tokens
            messages: [
                {
                    role: 'user',
                    content: `${systemPrompt}\n\nUsuario: ${query}`
                }
            ]
        })
    });

    if (!response.ok) {
        throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.content[0].text || 'No reply';
};
