import { Message } from "whatsapp-web.js";
import logger from "../configs/logger.config";

interface SalesInteraction {
    userId: string;
    userName: string;
    timestamp: Date;
    message: string;
    intent: 'info' | 'price' | 'product' | 'payment' | 'objection' | 'purchase' | 'other';
    response: string;
}

class SalesTracker {
    private static interactions: SalesInteraction[] = [];
    private static leadScore: Map<string, number> = new Map();

    static trackInteraction(message: Message, userMessage: string, botResponse: string, intent: SalesInteraction['intent']) {
        const interaction: SalesInteraction = {
            userId: message.from,
            userName: (message as any)._data?.notifyName || 'Usuario',
            timestamp: new Date(),
            message: userMessage,
            intent: intent,
            response: botResponse
        };

        this.interactions.push(interaction);
        
        // Actualizar puntuación de lead
        this.updateLeadScore(message.from, intent);
        
        logger.info(`Sales interaction tracked: ${intent} from ${interaction.userName}`);
    }

    private static updateLeadScore(userId: string, intent: SalesInteraction['intent']) {
        const currentScore = this.leadScore.get(userId) || 0;
        let scoreIncrease = 0;

        switch (intent) {
            case 'info':
                scoreIncrease = 1;
                break;
            case 'price':
                scoreIncrease = 3;
                break;
            case 'product':
                scoreIncrease = 2;
                break;
            case 'payment':
                scoreIncrease = 5;
                break;
            case 'purchase':
                scoreIncrease = 10;
                break;
            case 'objection':
                scoreIncrease = 2; // Las objeciones pueden ser positivas si se resuelven
                break;
            default:
                scoreIncrease = 0;
        }

        this.leadScore.set(userId, currentScore + scoreIncrease);
    }

    static getLeadScore(userId: string): number {
        return this.leadScore.get(userId) || 0;
    }

    static getInteractions(userId: string): SalesInteraction[] {
        return this.interactions.filter(i => i.userId === userId);
    }

    static getTopLeads(limit: number = 10): Array<{userId: string, score: number, interactions: number}> {
        const userStats = new Map<string, {score: number, interactions: number}>();

        this.interactions.forEach(interaction => {
            const stats = userStats.get(interaction.userId) || {score: 0, interactions: 0};
            stats.score = this.getLeadScore(interaction.userId);
            stats.interactions++;
            userStats.set(interaction.userId, stats);
        });

        return Array.from(userStats.entries())
            .map(([userId, stats]) => ({userId, ...stats}))
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    static getSalesStats() {
        const totalInteractions = this.interactions.length;
        const uniqueUsers = new Set(this.interactions.map(i => i.userId)).size;
        const intentCounts = this.interactions.reduce((acc, interaction) => {
            acc[interaction.intent] = (acc[interaction.intent] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return {
            totalInteractions,
            uniqueUsers,
            intentCounts,
            topLeads: this.getTopLeads(5)
        };
    }

    static detectIntent(message: string): SalesInteraction['intent'] {
        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes('precio') || lowerMessage.includes('cuesta') || lowerMessage.includes('vale')) {
            return 'price';
        }
        if (lowerMessage.includes('producto') || lowerMessage.includes('kit')) {
            return 'product';
        }
        if (lowerMessage.includes('pago') || lowerMessage.includes('comprar') || lowerMessage.includes('transferencia')) {
            return 'payment';
        }
        if (lowerMessage.includes('comprar') || lowerMessage.includes('quiero') || lowerMessage.includes('me interesa')) {
            return 'purchase';
        }
        if (lowerMessage.includes('caro') || lowerMessage.includes('costoso') || lowerMessage.includes('no puedo')) {
            return 'objection';
        }
        if (lowerMessage.includes('info') || lowerMessage.includes('información') || lowerMessage.includes('cómo')) {
            return 'info';
        }

        return 'other';
    }
}

export default SalesTracker;
