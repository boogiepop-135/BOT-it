import { Message, MessageMedia } from "whatsapp-web.js";
import { AppConfig } from "../configs/app.config";
import { UserI18n } from "../utils/i18n.util";

export const run = async (message: Message, args: string[], userI18n: UserI18n) => {
    const chat = await message.getChat();
    
    const tarjeta = `
💳 *PAGO CON TARJETA DE CRÉDITO* 💳

*INFORMACIÓN DEL PAGO* 💰
💵 *Monto:* $1,490 MXN
💳 *A 3 meses sin intereses*
🔒 *Pago 100% seguro*
📱 *Procesado por Mercado Pago*

*¡HAZ CLIC AQUÍ PARA PAGAR!* 👆
https://mpago.li/1W2JhS5

*PROCESO DE PAGO* 📋
1️⃣ Haz clic en el enlace de arriba
2️⃣ Completa tus datos de tarjeta
3️⃣ Confirma el pago
4️⃣ Recibe confirmación inmediata
5️⃣ Envía comprobante por WhatsApp

*BENEFICIOS* ✅
✅ Pago seguro y protegido
✅ Confirmación inmediata
✅ Envío gratis incluido
✅ Acompañamiento personalizado

*CONTACTO POST-PAGO* 📱
📞 WhatsApp: [Tu número]
📧 Email: [Tu email]

¿Tienes alguna duda sobre el proceso de pago? ¿Necesitas ayuda con algún paso? 🌱
`;

    const media = MessageMedia.fromFilePath("public/como-comprar.png");
    await message.reply(
        media,
        null,
        { caption: AppConfig.instance.printMessage(tarjeta) },
    );
};
