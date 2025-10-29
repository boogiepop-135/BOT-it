import { Message, MessageMedia } from "whatsapp-web.js";
import { AppConfig } from "../configs/app.config";
import { UserI18n } from "../utils/i18n.util";
import SalesTracker from "../utils/sales-tracker.util";

export const run = async (message: Message, args: string[], userI18n: UserI18n) => {
    const chat = await message.getChat();
    
    // Obtener estadísticas de ventas
    const stats = SalesTracker.getSalesStats();
    
    const estadisticas = `
📊 *ESTADÍSTICAS DE VENTAS MÜLLBLUE*

*RESUMEN GENERAL* 📈
👥 Usuarios únicos: ${stats.uniqueUsers}
💬 Total de interacciones: ${stats.totalInteractions}
📱 Promedio por usuario: ${Math.round(stats.totalInteractions / stats.uniqueUsers)}

*INTENCIONES DETECTADAS* 🎯
${Object.entries(stats.intentCounts)
    .map(([intent, count]) => {
        const emoji = {
            'info': 'ℹ️',
            'price': '💰',
            'product': '📦',
            'payment': '💳',
            'purchase': '🛒',
            'objection': '❓',
            'other': '💬'
        }[intent] || '💬';
        return `${emoji} ${intent}: ${count}`;
    })
    .join('\n')}

*TOP LEADS* 🏆
${stats.topLeads.map((lead, index) => 
    `${index + 1}. Usuario ${lead.userId.slice(-4)} - Puntuación: ${lead.score} (${lead.interactions} interacciones)`
).join('\n')}

*ANÁLISIS DE CONVERSIÓN* 📊
💰 Consultas de precio: ${stats.intentCounts.price || 0}
🛒 Intenciones de compra: ${stats.intentCounts.purchase || 0}
💳 Consultas de pago: ${stats.intentCounts.payment || 0}

*ÚLTIMA ACTUALIZACIÓN* ⏰
${new Date().toLocaleString('es-MX')}

¿Te gustaría ver más detalles sobre algún lead específico? 🌱
`;

    const media = MessageMedia.fromFilePath(AppConfig.instance.getBotAvatar("excited"));
    await message.reply(
        media,
        null,
        { sendVideoAsGif: true, caption: AppConfig.instance.printMessage(estadisticas) },
    );
};
