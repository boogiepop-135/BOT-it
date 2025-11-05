import { Message } from "whatsapp-web.js";
import { languages, translateText } from "../utils/translate.util";
import logger from "../configs/logger.config";
import { AppConfig } from "../configs/app.config";
import { UserI18n } from "../utils/i18n.util";

export const run = async (message: Message, args: string[], userI18n: UserI18n) => {
    const lang = args.shift()?.toLowerCase();
    const query = args.join(" ");

    if (!lang || !query) {
        message.reply('> Levi Assistant 💻 Por favor proporciona un código de idioma y un mensaje para traducir.');
        return;
    }

    if (!Object.keys(languages).includes(lang)) {
        message.reply('> Levi Assistant 💻 Código de idioma no soportado. Por favor usa un código de idioma válido.');
    }

    try {
        
        const payload: any = await translateText(query, lang);
        if (!payload) {
            message.reply('> Levi Assistant 💻 No se encontró traducción.');
            return;
        }

        message.reply(AppConfig.instance.printMessage(`Translated text : *${payload.text}*`));
    } catch (err) {
        logger.error(err);
        message.reply('> Levi Assistant 💻 Error de traducción.');
    }
};
