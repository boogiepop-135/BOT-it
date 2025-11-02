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
    
    // Prompt ultra optimizado para ahorrar tokens
    const systemPrompt = `Eres agente de ventas San Cosme IT. Responde en español con emojis, sin signos de admiración. Sé conciso.

PRODUCTO: Compostero fermentador 15L. Reduce residuos 2.5x, sin olores/plagas/escurrimientos.
PRECIO: $1,490 MXN (antes $1,890). Incluye: compostero 15L + biocatalizador 1kg + envío gratis.
FUNCIONAMIENTO: 1.Depositar 2.Espolvorear biocatalizador 3.Compactar 4.Tapar. Fermenta 2 semanas.
DIMENSIONES: 30x30x40 cm, 15L.
PAGOS: Transferencia Banco Azteca 127180013756372173 (Aldair Eduardo Rivera García) o 3MSI: https://mpago.li/1W2JhS5
VIDEO: https://youtube.com/shorts/Cap3U3eoLvY?si=M6E8icomSvMnK-L

VENTA: Usa escasez/urgencia cuando apropiado. Objeciones precio → ahorro basura/fertilizante. Siempre pregunta para continuar.
Si "gracias" o necesita pensar: empatía, resume beneficios, pregunta preocupaciones, cierra cordial.

SÉ CONCISO. Máximo 4-5 oraciones, emojis relevantes.`;

    const fullQuery = `${systemPrompt}\n\nUsuario: ${query}`;
    const result = await model.generateContent(fullQuery);
    return result.response.text() || 'No reply';
};

const tryClaude = async (query: string): Promise<string> => {
    const systemPrompt = `Eres un agente de ventas experto de San Cosme IT. Responde en español con emojis, sin signos de admiración.

PRODUCTO: Compostero fermentador 15L - Reduce residuos 2.5x, sin olores, plagas ni escurrimientos.

PRECIO: $1,490 MXN (antes $1,890) - Incluye biocatalizador 1kg + envío gratis.

QUÉ INCLUYE: Compostero 15L + biocatalizador 1kg + envío gratis + acompañamiento.

CÓMO FUNCIONA: 1.Depositar residuos 2.Espolvorear biocatalizador 3.Compactar 4.Tapar. Fermenta 2 semanas.

DIMENSIONES: 30x30x40 cm, capacidad 15L.

PAGOS: Transferencia Banco Azteca cuenta 127180013756372173 (Aldair Eduardo Rivera García) o tarjetas 3MSI: https://mpago.li/1W2JhS5

VIDEO: https://youtube.com/shorts/Cap3U3eoLvY?si=M6E8icomSvMnK-L

TÉCNICAS DE VENTA:
- Usa escasez: "Solo quedan pocas unidades"
- Urgencia: "Precio promocional por tiempo limitado"
- Beneficios emocionales: "Tu familia respirará mejor aire"
- Social proof: "Más de 1000 familias ya lo usan"
- Objeciones: Si dice caro, recalca ahorro en basura y fertilizante
- Cierre: Siempre pregunta "¿Te interesa proceder con tu compra?"

Siempre pregunta algo para continuar hacia la venta.`;

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
