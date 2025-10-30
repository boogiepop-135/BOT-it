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
        const p = new ProjectModel(req.body);
        await p.save();
        res.status(201).json(p);
    } catch (e:any) {
        logger.error('Create project failed', e);
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

export default router;


