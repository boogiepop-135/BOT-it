import express from 'express';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';
import { InventoryCostModel } from '../models/inventoryCost.model';
import { ROLES } from '../utils/rbac.util';

const router = express.Router();
const InventoryCostAny: any = InventoryCostModel as any;

router.get('/inventory-costs', authenticate, authorizeRoles(ROLES.FINANZAS, ROLES.ADMIN, ROLES.CEO), async (_req, res) => {
    const items = await InventoryCostAny.find({}).sort({ updatedAt: -1 }).lean().exec();
    res.json(items);
});

router.post('/inventory-costs', authenticate, authorizeRoles(ROLES.FINANZAS, ROLES.ADMIN, ROLES.CEO), async (req, res) => {
    const item = new InventoryCostAny(req.body);
    await item.save();
    res.status(201).json(item);
});

export default router;


