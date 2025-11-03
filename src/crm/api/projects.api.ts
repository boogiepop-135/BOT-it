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
    const projects = await Project.find({}).sort({ createdAt: -1 }).lean().exec();
    res.json(projects);
});

router.post('/projects', authenticate, authorizePermission('projects','write'), async (req, res) => {
    try {
        const body = { ...req.body };
        
        // Si no hay fecha de inicio o fin, establecer status como 'planned' (por plantear)
        if (!body.startDate && !body.endDate) {
            body.status = 'planned';
        } else if (!body.status) {
            // Si hay fechas pero no se especificó status, verificar si ya pasó la fecha de inicio
            if (body.startDate && new Date(body.startDate) <= new Date()) {
                body.status = 'in_progress';
            } else {
                body.status = 'planned';
            }
        }
        
        const p = new ProjectModel(body);
        await p.save();
        res.status(201).json(p);
    } catch (e:any) {
        logger.error('Create project failed', e);
        res.status(400).json({ error: e.message });
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
        res.json(project);
    } catch (e:any) {
        logger.error('Update project failed', e);
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


