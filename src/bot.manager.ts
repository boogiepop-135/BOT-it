import { Client, Message, MessageTypes } from "whatsapp-web.js";
import { AppConfig } from "./configs/app.config";
import { ClientConfig } from "./configs/client.config";
import logger from "./configs/logger.config";
import { UserI18n } from "./utils/i18n.util";
import commands from "./commands";
import { isUrl } from "./utils/common.util";
import { identifySocialNetwork, YtDlpDownloader } from "./utils/get.util";
import { onboard } from "./utils/onboarding.util";
import { ContactModel } from "./crm/models/contact.model";
const qrcode = require('qrcode-terminal');

export class BotManager {
    private static instance: BotManager;
    public client: any;
    public qrData = {
        qrCodeData: "",
        qrScanned: false
    };
    private userI18nCache = new Map<string, UserI18n>();
    private prefix = AppConfig.instance.getBotPrefix();
    private isPaused: boolean = false;

    private constructor() {
        // El cliente se inicializará de forma asíncrona
        // No podemos crear el cliente aquí porque getClientConfig es asíncrono
        // Por eso usamos initializeClient() que se llamará después de conectar a MongoDB
    }

    public async initializeClient() {
        if (!this.client) {
            const clientConfig = await getClientConfig();
            this.client = new Client(clientConfig);
            this.setupEventHandlers();
        }
    }

    public async listGroups() {
        try {
            if (!this.client) {
                await this.initializeClient();
            }
            const chats = await this.client.getChats();
            const groups = chats.filter((c: any) => c.isGroup);
            return groups.map((g: any) => ({
                id: g.id?._serialized,
                name: g.name,
                participants: Array.isArray(g.participants) ? g.participants.length : undefined
            }));
        } catch (error) {
            logger.error('Failed to list groups:', error);
            return [];
        }
    }

    public async sendMessageToGroupById(groupId: string, message: string) {
        try {
            if (!this.client) {
                await this.initializeClient();
            }
            const chatId = groupId.includes('@g.us') ? groupId : `${groupId}@g.us`;
            await this.client.sendMessage(chatId, message);
            logger.info(`Message sent to group ${chatId}`);
            return true;
        } catch (error) {
            logger.error(`Failed to send message to group ${groupId}:`, error);
            return false;
        }
    }

    public async sendMessageToGroupByName(groupName: string, message: string) {
        try {
            if (!this.client) {
                await this.initializeClient();
            }
            const chats = await this.client.getChats();
            const group = chats.find((c: any) => c.isGroup && typeof c.name === 'string' && c.name.toLowerCase() === groupName.toLowerCase());
            if (!group) {
                logger.warn(`Group not found by name: ${groupName}`);
                return false;
            }
            await this.client.sendMessage(group.id._serialized, message);
            logger.info(`Message sent to group by name ${groupName}`);
            return true;
        } catch (error) {
            logger.error(`Failed to send message to group by name ${groupName}:`, error);
            return false;
        }
    }

    public static getInstance(): BotManager {
        if (!BotManager.instance) {
            BotManager.instance = new BotManager();
        }
        return BotManager.instance;
    }

    private setupEventHandlers() {
        console.log("Setting up event handlers...");
        this.client.on('ready', this.handleReady.bind(this));
        this.client.on('qr', this.handleQr.bind(this));
        this.client.on('message_create', this.handleMessage.bind(this));
        this.client.on('disconnected', this.handleDisconnect.bind(this));
    }


    private async handleReady() {
        this.qrData.qrScanned = true;
        logger.info("Client is ready!");

        try {
            await YtDlpDownloader.getInstance().initialize();
        } catch (error) {
            logger.error("Downloader check failed:", error);
        }
    }

    private handleQr(qr: string) {
        logger.info('QR RECEIVED');
        this.qrData.qrCodeData = qr;
        this.qrData.qrScanned = false;
        console.log(qr);
        qrcode.generate(qr, { small: true });
    }

    private handleDisconnect(reason: string) {
        logger.info(`Client disconnected: ${reason}`);
        setTimeout(() => {
            this.client.initialize();
        }, 5000);
    }

    public async initialize() {
        try {
            if (!this.client) {
                await this.initializeClient();
            }
            this.client.initialize();
        } catch (error) {
            logger.error(`Client initialization error: ${error}`);
        }
    }

    public async reconnectWhatsApp() {
        logger.info('Reconnecting WhatsApp...');
        
        // Destroy current client
        if (this.client) {
            await this.client.destroy();
            logger.info('Current WhatsApp session destroyed');
        }
        
        // Reset QR data
        this.qrData = {
            qrCodeData: "",
            qrScanned: false
        };
        
        // Create new client with async config
        const clientConfig = await getClientConfig();
        this.client = new Client(clientConfig);
        this.setupEventHandlers();
        
        // Initialize new client
        logger.info('Initializing new WhatsApp client...');
        this.client.initialize();
        
        // Wait a bit for QR to generate
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        logger.info('New client initialized');
    }

    public async sendMessageToUser(phoneNumber: string, message: string) {
        try {
            if (!this.client) {
                await this.initializeClient();
            }
            // Clean phone number - remove any non-numeric characters except +
            let cleanNumber = phoneNumber.replace(/[^0-9+]/g, '');
            
            // Remove leading zeros and ensure proper format
            if (cleanNumber.startsWith('52')) {
                cleanNumber = cleanNumber;
            }
            
            // Add @c.us suffix if not present
            const chatId = cleanNumber.includes('@c.us') ? cleanNumber : `${cleanNumber}@c.us`;
            
            logger.info(`Attempting to send message to: ${chatId}`);
            
            await this.client.sendMessage(chatId, message);
            logger.info(`Message sent successfully to ${phoneNumber}`);
            return true;
        } catch (error) {
            logger.error(`Failed to send message to ${phoneNumber}:`, error);
            logger.error('Error details:', {
                phoneNumber,
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
                errorStack: error instanceof Error ? error.stack : 'No stack trace'
            });
            return false;
        }
    }
    
    public pauseBot() {
        this.isPaused = true;
        logger.info('Bot paused');
    }
    
    public resumeBot() {
        this.isPaused = false;
        logger.info('Bot resumed');
    }
    
    public getPauseStatus(): boolean {
        return this.isPaused;
    }

    private async trackContact(message: Message, userI18n: UserI18n) {
        try {
            let user;
            try {
                user = await message.getContact();
            } catch (error) {
                logger.error('Failed to get contact in trackContact:', error);
                return;
            }
            
            if (!user || !user.number) {
                logger.warn('Cannot track contact without number');
                return;
            }
            
            // Check if this is a new user
            const existingContact = await ContactModel.findOne({ phoneNumber: user.number });
            const isNewUser = !existingContact;

            await ContactModel.findOneAndUpdate(
                { phoneNumber: user.number },
                {
                    $set: {
                        name: user.name || user.pushname,
                        pushName: user.pushname,
                        language: userI18n.getLanguage(),
                        lastInteraction: new Date(),
                        ...(isNewUser && { firstInteraction: new Date() })
                    },
                    $inc: { interactionsCount: 1 }
                },
                { upsert: true, new: true }
            );
            
            if (isNewUser) {
                logger.info(`New user registered: ${user.name || user.pushname} (${user.number})`);
            }
        } catch (error) {
            logger.error('Failed to track contact:', error);
        }
    }

    private async handleMessage(message: Message) {
        let chat = null;
        let userI18n: UserI18n;

        const content = message.body.trim();

        if (AppConfig.instance.getSupportedMessageTypes().indexOf(message.type) === -1) {
            return;
        }
        
        // Verificar si el bot está en pausa
        if (this.isPaused) {
            logger.info('Bot is paused, ignoring message');
            return;
        }

        // Verificar horario de atención
        const isBusinessHours = ScheduleUtil.isBusinessHours();
        if (!isBusinessHours) {
            try {
                let user;
                try {
                    user = await message.getContact();
                } catch (error) {
                    logger.error('Failed to get contact from message:', error);
                    return;
                }

                if (!user || !user.number) {
                    logger.warn('Message without valid contact information');
                    return;
                }

                // Obtener idioma del usuario
                userI18n = this.getUserI18n(user.number);
                chat = await message.getChat();
                
                // Enviar mensaje de fuera de horario
                const offHoursMessage = ScheduleUtil.getOffHoursMessage(userI18n.getLanguage());
                await chat.sendMessage(offHoursMessage);
                
                logger.info(`Off-hours message sent to ${user.number}`);
                return;
            } catch (error) {
                logger.error('Error sending off-hours message:', error);
                // Continuar con el procesamiento normal si hay error
            }
        }

        try {
            let user;
            try {
                user = await message.getContact();
            } catch (error) {
                logger.error('Failed to get contact from message:', error);
                logger.error('Message details:', {
                    id: message.id?._serialized,
                    from: message.from,
                    type: message.type,
                    body: message.body
                });
                return;
            }

            if (!user || !user.number) {
                logger.warn('Message without valid contact information');
                return;
            }
            
            logger.info(`Message from @${user.pushname} (${user.number}): ${content}`);
            
            // Check if user has paused the bot (unless they're using !start command)
            const isStartCommand = content.toLowerCase().trim() === '!start' || content.toLowerCase().trim() === 'start';
            
            if (!isStartCommand) {
                const contact = await ContactModel.findOne({ phoneNumber: user.number });
                if (contact && contact.botPaused) {
                    logger.info(`User ${user.number} has paused the bot, ignoring message`);
                    return;
                }
            }

            userI18n = this.getUserI18n(user.number);

            if (!user.isMe) await this.trackContact(message, userI18n);
            chat = await message.getChat();

            if (message.from === this.client.info.wid._serialized || message.isStatus) {
                return;
            }

            await Promise.all([
                onboard(message, userI18n),
                this.processMessageContent(message, content, userI18n, chat)
            ]);

            // await onboard(message, userI18n);
            // await this.processMessageContent(message, content, userI18n, chat);

        } catch (error) {
            logger.error(`Message handling error: ${error}`);
            
            // Don't try to send error message to user, just log it
            // This prevents cascading errors when WhatsApp is having issues
            try {
                if (chat && userI18n) {
                    const errorMessage = userI18n.t('errorOccurred') || 'An error occurred';
                    // Only send error message if we're not paused
                    if (!this.isPaused) {
                        await chat.sendMessage(`> 🤖 ${errorMessage}`);
                    }
                }
            } catch (innerError) {
                logger.error('Error sending error message to user:', innerError);
            }
        } finally {
            try {
                if (chat) await chat.clearState();
            } catch (error) {
                logger.error('Error clearing chat state:', error);
            }
        }
    }

    private getUserI18n(userNumber: string): UserI18n {
        if (!this.userI18nCache.has(userNumber)) {
            const userI18n = new UserI18n(userNumber);
            this.userI18nCache.set(userNumber, userI18n);
            logger.info(`New user detected: ${userNumber} (${userI18n.getLanguage()})`);
        }
        return this.userI18nCache.get(userNumber)!;
    }

    private async processMessageContent(message: Message, content: string, userI18n: UserI18n, chat: any) {
        if (message.type === MessageTypes.VOICE) {
            await this.handleVoiceMessage(message, userI18n);
            return;
        }

        if (message.type === MessageTypes.TEXT) {
            await this.handleTextMessage(message, content, userI18n, chat);
        }
    }

    private async handleVoiceMessage(message: Message, userI18n: UserI18n) {
        const args = message.body.trim().split(/ +/).slice(1);
        await commands[AppConfig.instance.getDefaultAudioAiCommand()].run(message, args, userI18n);
    }

    private async handleTextMessage(message: Message, content: string, userI18n: UserI18n, chat: any) {
        const url = content.trim().split(/ +/)[0];
        const socialNetwork = identifySocialNetwork(url);

        if (url && isUrl(url) && socialNetwork) {
            await commands["get"].run(message, null, url, socialNetwork, userI18n);
            return;
        }

        // Verificar si es un comando con prefijo
        if (content.startsWith(this.prefix)) {
            const args = content.slice(this.prefix.length).trim().split(/ +/);
            const command = args.shift()?.toLowerCase();

            if (command && command in commands) {
                if (chat) await chat.sendStateTyping();
                await commands[command].run(message, args, userI18n);
            } else {
                const errorMessage = userI18n.t('unknownCommand', {
                    command: command || '',
                    prefix: this.prefix
                });
                chat.sendMessage(`> 🤖 ${errorMessage}`);
            }
        } else {
            // Check if there's an active ticket conversation first
            try {
                const contact = await message.getContact();
                const ticketModule = require('./commands/ticket.command');
                const userConversation = ticketModule.conversations.get(contact.number);
                
                if (userConversation && userConversation.step && userConversation.step !== 'none') {
                    // There's an active ticket conversation, process it
                    logger.info(`Processing ticket conversation for ${contact.number}, step: ${userConversation.step}`);
                    if (chat) await chat.sendStateTyping();
                    await commands["ticket"].run(message, null, userI18n);
                    return;
                }
            } catch (error) {
                logger.error('Error checking ticket conversation:', error);
            }
            
            // Si no es un comando, tratar como conversación con el agente de ventas
            if (chat) await chat.sendStateTyping();
            await commands["chat"].run(message, content.split(/ +/), userI18n);
        }
    }
}