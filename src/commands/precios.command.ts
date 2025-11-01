import { Message, MessageMedia } from "whatsapp-web.js";
import { AppConfig } from "../configs/app.config";
import { UserI18n } from "../utils/i18n.util";

export const run = async (message: Message, args: string[], userI18n: UserI18n) => {
    const chat = await message.getChat();
    
    const precios = `
💰 *PRECIOS SAN COSME IT*

*PRECIO ESPECIAL* 🎯
💵 *$1,490 MXN* (antes $1,890)
   ⏰ Precio promocional por tiempo limitado
   💳 A 3 meses sin intereses

*INCLUYE TODO* ✅
✅ Compostero fermentador de 15 litros
✅ Biocatalizador (1 kg) - Ya incluido
✅ Envío gratis a todo México
✅ Acompañamiento personalizado
✅ Garantía de satisfacción

*BIOCATALIZADOR ADICIONAL* 🌿
💵 *$150 pesos por kg*
   📦 Rinde para 30 kg de residuos orgánicos
   🚚 Envío gratis a partir de 3 kg

*MÉTODOS DE PAGO* 💳

🏦 *Transferencia Bancaria:*
   Banco Azteca
   Cuenta: 127180013756372173
   Beneficiario: Aldair Eduardo Rivera García
   Concepto: [Tu nombre]

💳 *Tarjetas de Crédito:*
   A 3 meses sin intereses
   Enlace seguro: https://mpago.li/1W2JhS5

*¡Paga aquí con tarjeta!* 👆
https://mpago.li/1W2JhS5

*ENVÍO Y ENTREGA* 🚚
📦 Gratis a todo México
⏰ 5 a 7 días hábiles
📋 Seguimiento incluido

*GARANTÍAS* 🛡️
✅ Garantía de satisfacción
✅ Soporte técnico incluido
✅ Acompañamiento personalizado
✅ Reposición de piezas

*VIDEO DEMOSTRATIVO* 📹
https://youtube.com/shorts/Cap3U3eoLvY?si=M6E8icomSvMnK-L

¿Te interesa adquirir tu compostero fermentador? ¿Tienes alguna pregunta sobre el proceso de compra? 🌱
`;

    const media = MessageMedia.fromFilePath("public/precio.png");
    await message.reply(
        media,
        null,
        { caption: AppConfig.instance.printMessage(precios) },
    );
};
