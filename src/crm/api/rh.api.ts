import express from 'express';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';
import { RequestModel } from '../models/request.model';
import { EmployeeModel } from '../models/employee.model';
import { ROLES } from '../utils/rbac.util';
import logger from '../../configs/logger.config';

const router = express.Router();

// RH Compras: solicitudes de alta/baja
const RequestAny: any = RequestModel as any;
router.get('/requests', authenticate, authorizeRoles(ROLES.RH_COMPRAS, ROLES.ADMIN, ROLES.CEO), async (_req, res) => {
    try {
        const data = await RequestAny.find({}).sort({ createdAt: -1 }).lean().exec();
        res.json(data);
    } catch (error) {
        logger.error('Failed to get requests:', error);
        res.status(500).json({ error: 'Failed to get requests' });
    }
});

router.post('/requests', authenticate, authorizeRoles(ROLES.RH_COMPRAS, ROLES.ADMIN, ROLES.CEO), async (req, res) => {
    try {
        const doc = new RequestModel({ ...req.body, requestedBy: req.user.username || req.user.userId });
        await doc.save();
        res.status(201).json(doc);
    } catch (error) {
        logger.error('Failed to create request:', error);
        res.status(500).json({ error: 'Failed to create request' });
    }
});

router.patch('/requests/:id/status', authenticate, authorizeRoles(ROLES.RH_COMPRAS, ROLES.ADMIN, ROLES.CEO), async (req, res) => {
    try {
        const doc = await RequestAny.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, lean: true }).exec();
        if (!doc) return res.status(404).json({ error: 'Not found' });
        res.json(doc);
    } catch (error) {
        logger.error('Failed to update request status:', error);
        res.status(500).json({ error: 'Failed to update request status' });
    }
});

/**
 * API de Gestión de Personal (Empleados)
 * Permite dar de alta y baja a empleados
 */

// Obtener todos los empleados
router.get('/employees', authenticate, authorizeRoles(ROLES.RH_COMPRAS, ROLES.ADMIN, ROLES.CEO), async (req, res) => {
    try {
        const { status, page = 1, limit = 20, search = '' } = req.query;
        
        const query: any = {};
        
        if (status) {
            query.status = status;
        }
        
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { phoneNumber: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { position: { $regex: search, $options: 'i' } },
                { department: { $regex: search, $options: 'i' } }
            ];
        }
        
        const skip = (Number(page) - 1) * Number(limit);
        
        const employees = await EmployeeModel.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .populate('createdBy', 'username')
            .populate('updatedBy', 'username')
            .lean();
        
        const total = await EmployeeModel.countDocuments(query);
        
        res.json({
            data: employees,
            meta: {
                total,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / Number(limit))
            }
        });
    } catch (error) {
        logger.error('Failed to get employees:', error);
        res.status(500).json({ error: 'Failed to get employees' });
    }
});

// Crear nuevo empleado (alta)
router.post('/employees', authenticate, authorizeRoles(ROLES.RH_COMPRAS, ROLES.ADMIN, ROLES.CEO), async (req, res) => {
    try {
        const { name, phoneNumber, email, position, department, hireDate, notes } = req.body;
        
        if (!name || !position) {
            return res.status(400).json({ error: 'Missing required fields: name, position' });
        }
        
        const employee = new EmployeeModel({
            name,
            phoneNumber,
            email,
            position,
            department,
            hireDate: hireDate ? new Date(hireDate) : new Date(),
            notes,
            status: 'active',
            createdBy: req.user.userId
        });
        
        await employee.save();
        
        res.status(201).json(employee);
    } catch (error) {
        logger.error('Failed to create employee:', error);
        res.status(500).json({ error: 'Failed to create employee' });
    }
});

// Obtener empleado por ID
router.get('/employees/:id', authenticate, authorizeRoles(ROLES.RH_COMPRAS, ROLES.ADMIN, ROLES.CEO), async (req, res) => {
    try {
        const employee = await EmployeeModel.findById(req.params.id)
            .populate('createdBy', 'username')
            .populate('updatedBy', 'username')
            .lean();
        
        if (!employee) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        
        res.json(employee);
    } catch (error) {
        logger.error('Failed to get employee:', error);
        res.status(500).json({ error: 'Failed to get employee' });
    }
});

// Actualizar empleado
router.put('/employees/:id', authenticate, authorizeRoles(ROLES.RH_COMPRAS, ROLES.ADMIN, ROLES.CEO), async (req, res) => {
    try {
        const { name, phoneNumber, email, position, department, status, notes } = req.body;
        
        const updateData: any = {
            updatedBy: req.user.userId
        };
        
        if (name) updateData.name = name;
        if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
        if (email !== undefined) updateData.email = email;
        if (position) updateData.position = position;
        if (department !== undefined) updateData.department = department;
        if (status) updateData.status = status;
        if (notes !== undefined) updateData.notes = notes;
        
        const employee = await EmployeeModel.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        ).populate('createdBy', 'username').populate('updatedBy', 'username');
        
        if (!employee) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        
        res.json(employee);
    } catch (error) {
        logger.error('Failed to update employee:', error);
        res.status(500).json({ error: 'Failed to update employee' });
    }
});

// Dar de baja a empleado
router.post('/employees/:id/deactivate', authenticate, authorizeRoles(ROLES.RH_COMPRAS, ROLES.ADMIN, ROLES.CEO), async (req, res) => {
    try {
        const { terminationDate, notes } = req.body;
        
        // Obtener el empleado primero para acceder a sus notas actuales
        const existingEmployee = await EmployeeModel.findById(req.params.id);
        if (!existingEmployee) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        
        const employee = await EmployeeModel.findByIdAndUpdate(
            req.params.id,
            {
                status: 'inactive',
                terminationDate: terminationDate ? new Date(terminationDate) : new Date(),
                notes: notes ? `${existingEmployee.notes || ''}\n[BAJA] ${notes}`.trim() : existingEmployee.notes,
                updatedBy: req.user.userId
            },
            { new: true }
        ).populate('createdBy', 'username').populate('updatedBy', 'username');
        
        if (!employee) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        
        res.json(employee);
    } catch (error) {
        logger.error('Failed to deactivate employee:', error);
        res.status(500).json({ error: 'Failed to deactivate employee' });
    }
});

// Dar de alta nuevamente a empleado
router.post('/employees/:id/activate', authenticate, authorizeRoles(ROLES.RH_COMPRAS, ROLES.ADMIN, ROLES.CEO), async (req, res) => {
    try {
        const employee = await EmployeeModel.findByIdAndUpdate(
            req.params.id,
            {
                status: 'active',
                terminationDate: null,
                updatedBy: req.user.userId
            },
            { new: true }
        ).populate('createdBy', 'username').populate('updatedBy', 'username');
        
        if (!employee) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        
        res.json(employee);
    } catch (error) {
        logger.error('Failed to activate employee:', error);
        res.status(500).json({ error: 'Failed to activate employee' });
    }
});

// Obtener estadísticas de empleados
router.get('/employees/stats/summary', authenticate, authorizeRoles(ROLES.RH_COMPRAS, ROLES.ADMIN, ROLES.CEO), async (req, res) => {
    try {
        const total = await EmployeeModel.countDocuments();
        const active = await EmployeeModel.countDocuments({ status: 'active' });
        const inactive = await EmployeeModel.countDocuments({ status: 'inactive' });
        const onLeave = await EmployeeModel.countDocuments({ status: 'on_leave' });
        
        res.json({
            total,
            active,
            inactive,
            onLeave
        });
    } catch (error) {
        logger.error('Failed to get employee stats:', error);
        res.status(500).json({ error: 'Failed to get employee stats' });
    }
});

export default router;


