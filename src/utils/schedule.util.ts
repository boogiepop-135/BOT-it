/**
 * Utilidad para verificar horario de atención
 * Horario: Lunes a Viernes, 9:00 AM - 5:00 PM (horario de México)
 */

export interface ScheduleConfig {
    startHour: number; // 9
    endHour: number; // 17 (5 PM)
    timezone: string; // 'America/Mexico_City'
}

export class ScheduleUtil {
    private static defaultConfig: ScheduleConfig = {
        startHour: 9,
        endHour: 17,
        timezone: 'America/Mexico_City'
    };

    /**
     * Verifica si la fecha actual está dentro del horario de atención
     */
    static isBusinessHours(config: ScheduleConfig = this.defaultConfig): boolean {
        const now = new Date();
        const mexicoDate = new Date(now.toLocaleString('en-US', { timeZone: config.timezone }));
        
        const day = mexicoDate.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
        const hour = mexicoDate.getHours();
        
        // Solo Lunes a Viernes (1-5)
        if (day === 0 || day === 6) {
            return false;
        }
        
        // Verificar horario: 9 AM - 5 PM
        return hour >= config.startHour && hour < config.endHour;
    }

    /**
     * Obtiene el mensaje de fuera de horario
     */
    static getOffHoursMessage(language: string = 'es'): string {
        const messages: Record<string, string> = {
            es: `🕐 *Fuera de horario de atención*

Nuestro horario de atención es:
📅 *Lunes a Viernes*
🕐 *9:00 AM - 5:00 PM*

Tu mensaje ha sido recibido y será atendido en el próximo horario hábil.

¡Gracias por tu paciencia! 😊`,
            en: `🕐 *Outside business hours*

Our business hours are:
📅 *Monday to Friday*
🕐 *9:00 AM - 5:00 PM*

Your message has been received and will be attended during the next business hours.

Thank you for your patience! 😊`,
            fr: `🕐 *Hors des heures de bureau*

Nos heures d'ouverture sont:
📅 *Lundi au Vendredi*
🕐 *9h00 - 17h00*

Votre message a été reçu et sera traité pendant les prochaines heures ouvrables.

Merci de votre patience ! 😊`
        };

        return messages[language] || messages.es;
    }

    /**
     * Obtiene la próxima fecha/hora de atención
     */
    static getNextBusinessHours(config: ScheduleConfig = this.defaultConfig): Date {
        const now = new Date();
        const mexicoDate = new Date(now.toLocaleString('en-US', { timeZone: config.timezone }));
        
        let nextBusinessDay = new Date(mexicoDate);
        nextBusinessDay.setHours(config.startHour, 0, 0, 0);
        
        const day = mexicoDate.getDay();
        
        // Si es sábado (6), el próximo día hábil es lunes
        if (day === 6) {
            nextBusinessDay.setDate(nextBusinessDay.getDate() + 2);
        }
        // Si es domingo (0), el próximo día hábil es lunes
        else if (day === 0) {
            nextBusinessDay.setDate(nextBusinessDay.getDate() + 1);
        }
        // Si es después del horario de trabajo (después de las 5 PM)
        else if (mexicoDate.getHours() >= config.endHour) {
            nextBusinessDay.setDate(nextBusinessDay.getDate() + 1);
        }
        // Si es antes del horario de trabajo (antes de las 9 AM)
        else if (mexicoDate.getHours() < config.startHour) {
            // Ya está configurado para hoy a las 9 AM
        }
        
        return nextBusinessDay;
    }
}

