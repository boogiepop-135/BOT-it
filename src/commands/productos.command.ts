import { Message, MessageMedia } from "whatsapp-web.js";
import { AppConfig } from "../configs/app.config";
import { UserI18n } from "../utils/i18n.util";

export const run = async (message: Message, args: string[], userI18n: UserI18n) => {
    const chat = await message.getChat();
    
    const productos = `
📦 *PRODUCTOS SAN COSME IT*

*PROPUESTA DE VALOR* 💚
Reduce tus residuos orgánicos hasta 2.5 veces y los fermenta en poco espacio, de forma limpia y sin malos olores, plagas ni escurrimientos, gracias a su biocatalizador natural.

*BENEFICIOS PRINCIPALES* ✨
🔹 Reduce residuos orgánicos hasta 2.5 veces
🔹 Elimina malos olores, plagas y escurrimientos
🔹 Genera hasta 3 litros de biofertilizante líquido por llenado
🔹 Acelera la obtención de composta en menos tiempo
🔹 Acompañamiento personalizado incluido

*QUÉ INCLUYE EL KIT* 📦
✅ Compostero fermentador de 15 litros
   - Hermético, sin fugas
   - Dimensiones: 30 x 30 x 40 cm
   - Capacidad máxima de 15 litros

✅ Biocatalizador (1 kg)
   - Rinde para dos llenados del compostero
   - Para 30 kg de residuos orgánicos
   - Produce hasta 6 litros de biofertilizante
   - Evita malos olores y reduce volumen

✅ Envío gratis a todo México
✅ Acompañamiento personalizado

*CÓMO FUNCIONA* 🔄
1️⃣ Depositar tus residuos orgánicos
2️⃣ Espolvorear el biocatalizador
3️⃣ Compactar
4️⃣ Tapar y repetir hasta llenar

*TIEMPO DE LLENADO* ⏰
Para una familia de 3 a 5 personas: 4 a 6 semanas

*PROCESO COMPLETO* 🌱
- Fermentación: 2 semanas
- Maduración: Enterrar en tierra o compostera
- Resultado: Tierra fértil más rápido que métodos tradicionales

¿Te gustaría conocer más detalles sobre el funcionamiento o tienes alguna pregunta específica? 🌱
`;

    const media = MessageMedia.fromFilePath("public/info.png");
    await message.reply(
        media,
        null,
        { caption: AppConfig.instance.printMessage(productos) },
    );
};
