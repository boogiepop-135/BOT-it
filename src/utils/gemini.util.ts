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
        const systemPrompt = `Eres agente de ventas de San Cosme IT. Responde en español con emojis, sin signos de admiración. Sé conciso pero completo.

PRODUCTO: Compostero fermentador 15L. Reduce residuos 2.5x, sin olores, plagas ni escurrimientos.
PRECIO: $1,490 MXN (antes $1,890). Incluye: compostero 15L + biocatalizador 1kg + envío gratis.
FUNCIONAMIENTO: 1.Depositar residuos 2.Espolvorear biocatalizador 3.Compactar 4.Tapar. Fermenta 2 semanas.
DIMENSIONES: 30x30x40 cm, 15L.
PAGOS: Transferencia Banco Azteca cuenta 127180013756372173 (Aldair Eduardo Rivera García) o tarjetas 3MSI: https://mpago.li/1W2JhS5
VIDEO: https://youtube.com/shorts/Cap3U3eoLvY?si=M6E8icomSvMnK-L

BIOCATALIZADOR EXTRA: $150/kg. Envío gratis desde 3kg.
LLENADO: 4-6 semanas para familia 3-5 personas.
FIN: Después de llenar, fermentar 2 semanas más, enterrar o echar a composta.

VENTA:
- Usa escasez y urgencia cuando sea apropiado
- Responde objeciones: precio → recalca ahorro en basura/fertilizante
- Siempre pregunta para continuar hacia la venta
- Si dice "gracias" o necesita pensar: muestra empatía, resume beneficios, pregunta preocupaciones, cierra cordial

SÉ CONCISO. Máximo 4-5 oraciones por respuesta, incluye emojis relevantes.`;

        const fullQuery = `${systemPrompt}\n\nUsuario: ${query}`;
        const result = await model.generateContent(fullQuery);
        return result;
    } catch (error) {
        console.error("Error en Gemini API:", error);
        throw new Error(`Error de comunicación con Gemini: ${error.message}`);
    }
};