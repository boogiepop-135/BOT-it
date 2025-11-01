import express from 'express';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';
import { FeedbackModel } from '../models/feedback.model';
import { ROLES } from '../utils/rbac.util';
import logger from '../../configs/logger.config';

const router = express.Router();

/**
 * API de Retroalimentación para CEO
 * Permite crear y consultar retroalimentaciones diarias o semanales
 */

// Obtener todas las retroalimentaciones
router.get('/feedback', authenticate, authorizeRoles(ROLES.CEO, ROLES.ADMIN), async (req, res) => {
    try {
        const { period, startDate, endDate, page = 1, limit = 20 } = req.query;
        
        const query: any = {};
        
        if (period) {
            query.period = period;
        }
        
        if (startDate || endDate) {
            query.periodDate = {};
            if (startDate) {
                query.periodDate.$gte = new Date(startDate as string);
            }
            if (endDate) {
                query.periodDate.$lte = new Date(endDate as string);
            }
        }
        
        const skip = (Number(page) - 1) * Number(limit);
        
        const feedbacks = await FeedbackModel.find(query)
            .sort({ periodDate: -1, createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .populate('createdBy', 'username')
            .lean();
        
        const total = await FeedbackModel.countDocuments(query);
        
        res.json({
            data: feedbacks,
            meta: {
                total,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / Number(limit))
            }
        });
    } catch (error) {
        logger.error('Failed to get feedback:', error);
        res.status(500).json({ error: 'Failed to get feedback' });
    }
});

// Crear nueva retroalimentación
router.post('/feedback', authenticate, authorizeRoles(ROLES.CEO, ROLES.ADMIN), async (req, res) => {
    try {
        const { title, description, period, periodDate } = req.body;
        
        if (!title || !description || !period || !periodDate) {
            return res.status(400).json({ error: 'Missing required fields: title, description, period, periodDate' });
        }
        
        // Validar período
        if (!['day', 'week'].includes(period)) {
            return res.status(400).json({ error: 'Period must be "day" or "week"' });
        }
        
        const feedback = new FeedbackModel({
            title,
            description,
            period,
            periodDate: new Date(periodDate),
            createdBy: req.user.userId
        });
        
        await feedback.save();
        
        res.status(201).json(feedback);
    } catch (error) {
        logger.error('Failed to create feedback:', error);
        res.status(500).json({ error: 'Failed to create feedback' });
    }
});

// Obtener retroalimentación por ID
router.get('/feedback/:id', authenticate, authorizeRoles(ROLES.CEO, ROLES.ADMIN), async (req, res) => {
    try {
        const feedback = await FeedbackModel.findById(req.params.id)
            .populate('createdBy', 'username')
            .lean();
        
        if (!feedback) {
            return res.status(404).json({ error: 'Feedback not found' });
        }
        
        res.json(feedback);
    } catch (error) {
        logger.error('Failed to get feedback:', error);
        res.status(500).json({ error: 'Failed to get feedback' });
    }
});

// Actualizar retroalimentación
router.put('/feedback/:id', authenticate, authorizeRoles(ROLES.CEO, ROLES.ADMIN), async (req, res) => {
    try {
        const { title, description, period, periodDate } = req.body;
        
        const updateData: any = {};
        if (title) updateData.title = title;
        if (description) updateData.description = description;
        if (period) updateData.period = period;
        if (periodDate) updateData.periodDate = new Date(periodDate);
        
        const feedback = await FeedbackModel.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        ).populate('createdBy', 'username');
        
        if (!feedback) {
            return res.status(404).json({ error: 'Feedback not found' });
        }
        
        res.json(feedback);
    } catch (error) {
        logger.error('Failed to update feedback:', error);
        res.status(500).json({ error: 'Failed to update feedback' });
    }
});

// Eliminar retroalimentación
router.delete('/feedback/:id', authenticate, authorizeRoles(ROLES.CEO, ROLES.ADMIN), async (req, res) => {
    try {
        const feedback = await FeedbackModel.findByIdAndDelete(req.params.id);
        
        if (!feedback) {
            return res.status(404).json({ error: 'Feedback not found' });
        }
        
        res.json({ success: true, message: 'Feedback deleted' });
    } catch (error) {
        logger.error('Failed to delete feedback:', error);
        res.status(500).json({ error: 'Failed to delete feedback' });
    }
});

// Obtener retroalimentación de hoy o esta semana
router.get('/feedback/summary/current', authenticate, authorizeRoles(ROLES.CEO, ROLES.ADMIN), async (req, res) => {
    try {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        // Obtener inicio de la semana (Lunes)
        const dayOfWeek = now.getDay();
        const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Ajustar para que Lunes sea 0
        const weekStart = new Date(now.setDate(diff));
        weekStart.setHours(0, 0, 0, 0);
        
        const dayFeedback = await FeedbackModel.findOne({
            period: 'day',
            periodDate: { $gte: today }
        }).populate('createdBy', 'username').lean();
        
        const weekFeedback = await FeedbackModel.findOne({
            period: 'week',
            periodDate: { $gte: weekStart }
        }).populate('createdBy', 'username').lean();
        
        res.json({
            day: dayFeedback,
            week: weekFeedback
        });
    } catch (error) {
        logger.error('Failed to get current feedback summary:', error);
        res.status(500).json({ error: 'Failed to get feedback summary' });
    }
});

export default router;

