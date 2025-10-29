import { Message, MessageMedia } from "whatsapp-web.js";
import { AppConfig } from "../configs/app.config";
import { UserI18n } from "../utils/i18n.util";

export const run = async (message: Message, args: string[], userI18n: UserI18n) => {
    const chat = await message.getChat();
    
    const contacto = `
🌱 *CONTACTO MÜLLBLUE*

*CANALES DE ATENCIÓN* 📱

📱 *WhatsApp:* +52 56 6453 1621
   Atención personalizada 24/7
   Asistencia inmediata para ventas
   Soporte técnico especializado

📧 *Email:* mullblue.residuos@gmail.com
   Consultas detalladas
   Soporte técnico avanzado
   Información corporativa

📘 *Facebook:* Composta fácil con Müllblue
   Comunidad activa de usuarios
   Tips y consejos de compostaje
   Testimonios de clientes

📸 *Instagram:* @mullblue.oficial
   Contenido visual del proceso
   Historias de éxito
   Tips diarios de sostenibilidad

*SERVICIOS DISPONIBLES* 🤖

🤖 *Asistente Virtual Müllblue*
   Disponible 24/7 por WhatsApp
   Guía paso a paso del proceso
   Respuestas inmediatas sobre productos
   Manejo de objeciones y consultas

👨‍💼 *Atención Personalizada*
   Acompañamiento durante todo el proceso
   Soporte especializado en compostaje
   Resolución de dudas técnicas
   Seguimiento post-venta

🚚 *Envíos y Logística*
   Gratis a todo México
   Entrega de 5 a 7 días hábiles
   Seguimiento de paquetes
   Empaque seguro y ecológico

*HORARIOS DE ATENCIÓN* 🕐
🕐 Lunes a Viernes: 9:00 - 18:00
🕐 Sábados: 10:00 - 14:00
🕐 Domingos: Solo WhatsApp (respuesta automática)

*INFORMACIÓN ADICIONAL* ℹ️
🌱 Especialistas en compostaje fermentador
🌱 Acompañamiento personalizado incluido
🌱 Garantía de satisfacción
🌱 Soporte técnico permanente

¡Estamos aquí para ayudarte a transformar tus residuos en vida! ¿En qué podemos asistirte hoy? 🌱✨
`;

    const media = MessageMedia.fromFilePath(AppConfig.instance.getBotAvatar("celebrating"));
    await message.reply(
        media,
        null,
        { sendVideoAsGif: true, caption: AppConfig.instance.printMessage(contacto) },
    );
};
