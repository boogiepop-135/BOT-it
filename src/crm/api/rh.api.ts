import express from 'express';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';
import { RequestModel } from '../models/request.model';
import { ROLES } from '../utils/rbac.util';

const router = express.Router();

// RH Compras: solicitudes de alta/baja
const RequestAny: any = RequestModel as any;
router.get('/requests', authenticate, authorizeRoles(ROLES.RH_COMPRAS, ROLES.ADMIN, ROLES.CEO), async (_req, res) => {
    const data = await RequestAny.find({}).sort({ createdAt: -1 }).lean().exec();
    res.json(data);
});

router.post('/requests', authenticate, authorizeRoles(ROLES.RH_COMPRAS, ROLES.ADMIN, ROLES.CEO), async (req, res) => {
    const doc = new RequestModel({ ...req.body, requestedBy: req.user.username || req.user.userId });
    await doc.save();
    res.status(201).json(doc);
});

router.patch('/requests/:id/status', authenticate, authorizeRoles(ROLES.RH_COMPRAS, ROLES.ADMIN, ROLES.CEO), async (req, res) => {
    const doc = await RequestAny.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, lean: true }).exec();
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
});

export default router;


