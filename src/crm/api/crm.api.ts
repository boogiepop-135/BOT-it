import express from 'express';
import bcrypt from 'bcrypt';
import { BotManager } from '../../bot.manager';
import logger from '../../configs/logger.config';
import { authenticate, authorizeAdmin } from '../middlewares/auth.middleware';
import { CampaignModel } from '../models/campaign.model';
import { ContactModel } from '../models/contact.model';
import { PaymentReminderModel } from '../models/payment-reminder.model';
import { AuthService } from '../utils/auth.util';
import { sendRoleAssignmentMessage } from '../../utils/role-assignment.util';
import projectsApi from './projects.api';
import sheetsApi from './sheets.api';
import rhApi from './rh.api';
import financeApi from './finance.api';
import feedbackApi from './feedback.api';
import scheduledReportApi from './scheduled-report.api';
import { TemplateModel } from '../models/template.model';

export const router = express.Router();

export default function (botManager: BotManager) {
    // Contacts API
    router.get('/contacts', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { page = 1, limit = 20, search = '', sort = '-lastInteraction' } = req.query;
            const skip = (Number(page) - 1) * Number(limit);

            const query = search
                ? {
                    $or: [
                        { phoneNumber: { $regex: search, $options: 'i' } },
                        { name: { $regex: search, $options: 'i' } },
                        { pushName: { $regex: search, $options: 'i' } }
                    ]
                }
                : {};

            const contacts = await ContactModel.find(query)
                .sort(sort)
                .skip(skip)
                .limit(Number(limit));

            const total = await ContactModel.countDocuments(query);

            res.json({
                data: contacts,
                meta: {
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    pages: Math.ceil(total / Number(limit))
                }
            });
        } catch (error) {
            logger.error('Failed to fetch contacts:', error);
            res.status(500).json({ error: 'Failed to fetch contacts' });
        }
    });
    
    // Pause/Resume specific user
    router.post('/contacts/:phoneNumber/pause', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { phoneNumber } = req.params;
            
            await ContactModel.findOneAndUpdate(
                { phoneNumber },
                { 
                    $set: { 
                        botPaused: true,
                        botPausedAt: new Date()
                    }
                }
            );
            
            // Avisar al usuario que IT se unirá personalmente a la conversación
            try {
                await botManager.sendMessageToUser(
                    phoneNumber,
                    `⏸️ *Bot Pausado*\n\n` +
                    `Tu acceso al bot ha sido pausado temporalmente.\n\n` +
                    `👨‍💻 El equipo de IT se unirá de forma personal a esta conversación en breve para asistirte.`
                );
            } catch (e) {
                logger.warn('No se pudo enviar mensaje de pausa al usuario via API:', e);
            }
            
            res.json({ success: true, message: 'Usuario pausado' });
        } catch (error) {
            logger.error('Failed to pause user:', error);
            res.status(500).json({ error: 'Failed to pause user' });
        }
    });
    
    router.post('/contacts/:phoneNumber/resume', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { phoneNumber } = req.params;
            
            await ContactModel.findOneAndUpdate(
                { phoneNumber },
                { 
                    $set: { botPaused: false },
                    $unset: { botPausedAt: "" }
                }
            );
            
            res.json({ success: true, message: 'Usuario reanudado' });
        } catch (error) {
            logger.error('Failed to resume user:', error);
            res.status(500).json({ error: 'Failed to resume user' });
        }
    });
    
    // Update user role
    router.post('/contacts/:phoneNumber/role', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { phoneNumber } = req.params;
            const { role } = req.body;
            
            // Roles permitidos
            const allowedRoles = ['user', 'salma', 'francisco', 'rh_karina', 'rh_nubia', 'desarrollo_estrategia_inrra', 'boss', 'ceo', 'admin', 'levi', 'super_admin'];
            
            if (!role || !allowedRoles.includes(role)) {
                return res.status(400).json({ error: `Role must be one of: ${allowedRoles.join(', ')}` });
            }
            
            // Obtener contacto actual para comparar rol anterior
            const contact = await ContactModel.findOne({ phoneNumber });
            const previousRole = contact?.role || 'user';
            
            // Actualizar rol
            const updatedContact = await ContactModel.findOneAndUpdate(
                { phoneNumber },
                { $set: { role } },
                { new: true, upsert: true }
            );
            
            // Si el rol cambió, enviar mensaje de confirmación
            if (previousRole !== role) {
                await sendRoleAssignmentMessage(botManager, phoneNumber, role, updatedContact?.name || updatedContact?.pushName || phoneNumber);
            }
            
            res.json({ success: true, message: `Rol actualizado a ${role}` });
        } catch (error) {
            logger.error('Failed to update user role:', error);
            res.status(500).json({ error: 'Failed to update user role' });
        }
    });
    
    // Send message to specific user
    router.post('/contacts/:phoneNumber/message', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { phoneNumber } = req.params;
            const { message } = req.body;
            
            if (!message) {
                return res.status(400).json({ error: 'Message is required' });
            }
            
            const success = await botManager.sendMessageToUser(phoneNumber, message);
            
            if (success) {
                res.json({ success: true, message: 'Mensaje enviado' });
            } else {
                res.status(500).json({ error: 'Failed to send message' });
            }
        } catch (error) {
            logger.error('Failed to send message to user:', error);
            res.status(500).json({ error: 'Failed to send message' });
        }
    });

    // Groups API
    router.get('/groups', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const q = (req.query.q as string || '').toLowerCase().trim();
            let groups = await botManager.listGroups();
            if (q) {
                groups = groups.filter(g => typeof g.name === 'string' && g.name.toLowerCase().includes(q));
            }
            res.json(groups);
        } catch (error) {
            logger.error('Failed to list groups:', error);
            res.status(500).json({ error: 'Failed to list groups' });
        }
    });

    router.post('/groups/:groupId/message', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { groupId } = req.params;
            const { message } = req.body;
            if (!message) return res.status(400).json({ error: 'Message is required' });
            const success = await botManager.sendMessageToGroupById(groupId, message);
            if (!success) return res.status(500).json({ error: 'Failed to send message to group' });
            res.json({ success: true, message: 'Mensaje enviado al grupo' });
        } catch (error) {
            logger.error('Failed to send message to group by id:', error);
            res.status(500).json({ error: 'Failed to send message to group' });
        }
    });

    router.post('/groups/by-name/:groupName/message', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { groupName } = req.params;
            const { message } = req.body;
            if (!message) return res.status(400).json({ error: 'Message is required' });
            const success = await botManager.sendMessageToGroupByName(groupName, message);
            if (!success) return res.status(404).json({ error: 'Group not found or failed to send' });
            res.json({ success: true, message: 'Mensaje enviado al grupo' });
        } catch (error) {
            logger.error('Failed to send message to group by name:', error);
            res.status(500).json({ error: 'Failed to send message to group' });
        }
    });

    // Campaigns API
    router.post('/campaigns', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { name, message, scheduledAt, contacts } = req.body;

            const campaign = new CampaignModel({
                name,
                message,
                scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
                contacts,
                createdBy: req.user.userId,
                status: scheduledAt ? 'scheduled' : 'draft'
            });

            await campaign.save();

            if (!scheduledAt) {
                // Send immediately
                await sendCampaignMessages(botManager, campaign);
            }

            res.status(201).json(campaign);
        } catch (error) {
            logger.error('Failed to create campaign:', error);
            res.status(500).json({ error: 'Failed to create campaign' });
        }
    });

    router.get('/campaigns', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const campaigns = await CampaignModel.find()
                .sort({ createdAt: -1 })
                .populate('createdBy', 'username');

            res.json(campaigns);
        } catch (error) {
            logger.error('Failed to fetch campaigns:', error);
            res.status(500).json({ error: 'Failed to fetch campaigns' });
        }
    });

    // Templates API
    router.get('/templates', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const templates = await TemplateModel.find().sort({ createdAt: -1 });
            res.json(templates);
        } catch (error) {
            logger.error('Failed to fetch templates:', error);
            res.status(500).json({ error: 'Failed to fetch templates' });
        }
    });

    router.post('/templates', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { name, content } = req.body;

            const template = new TemplateModel({
                name,
                content,
                createdBy: req.user.userId
            });

            await template.save();
            res.status(201).json(template);
        } catch (error) {
            logger.error('Failed to create template:', error);
            res.status(500).json({ error: 'Failed to create template' });
        }
    });

    router.put('/templates/:id', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const { name, content } = req.body;

            const template = await TemplateModel.findByIdAndUpdate(
                id,
                { name, content },
                { new: true }
            );

            if (!template) {
                return res.status(404).json({ error: 'Template not found' });
            }

            res.json(template);
        } catch (error) {
            logger.error('Failed to update template:', error);
            res.status(500).json({ error: 'Failed to update template' });
        }
    });

    router.delete('/templates/:id', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { id } = req.params;

            const template = await TemplateModel.findByIdAndDelete(id);

            if (!template) {
                return res.status(404).json({ error: 'Template not found' });
            }

            res.json({ success: true });
        } catch (error) {
            logger.error('Failed to delete template:', error);
            res.status(500).json({ error: 'Failed to delete template' });
        }
    });

    // Auth API
    router.post('/auth/register', async (req, res) => {
        try {
            const { username, password } = req.body;
            const user = await AuthService.register(username, password, 'admin');
            res.status(201).json(user);
        } catch (error) {
            logger.error('Registration failed:', error);
            res.status(400).json({ error: error.message });
        }
    });

    router.post('/auth/login', async (req, res) => {
        try {
            const { username, password } = req.body;
            const { token, user } = await AuthService.login(username, password);
            res.json({ token, user });
        } catch (error) {
            logger.error('Login failed:', error);
            res.status(401).json({ error: error.message });
        }
    });

    router.get('/auth/check', authenticate, (req, res) => {
        res.json({ user: req.user });
    });

    // Debug endpoint para verificar usuarios en MongoDB
    router.get('/auth/debug-users', async (req, res) => {
        try {
            const mongoose = require('mongoose');
            const db = mongoose.connection.db;
            const dbName = mongoose.connection.name;
            
            // Intentar obtener usuarios del modelo
            const UserModel = require('../models/user.model').UserModel;
            const modelUsers = await UserModel.find({}).lean();
            
            // Intentar obtener usuarios directamente de la colección
            let collectionUsers: any[] = [];
            if (db) {
                try {
                    collectionUsers = await db.collection('users').find({}).toArray();
                } catch (e) {
                    logger.error('Error reading users collection:', e);
                }
            }
            
            res.json({
                dbName,
                modelUsers: modelUsers.map(u => ({ 
                    _id: u._id, 
                    username: u.username, 
                    role: u.role,
                    hasPassword: !!u.password,
                    passwordHashStart: u.password ? u.password.substring(0, 20) : null,
                    passwordHashFormat: u.password ? (u.password.startsWith('$2b$') ? 'bcrypt' : 'unknown') : null
                })),
                collectionUsers: collectionUsers.map(u => ({ 
                    _id: u._id, 
                    username: u.username, 
                    role: u.role,
                    hasPassword: !!u.password,
                    passwordHashStart: u.password ? u.password.substring(0, 20) : null
                })),
                collections: db ? await db.listCollections().toArray().then((cols: any[]) => cols.map(c => c.name)) : []
            });
        } catch (error: any) {
            logger.error('Debug users error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Endpoint para resetear contraseña de un usuario (solo para debug/admin)
    router.post('/auth/reset-password', async (req, res) => {
        try {
            const { username, newPassword } = req.body;
            if (!username || !newPassword) {
                return res.status(400).json({ error: 'Username and newPassword are required' });
            }

            const UserModel = require('../models/user.model').UserModel;
            const user = await UserModel.findOne({ username });
            
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            const hashedPassword = await bcrypt.hash(newPassword, 10);
            user.password = hashedPassword;
            await user.save();

            logger.info(`Password reset for user: ${username}`);
            res.json({ success: true, message: 'Password reset successfully' });
        } catch (error: any) {
            logger.error('Password reset error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Send message route
    router.post('/send-message', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { phoneNumber, message } = req.body;
            const formattedNumber = phoneNumber.includes('@')
                ? phoneNumber
                : `${phoneNumber}@c.us`;

            await botManager.client.sendMessage(formattedNumber, message);
            res.json({ success: true });
        } catch (error) {
            logger.error('Failed to send message:', error);
            res.status(500).json({ error: 'Failed to send message' });
        }
    });

    // Payment Reminders API
    router.get('/payment-reminders', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const reminders = await PaymentReminderModel.find()
                .sort({ dueDate: 1 });
            res.json(reminders);
        } catch (error) {
            logger.error('Failed to fetch payment reminders:', error);
            res.status(500).json({ error: 'Failed to fetch payment reminders' });
        }
    });

    router.get('/payment-reminders/:id', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const reminder = await PaymentReminderModel.findById(req.params.id);
            
            if (!reminder) {
                return res.status(404).json({ error: 'Payment reminder not found' });
            }
            
            res.json(reminder);
        } catch (error) {
            logger.error('Failed to fetch payment reminder:', error);
            res.status(500).json({ error: 'Failed to fetch payment reminder' });
        }
    });

    router.post('/payment-reminders', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { title, description, phoneNumber, amount, dueDate, reminderDays, isMonthly, tags } = req.body;
            
            const reminder = new PaymentReminderModel({
                title,
                description,
                phoneNumber,
                amount,
                dueDate: new Date(dueDate),
                reminderDays: reminderDays || [7, 3, 1],
                isMonthly: isMonthly || false,
                isActive: true,
                tags: tags || []
            });
            
            await reminder.save();
            res.status(201).json(reminder);
        } catch (error) {
            logger.error('Failed to create payment reminder:', error);
            res.status(500).json({ error: 'Failed to create payment reminder' });
        }
    });

    router.put('/payment-reminders/:id', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { title, description, phoneNumber, amount, dueDate, reminderDays, isMonthly, isActive, tags } = req.body;
            
            const reminder = await PaymentReminderModel.findByIdAndUpdate(
                req.params.id,
                {
                    title,
                    description,
                    phoneNumber,
                    amount,
                    dueDate: dueDate ? new Date(dueDate) : undefined,
                    reminderDays,
                    isMonthly,
                    isActive,
                    tags
                },
                { new: true }
            );
            
            if (!reminder) {
                return res.status(404).json({ error: 'Payment reminder not found' });
            }
            
            res.json(reminder);
        } catch (error) {
            logger.error('Failed to update payment reminder:', error);
            res.status(500).json({ error: 'Failed to update payment reminder' });
        }
    });

    router.delete('/payment-reminders/:id', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const reminder = await PaymentReminderModel.findByIdAndDelete(req.params.id);
            
            if (!reminder) {
                return res.status(404).json({ error: 'Payment reminder not found' });
            }
            
            res.json({ success: true, message: 'Payment reminder deleted' });
        } catch (error) {
            logger.error('Failed to delete payment reminder:', error);
            res.status(500).json({ error: 'Failed to delete payment reminder' });
        }
    });

  // Sub-routers CRM
  router.use('/', projectsApi);
  router.use('/sheets', sheetsApi());
  router.use('/rh', rhApi);
  router.use('/finance', financeApi);
  router.use('/', feedbackApi);
  router.use('/', scheduledReportApi);

    return router;
}

async function sendCampaignMessages(botManager: BotManager, campaign: any) {
    try {
        campaign.status = 'sending';
        await campaign.save();

        let sentCount = 0;
        let failedCount = 0;

        for (const phoneNumber of campaign.contacts) {
            try {
                const formattedNumber = phoneNumber.includes('@')
                    ? phoneNumber
                    : `${phoneNumber}@c.us`;

                await botManager.client.sendMessage(formattedNumber, campaign.message);
                sentCount++;
            } catch (error) {
                logger.error(`Failed to send message to ${phoneNumber}:`, error);
                failedCount++;
            }
        }

        campaign.sentCount = sentCount;
        campaign.failedCount = failedCount;
        campaign.status = sentCount > 0 ? 'sent' : 'failed';
        campaign.sentAt = new Date();
        await campaign.save();

    } catch (error) {
        logger.error('Failed to send campaign:', error);
        campaign.status = 'failed';
        await campaign.save();
    }
}