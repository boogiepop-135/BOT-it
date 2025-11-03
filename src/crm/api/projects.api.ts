import express from 'express';
import { authenticate, authorizePermission } from '../middlewares/auth.middleware';
import { ProjectModel } from '../models/project.model';
import { TaskModel } from '../models/task.model';
import logger from '../../configs/logger.config';

const router = express.Router();

// Projects
const Project: any = ProjectModel as any;
const Task: any = TaskModel as any;
router.get('/projects', authenticate, authorizePermission('projects','read'), async (_req, res) => {
    try {
        logger.info('GET /projects - Fetching all projects');
        const projects = await Project.find({}).sort({ createdAt: -1 }).lean().exec();
        logger.info(`GET /projects - Found ${projects.length} projects`);
        res.json(projects);
    } catch (e:any) {
        logger.error('GET /projects - Error:', e);
        res.status(500).json({ error: e.message || 'Error al obtener proyectos' });
    }
});

router.post('/projects', authenticate, authorizePermission('projects','write'), async (req, res) => {
    try {
        logger.info('POST /projects - Received request body:', JSON.stringify(req.body));
        logger.info('POST /projects - User:', req.user);
        
        const body: any = {};
        
        // Copiar campos requeridos
        if (req.body.name) {
            body.name = req.body.name.trim();
        } else {
            logger.error('POST /projects - Missing name field');
            return res.status(400).json({ error: 'El nombre del proyecto es requerido' });
        }
        
        // Copiar campos opcionales solo si existen
        if (req.body.startDate) {
            body.startDate = new Date(req.body.startDate);
            logger.info('POST /projects - Parsed startDate:', body.startDate);
        }
        if (req.body.endDate) {
            body.endDate = new Date(req.body.endDate);
            logger.info('POST /projects - Parsed endDate:', body.endDate);
        }
        if (req.body.progress !== undefined) {
            body.progress = Number(req.body.progress) || 0;
        } else {
            body.progress = 0;
        }
        if (req.body.priority) {
            body.priority = req.body.priority;
        } else {
            body.priority = 'medium';
        }
        
        // Si no hay fecha de inicio o fin, establecer status como 'planned' (por plantear)
        if (!body.startDate && !body.endDate) {
            body.status = 'planned';
        } else if (!req.body.status) {
            // Si hay fechas pero no se especificó status, verificar si ya pasó la fecha de inicio
            if (body.startDate && new Date(body.startDate) <= new Date()) {
                body.status = 'in_progress';
            } else {
                body.status = 'planned';
            }
        } else {
            body.status = req.body.status;
        }
        
        logger.info('Creating project with body:', JSON.stringify(body, null, 2));
        
        const p = new ProjectModel(body);
        logger.info('ProjectModel instance created, saving...');
        logger.info('Project document before save:', JSON.stringify(p.toObject ? p.toObject() : p));
        
        try {
            const saved = await p.save();
            logger.info('✅ Project saved to database successfully!');
            logger.info('   - ID:', saved._id);
            logger.info('   - Name:', saved.name);
            logger.info('   - Status:', saved.status);
            logger.info('   - Progress:', saved.progress);
            logger.info('   - Created At:', saved.createdAt);
            logger.info('   - Collection name:', saved.collection?.name || 'unknown');
            
            // Convertir a objeto plano para respuesta JSON
            const savedObj = saved.toObject ? saved.toObject() : saved;
            logger.info('Sending response with saved project:', JSON.stringify(savedObj, null, 2));
            
            // Sincronizar automáticamente con Google Sheets si está habilitado
            try {
                const { autoSyncIfEnabled } = await import('../../utils/google-sheets.util');
                await autoSyncIfEnabled();
            } catch (syncError: any) {
                // No fallar la request si la sincronización falla (es opcional)
                logger.warn('Auto-sync failed after project creation (optional):', syncError.message);
            }
            
            res.status(201).json(savedObj);
            logger.info('✅ Response sent successfully');
        } catch (saveError: any) {
            logger.error('❌ Error during save() operation');
            logger.error('   - Error name:', saveError?.name);
            logger.error('   - Error message:', saveError?.message);
            logger.error('   - Error code:', saveError?.code);
            logger.error('   - Error codeName:', saveError?.codeName);
            logger.error('   - Error stack:', saveError?.stack);
            throw saveError; // Re-throw para que sea capturado por el catch exterior
        }
    } catch (e:any) {
        logger.error('❌ Create project failed');
        logger.error('   - Error name:', e.name);
        logger.error('   - Error message:', e.message);
        logger.error('   - Error stack:', e.stack);
        logger.error('   - Full error:', JSON.stringify(e, Object.getOwnPropertyNames(e), 2));
        res.status(400).json({ error: e.message || 'Error al crear proyecto' });
    }
});

router.put('/projects/:projectId', authenticate, authorizePermission('projects','write'), async (req, res) => {
    try {
        const project = await Project.findByIdAndUpdate(
            req.params.projectId,
            req.body,
            { new: true, runValidators: true }
        ).lean().exec();
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        
        // Sincronizar automáticamente con Google Sheets si está habilitado
        try {
            const { autoSyncIfEnabled } = await import('../../utils/google-sheets.util');
            await autoSyncIfEnabled();
        } catch (syncError: any) {
            // No fallar la request si la sincronización falla (es opcional)
            logger.warn('Auto-sync failed after project update (optional):', syncError.message);
        }
        
        res.json(project);
    } catch (e:any) {
        logger.error('Update project failed', e);
        res.status(400).json({ error: e.message });
    }
});

router.delete('/projects/:projectId', authenticate, authorizePermission('projects','write'), async (req, res) => {
    try {
        logger.info(`DELETE /projects/${req.params.projectId} - Deleting project`);
        
        // Primero eliminar todas las tareas del proyecto
        const tasksDeleted = await Task.deleteMany({ projectId: req.params.projectId });
        logger.info(`   - Deleted ${tasksDeleted.deletedCount} tasks`);
        
        // Luego eliminar el proyecto
        const project = await Project.findByIdAndDelete(req.params.projectId).lean().exec();
        if (!project) {
            logger.warn(`   - Project ${req.params.projectId} not found`);
            return res.status(404).json({ error: 'Project not found' });
        }
        
        logger.info(`✅ Project deleted successfully: ${req.params.projectId}`);
        res.json({ success: true, message: 'Project deleted', deletedTasks: tasksDeleted.deletedCount });
    } catch (e:any) {
        logger.error('Delete project failed', e);
        res.status(400).json({ error: e.message });
    }
});

// Tasks
router.get('/projects/:projectId/tasks', authenticate, authorizePermission('tasks','read'), async (req, res) => {
    const tasks = await Task.find({ projectId: req.params.projectId }).sort({ startDate: 1 }).lean().exec();
    res.json(tasks);
});

router.post('/projects/:projectId/tasks', authenticate, authorizePermission('tasks','write'), async (req, res) => {
    try {
        const t = new TaskModel({ ...req.body, projectId: req.params.projectId });
        await t.save();
        
        // Sincronizar automáticamente con Google Sheets si está habilitado
        try {
            const { autoSyncIfEnabled } = await import('../../utils/google-sheets.util');
            await autoSyncIfEnabled();
        } catch (syncError: any) {
            // No fallar la request si la sincronización falla (es opcional)
            logger.warn('Auto-sync failed after task creation (optional):', syncError.message);
        }
        
        res.status(201).json(t);
    } catch (e:any) {
        logger.error('Create task failed', e);
        res.status(400).json({ error: e.message });
    }
});

router.put('/projects/:projectId/tasks/:taskId', authenticate, authorizePermission('tasks','write'), async (req, res) => {
    try {
        const task = await Task.findByIdAndUpdate(
            req.params.taskId,
            { ...req.body, projectId: req.params.projectId },
            { new: true, runValidators: true }
        ).lean().exec();
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        
        // Sincronizar automáticamente con Google Sheets si está habilitado
        try {
            const { autoSyncIfEnabled } = await import('../../utils/google-sheets.util');
            await autoSyncIfEnabled();
        } catch (syncError: any) {
            // No fallar la request si la sincronización falla (es opcional)
            logger.warn('Auto-sync failed after task update (optional):', syncError.message);
        }
        
        res.json(task);
    } catch (e:any) {
        logger.error('Update task failed', e);
        res.status(400).json({ error: e.message });
    }
});

router.delete('/projects/:projectId/tasks/:taskId', authenticate, authorizePermission('tasks','write'), async (req, res) => {
    try {
        const task = await Task.findByIdAndDelete(req.params.taskId).lean().exec();
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json({ success: true, message: 'Task deleted' });
    } catch (e:any) {
        logger.error('Delete task failed', e);
        res.status(400).json({ error: e.message });
    }
});

export default router;


