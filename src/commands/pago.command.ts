import { Message, MessageMedia } from "whatsapp-web.js";
import { AppConfig } from "../configs/app.config";
import { UserI18n } from "../utils/i18n.util";

export const run = async (message: Message, args: string[], userI18n: UserI18n) => {
    const chat = await message.getChat();
    
    const pago = `
💳 *MÉTODOS DE PAGO SAN COSME IT*

*TRANSFERENCIA BANCARIA* 🏦
🏛️ *Banco:* Banco Azteca
📋 *Número de cuenta:* 127180013756372173
👤 *Beneficiario:* Aldair Eduardo Rivera García
📝 *Concepto:* [Coloca tu nombre completo]

*TARJETAS DE CRÉDITO* 💳
💳 A 3 meses sin intereses
🔗 *Enlace de pago:* https://mpago.li/1W2JhS5
🔒 Pago seguro y protegido
📱 Procesado por Mercado Pago

*¡Haz clic aquí para pagar con tarjeta!* 👆
https://mpago.li/1W2JhS5

*INFORMACIÓN IMPORTANTE* ⚠️
✅ Todos los pagos son seguros
✅ Recibirás confirmación inmediata
✅ Envío gratis a todo México
✅ Entrega de 5 a 7 días hábiles

*PROCESO DE COMPRA* 📦
1️⃣ Realiza tu pago
2️⃣ Envía comprobante por WhatsApp
3️⃣ Confirmamos tu pedido
4️⃣ Despachamos tu compostero
5️⃣ Recibes seguimiento de envío

*GARANTÍAS* 🛡️
✅ Garantía de satisfacción
✅ Soporte técnico incluido
✅ Acompañamiento personalizado
✅ Reposición de piezas si es necesario

*CONTACTO PARA PAGOS* 📱
📞 WhatsApp: +52 56 6453 1621
📧 Email: contacto@sancosmeit.com

¿Tienes alguna pregunta sobre el proceso de pago? ¿Te gustaría proceder con tu compra? 🌱
`;

    const media = MessageMedia.fromFilePath("public/pago.png");
    await message.reply(
        media,
        null,
        { caption: AppConfig.instance.printMessage(pago) },
    );
};
