import { Message, MessageMedia } from "whatsapp-web.js";
import { AppConfig } from "../configs/app.config";
import { UserI18n } from "../utils/i18n.util";

export const run = async (message: Message, args: string[], userI18n: UserI18n) => {
    const chat = await message.getChat();
    
    const guia = `
📖 *GUÍA COMPLETA SAN COSME IT*

*CÓMO FUNCIONA EL SISTEMA* 🔄
1️⃣ *Depositar* - Coloca tus residuos orgánicos
2️⃣ *Espolvorear* - Añade biocatalizador (50g por kg de residuos)
3️⃣ *Compactar* - Presiona para eliminar aire
4️⃣ *Tapar* - Cierra herméticamente
5️⃣ *Repetir* - Hasta llenar el compostero

*¿QUÉ PUEDO AGREGAR?* ✅
• Cáscaras de frutas y verduras
• Restos de comida cocinada
• Restos de carnes y pescados (poca cantidad)
• Lácteos como quesos, yogurt (poca cantidad)
• Pan, arroz, pasta y cereales
• Cáscaras de huevo y café molido
• Filtros de café compostable

*¿QUÉ NO PUEDO AGREGAR?* ❌
• Estampas de frutas
• Huesos de animales
• Semillas grandes (mango, aguacate)
• Aceite o manteca
• Líquidos en exceso
• Plásticos, metales, vidrio
• Heces de mascotas
• Residuos sanitarios

*CANTIDAD DE BIOCATALIZADOR* 🌿
🌿 50g por cada kg de residuos frescos
🌿 80g por cada cubeta de 5 litros
🌿 2 palas por cada cubeta de 5 litros

*PROCESO COMPLETO* ⏰
🕐 *Llenado:* 4-6 semanas (familia 3-5 personas)
🕐 *Fermentación:* 2 semanas adicionales
🕐 *Maduración:* Enterrar en tierra o compostera
🕐 *Resultado:* Tierra fértil más rápido que métodos tradicionales

*¿QUÉ HACER CON EL LÍQUIDO?* 💧
💧 Diluir 1 litro de biofertilizante en 18 litros de agua
💧 Añadir 2 cucharadas de bicarbonato
💧 Usar para fertilizar plantas

*CARACTERÍSTICAS DEL SISTEMA* 🔧
🔹 Sistema anaeróbico (sin oxígeno)
🔹 Debe estar bien tapado
🔹 Dimensiones: 30 x 30 x 40 cm
🔹 Capacidad: 15 litros máximo

*BENEFICIOS PRINCIPALES* ✨
🔹 Reduce residuos hasta 2.5 veces
🔹 Sin malos olores ni plagas
🔹 Genera biofertilizante líquido
🔹 Proceso más rápido que compostaje tradicional

¿Tienes alguna duda específica sobre el proceso? ¿Te gustaría saber más sobre algún paso en particular? 🌱
`;

    const media = MessageMedia.fromFilePath(AppConfig.instance.getBotAvatar("friendly"));
    await message.reply(
        media,
        null,
        { sendVideoAsGif: true, caption: AppConfig.instance.printMessage(guia) },
    );
};
