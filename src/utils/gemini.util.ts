import { GoogleGenerativeAI } from "@google/generative-ai";
import EnvConfig from "../configs/env.config";

export type GeminiModel = "gemini-2.0-flash-exp";
const genAI = new GoogleGenerativeAI(EnvConfig.GEMINI_API_KEY);

export const geminiCompletion = async (query: string, modelName: GeminiModel = "gemini-2.0-flash-exp") => {
    try {
        if (!EnvConfig.GEMINI_API_KEY) {
            throw new Error("API key de Gemini no configurada");
        }

        const model = genAI.getGenerativeModel({ 
            model: modelName,
            generationConfig: {
                maxOutputTokens: 400, // Optimizado para respuestas concisas pero completas
                temperature: 0.8, // Creatividad moderada
                topP: 0.9,
                topK: 40
            }
        });
        
        // Prompt optimizado y conciso para ahorrar tokens
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

SÉ CONCISO. Máximo 4-5 oraciones por respuesta, incluye emojis relevantes.`;

        const fullQuery = `${systemPrompt}\n\nUsuario: ${query}`;
        const result = await model.generateContent(fullQuery);
        return result;
    } catch (error) {
        console.error("Error en Gemini API:", error);
        throw new Error(`Error de comunicación con Gemini: ${error.message}`);
    }
};