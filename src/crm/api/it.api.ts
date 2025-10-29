import express from 'express';
import { BotManager } from '../../bot.manager';
import logger from '../../configs/logger.config';
import { authenticate, authorizeAdmin } from '../middlewares/auth.middleware';
import { TicketModel } from '../models/ticket.model';
import { ProjectModel } from '../models/project.model';
import { MetricModel } from '../models/metric.model';
import { UserModel } from '../models/user.model';

export const router = express.Router();

export default function (botManager: BotManager) {
    // ============ TICKETS API ============
    
    // Crear ticket
    router.post('/tickets', authenticate, async (req, res) => {
        try {
            const { title, description, category, priority, createdBy } = req.body;
            
            const ticket = new TicketModel({
                title,
                description,
                category,
                priority: priority || 'medium',
                createdBy,
                status: 'open'
            });
            
            await ticket.save();
            
            // Calcular tiempo de resolución promedio para métricas
            await updateTicketMetrics();
            
            res.status(201).json(ticket);
        } catch (error) {
            logger.error('Failed to create ticket:', error);
            res.status(500).json({ error: 'Failed to create ticket' });
        }
    });
    
    // Obtener todos los tickets (con filtros)
    router.get('/tickets', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { 
                page = 1, 
                limit = 20, 
                status, 
                priority, 
                category, 
                assignedTo,
                sucursal
            } = req.query;
            
            const skip = (Number(page) - 1) * Number(limit);
            
            const query: any = {};
            
            if (status) query.status = status;
            if (priority) query.priority = priority;
            if (category) query.category = category;
            if (assignedTo) query.assignedTo = assignedTo;
            if (sucursal) query.sucursal = sucursal;
            
            const tickets = await TicketModel.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .populate('assignedTo', 'username');
            
            const total = await TicketModel.countDocuments(query);
            
            // Calcular estadísticas
            const stats = {
                open: await TicketModel.countDocuments({ ...query, status: 'open' }),
                assigned: await TicketModel.countDocuments({ ...query, status: 'assigned' }),
                in_progress: await TicketModel.countDocuments({ ...query, status: 'in_progress' }),
                resolved: await TicketModel.countDocuments({ ...query, status: 'resolved' }),
                closed: await TicketModel.countDocuments({ ...query, status: 'closed' })
            };
            
            res.json({
                data: tickets,
                stats,
                meta: {
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    pages: Math.ceil(total / Number(limit))
                }
            });
        } catch (error) {
            logger.error('Failed to fetch tickets:', error);
            res.status(500).json({ error: 'Failed to fetch tickets' });
        }
    });
    
    // Obtener ticket por ID
    router.get('/tickets/:id', authenticate, async (req, res) => {
        try {
            const ticket = await TicketModel.findById(req.params.id)
                .populate('assignedTo', 'username');
            
            if (!ticket) {
                return res.status(404).json({ error: 'Ticket not found' });
            }
            
            res.json(ticket);
        } catch (error) {
            logger.error('Failed to fetch ticket:', error);
            res.status(500).json({ error: 'Failed to fetch ticket' });
        }
    });
    
    // Actualizar ticket
    router.put('/tickets/:id', authenticate, async (req, res) => {
        try {
            const { status, priority, assignedTo, solution, comments } = req.body;
            
            const updateData: any = {};
            if (status) updateData.status = status;
            if (priority) updateData.priority = priority;
            if (assignedTo) updateData.assignedTo = assignedTo;
            if (solution) updateData.solution = solution;
            if (comments) updateData.comments = comments;
            
            // Si se marca como resuelto, calcular tiempo de resolución
            if (status === 'resolved' || status === 'closed') {
                const ticket = await TicketModel.findById(req.params.id);
                if (ticket && !ticket.resolvedAt) {
                    updateData.resolvedAt = new Date();
                    if (status === 'resolved') {
                        updateData.status = 'resolved';
                    }
                    if (status === 'closed') {
                        updateData.status = 'closed';
                        updateData.closedAt = new Date();
                    }
                }
            }
            
            const ticket = await TicketModel.findByIdAndUpdate(
                req.params.id,
                updateData,
                { new: true }
            ).populate('assignedTo', 'username');
            
            if (!ticket) {
                return res.status(404).json({ error: 'Ticket not found' });
            }
            
            await updateTicketMetrics();
            
            res.json(ticket);
        } catch (error) {
            logger.error('Failed to update ticket:', error);
            res.status(500).json({ error: 'Failed to update ticket' });
        }
    });
    
    // Agregar comentario a ticket
    router.post('/tickets/:id/comments', authenticate, async (req, res) => {
        try {
            const { user, message } = req.body;
            
            const ticket = await TicketModel.findById(req.params.id);
            
            if (!ticket) {
                return res.status(404).json({ error: 'Ticket not found' });
            }
            
            ticket.comments.push({
                user,
                message,
                createdAt: new Date()
            });
            
            await ticket.save();
            
            res.json(ticket);
        } catch (error) {
            logger.error('Failed to add comment:', error);
            res.status(500).json({ error: 'Failed to add comment' });
        }
    });
    
    // Enviar mensaje al creador del ticket
    router.post('/tickets/:id/send-message', authenticate, async (req, res) => {
        try {
            const { message } = req.body;
            
            const ticket = await TicketModel.findById(req.params.id);
            
            if (!ticket) {
                return res.status(404).json({ error: 'Ticket not found' });
            }
            
            // Formatear mensaje con información del ticket
            const ticketInfo = `📋 *Ticket ${ticket.ticketNumber}*\n` +
                              `📌 *${ticket.title}*\n` +
                              `\n💬 *Respuesta del equipo IT:*\n${message}` +
                              `\n\nPara más información, responde a este mensaje o crea un nuevo ticket con !ticket`;
            
            // Enviar mensaje vía WhatsApp
            const success = await botManager.sendMessageToUser(ticket.createdBy, ticketInfo);
            
            if (success) {
                // Guardar comentario
                ticket.comments.push({
                    user: 'Admin',
                    message: `💬 ${message}`,
                    createdAt: new Date()
                });
                await ticket.save();
                
                res.json({ success: true, message: 'Mensaje enviado exitosamente' });
            } else {
                res.status(500).json({ error: 'Failed to send message' });
            }
        } catch (error) {
            logger.error('Failed to send message:', error);
            res.status(500).json({ error: 'Failed to send message' });
        }
    });
    
    // Marcar ticket como resuelto y enviar mensaje automático
    router.post('/tickets/:id/resolve', authenticate, async (req, res) => {
        try {
            const { solution } = req.body;
            
            const ticket = await TicketModel.findById(req.params.id);
            
            if (!ticket) {
                return res.status(404).json({ error: 'Ticket not found' });
            }
            
            // Actualizar ticket
            ticket.status = 'resolved';
            ticket.resolvedAt = new Date();
            if (solution) {
                ticket.solution = solution;
            }
            
            // Calcular tiempo de resolución
            if (ticket.createdAt) {
                const resolutionTime = (ticket.resolvedAt.getTime() - ticket.createdAt.getTime()) / (1000 * 60); // en minutos
                ticket.resolutionTime = Math.round(resolutionTime);
            }
            
            await ticket.save();
            
            // Enviar mensaje automático al usuario
            const solutionMessage = solution || 'ha sido resuelto. Si necesitas más ayuda, crea un nuevo ticket.';
            const autoMessage = `✅ Tu ticket *${ticket.ticketNumber}* "${ticket.title}" ha sido resuelto.\n\n${solution}\n\nGracias por usar nuestro sistema de soporte.`;
            
            await botManager.sendMessageToUser(ticket.createdBy, autoMessage);
            
            // Guardar comentario
            ticket.comments.push({
                user: 'Admin',
                message: `✅ Ticket resuelto: ${solution}`,
                createdAt: new Date()
            });
            await ticket.save();
            
            await updateTicketMetrics();
            
            res.json(ticket);
        } catch (error) {
            logger.error('Failed to resolve ticket:', error);
            res.status(500).json({ error: 'Failed to resolve ticket' });
        }
    });
    
    // ============ PROJECTS API ============
    
    // Crear proyecto
    router.post('/projects', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { name, description, status, priority, startDate, endDate, assignedTo, createdBy, stakeholders, deliverables, budget, tags } = req.body;
            
            const project = new ProjectModel({
                name,
                description,
                status: status || 'planning',
                priority: priority || 'medium',
                startDate: startDate || new Date(),
                endDate,
                assignedTo,
                createdBy,
                stakeholders: stakeholders || [],
                deliverables: deliverables || [],
                budget,
                tags: tags || [],
                progress: 0
            });
            
            await project.save();
            
            res.status(201).json(project);
        } catch (error) {
            logger.error('Failed to create project:', error);
            res.status(500).json({ error: 'Failed to create project' });
        }
    });
    
    // Obtener todos los proyectos
    router.get('/projects', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { page = 1, limit = 20, status, priority } = req.query;
            const skip = (Number(page) - 1) * Number(limit);
            
            const query: any = {};
            if (status) query.status = status;
            if (priority) query.priority = priority;
            
            const projects = await ProjectModel.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .populate('assignedTo', 'username')
                .populate('createdBy', 'username');
            
            const total = await ProjectModel.countDocuments(query);
            
            // Calcular estadísticas
            const stats = {
                planning: await ProjectModel.countDocuments({ status: 'planning' }),
                in_progress: await ProjectModel.countDocuments({ status: 'in_progress' }),
                on_hold: await ProjectModel.countDocuments({ status: 'on_hold' }),
                completed: await ProjectModel.countDocuments({ status: 'completed' }),
                cancelled: await ProjectModel.countDocuments({ status: 'cancelled' })
            };
            
            res.json({
                data: projects,
                stats,
                meta: {
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    pages: Math.ceil(total / Number(limit))
                }
            });
        } catch (error) {
            logger.error('Failed to fetch projects:', error);
            res.status(500).json({ error: 'Failed to fetch projects' });
        }
    });
    
    // Obtener proyecto por ID
    router.get('/projects/:id', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const project = await ProjectModel.findById(req.params.id)
                .populate('assignedTo', 'username')
                .populate('createdBy', 'username');
            
            if (!project) {
                return res.status(404).json({ error: 'Project not found' });
            }
            
            res.json(project);
        } catch (error) {
            logger.error('Failed to fetch project:', error);
            res.status(500).json({ error: 'Failed to fetch project' });
        }
    });
    
    // Actualizar proyecto
    router.put('/projects/:id', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { name, description, status, priority, progress, endDate, assignedTo, tasks, deliverables, notes } = req.body;
            
            const updateData: any = {};
            if (name) updateData.name = name;
            if (description) updateData.description = description;
            if (status) {
                updateData.status = status;
                if (status === 'completed' && !updateData.completedAt) {
                    updateData.completedAt = new Date();
                }
            }
            if (priority) updateData.priority = priority;
            if (progress !== undefined) updateData.progress = progress;
            if (endDate) updateData.endDate = endDate;
            if (assignedTo) updateData.assignedTo = assignedTo;
            if (tasks) updateData.tasks = tasks;
            if (deliverables) updateData.deliverables = deliverables;
            if (notes) updateData.notes = notes;
            
            const project = await ProjectModel.findByIdAndUpdate(
                req.params.id,
                updateData,
                { new: true }
            ).populate('assignedTo', 'username').populate('createdBy', 'username');
            
            if (!project) {
                return res.status(404).json({ error: 'Project not found' });
            }
            
            res.json(project);
        } catch (error) {
            logger.error('Failed to update project:', error);
            res.status(500).json({ error: 'Failed to update project' });
        }
    });
    
    // Eliminar proyecto
    router.delete('/projects/:id', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const project = await ProjectModel.findByIdAndDelete(req.params.id);
            
            if (!project) {
                return res.status(404).json({ error: 'Project not found' });
            }
            
            res.json({ success: true, message: 'Project deleted' });
        } catch (error) {
            logger.error('Failed to delete project:', error);
            res.status(500).json({ error: 'Failed to delete project' });
        }
    });
    
    // Agregar tarea a proyecto
    router.post('/projects/:id/tasks', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { title, description, assignedTo, dueDate } = req.body;
            
            const project = await ProjectModel.findById(req.params.id);
            
            if (!project) {
                return res.status(404).json({ error: 'Project not found' });
            }
            
            const taskId = require('crypto').randomBytes(4).toString('hex');
            
            project.tasks.push({
                id: taskId,
                title,
                description,
                assignedTo,
                dueDate: dueDate ? new Date(dueDate) : undefined,
                status: 'pending'
            });
            
            await project.save();
            
            res.json(project);
        } catch (error) {
            logger.error('Failed to add task:', error);
            res.status(500).json({ error: 'Failed to add task' });
        }
    });
    
    // Actualizar tarea de proyecto
    router.put('/projects/:id/tasks/:taskId', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { status, assignedTo, completedAt } = req.body;
            
            const project = await ProjectModel.findById(req.params.id);
            
            if (!project) {
                return res.status(404).json({ error: 'Project not found' });
            }
            
            const task = project.tasks.find((t: any) => t.id === req.params.taskId);
            
            if (!task) {
                return res.status(404).json({ error: 'Task not found' });
            }
            
            if (status) task.status = status;
            if (assignedTo) task.assignedTo = assignedTo;
            if (completedAt) task.completedAt = new Date(completedAt);
            
            // Calcular progreso del proyecto basado en tareas completadas
            const completedTasks = project.tasks.filter((t: any) => t.status === 'completed').length;
            project.progress = Math.round((completedTasks / project.tasks.length) * 100);
            
            await project.save();
            
            res.json(project);
        } catch (error) {
            logger.error('Failed to update task:', error);
            res.status(500).json({ error: 'Failed to update task' });
        }
    });
    
    // ============ DASHBOARD STATS API ============
    
    router.get('/dashboard/stats', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            
            // Estadísticas de tickets
            const totalTickets = await TicketModel.countDocuments();
            const openTickets = await TicketModel.countDocuments({ status: 'open' });
            const urgentTickets = await TicketModel.countDocuments({ priority: 'urgent' });
            
            const ticketsThisMonth = await TicketModel.countDocuments({
                createdAt: { $gte: startOfMonth }
            });
            
            const resolvedTickets = await TicketModel.countDocuments({
                status: { $in: ['resolved', 'closed'] },
                resolvedAt: { $gte: startOfMonth }
            });
            
            // Tiempo promedio de resolución
            const resolvedWithTime = await TicketModel.find({
                status: 'resolved',
                resolvedAt: { $gte: startOfMonth }
            });
            
            let avgResolutionTime = 0;
            if (resolvedWithTime.length > 0) {
                const totalTime = resolvedWithTime.reduce((sum, ticket) => {
                    if (ticket.resolvedAt) {
                        const diff = ticket.resolvedAt.getTime() - ticket.createdAt.getTime();
                        return sum + diff;
                    }
                    return sum;
                }, 0);
                avgResolutionTime = Math.round(totalTime / resolvedWithTime.length / (1000 * 60 * 60)); // en horas
            }
            
            // Estadísticas de proyectos
            const totalProjects = await ProjectModel.countDocuments();
            const activeProjects = await ProjectModel.countDocuments({ 
                status: { $in: ['planning', 'in_progress'] }
            });
            const completedProjects = await ProjectModel.countDocuments({ 
                status: 'completed',
                completedAt: { $gte: startOfMonth }
            });
            
            // Progreso promedio de proyectos activos
            const activeProjectsData = await ProjectModel.find({ 
                status: { $in: ['planning', 'in_progress'] }
            });
            const avgProgress = activeProjectsData.length > 0
                ? Math.round(activeProjectsData.reduce((sum, p) => sum + p.progress, 0) / activeProjectsData.length)
                : 0;
            
            // Tickets por categoría
            const categoryStats = await TicketModel.aggregate([
                {
                    $group: {
                        _id: '$category',
                        count: { $sum: 1 }
                    }
                }
            ]);
            
            // Proyectos por prioridad
            const priorityStats = await ProjectModel.aggregate([
                {
                    $group: {
                        _id: '$priority',
                        count: { $sum: 1 }
                    }
                }
            ]);
            
            res.json({
                tickets: {
                    total: totalTickets,
                    open: openTickets,
                    urgent: urgentTickets,
                    thisMonth: ticketsThisMonth,
                    resolvedThisMonth: resolvedTickets,
                    avgResolutionTimeHours: avgResolutionTime
                },
                projects: {
                    total: totalProjects,
                    active: activeProjects,
                    completedThisMonth: completedProjects,
                    avgProgress
                },
                categories: categoryStats,
                priorities: priorityStats
            });
        } catch (error) {
            logger.error('Failed to fetch dashboard stats:', error);
            res.status(500).json({ error: 'Failed to fetch dashboard stats' });
        }
    });
    
    return router;
}

async function updateTicketMetrics() {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        const resolvedTickets = await TicketModel.find({
            status: 'resolved',
            resolvedAt: { $gte: startOfMonth }
        });
        
        if (resolvedTickets.length > 0) {
            const totalTime = resolvedTickets.reduce((sum, ticket) => {
                if (ticket.resolvedAt) {
                    const diff = ticket.resolvedAt.getTime() - ticket.createdAt.getTime();
                    return sum + diff;
                }
                return sum;
            }, 0);
            
            const avgResolutionTime = totalTime / resolvedTickets.length / (1000 * 60); // en minutos
            
            await MetricModel.findOneAndUpdate(
                {
                    metricType: 'ticket_resolution_time',
                    'period.start': { $gte: startOfMonth }
                },
                {
                    metricType: 'ticket_resolution_time',
                    value: Math.round(avgResolutionTime),
                    period: {
                        start: startOfMonth,
                        end: now
                    }
                },
                { upsert: true }
            );
        }
        
        const ticketsThisMonth = await TicketModel.countDocuments({
            createdAt: { $gte: startOfMonth }
        });
        
        await MetricModel.findOneAndUpdate(
            {
                metricType: 'ticket_count',
                'period.start': { $gte: startOfMonth }
            },
            {
                metricType: 'ticket_count',
                value: ticketsThisMonth,
                period: {
                    start: startOfMonth,
                    end: now
                }
            },
            { upsert: true }
        );
        
    } catch (error) {
        logger.error('Failed to update ticket metrics:', error);
    }
}

