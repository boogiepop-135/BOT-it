import { Message } from "whatsapp-web.js";
import { languages } from "../utils/translate.util";
import { UserI18n } from "../utils/i18n.util";

export const run = (message: Message, _args: string[] = null, userI18n: UserI18n) => {
    let table = "";
    let tableLength = 0;

    Object.keys(languages).forEach((key, index) => {
        table += `${key} - ${languages[key]}\n`;
        tableLength = index + 1;
    });

    message.reply(`> Müllblue Bot 🌱 Códigos de idiomas disponibles (${tableLength}) - :\n ${table}`);
};
