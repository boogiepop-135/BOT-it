import express from 'express';
import logger from '../../configs/logger.config';
import { authenticate, authorizeAdmin } from '../middlewares/auth.middleware';
import { SheetIntegrationModel } from '../models/sheet-integration.model';
import { initializeGoogleSheets, getSpreadsheetMetadata, ensureSheetExists, writeRange, readRange } from '../../utils/google-sheets.util';
import mongoose from 'mongoose';

export const router = express.Router();

function extractSpreadsheetId(urlOrId: string): string | null {
    if (!urlOrId) return null;
    // Si ya parece ser un ID (no contiene 'http' y sin slash largo)
    if (!/^https?:\/\//i.test(urlOrId) && urlOrId.length > 20) return urlOrId;
    // URL típica: https://docs.google.com/spreadsheets/d/{ID}/edit
    const m = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return m ? m[1] : null;
}

export default function sheetsApi() {
    // Conectar una nueva hoja por URL o ID
    router.post('/connect', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { url } = req.body;
            const spreadsheetId = extractSpreadsheetId(url);
            if (!spreadsheetId) {
                return res.status(400).json({ error: 'URL o ID de Spreadsheet inválido' });
            }

            // Inicializar cliente
            const ok = await initializeGoogleSheets();
            if (!ok) return res.status(500).json({ error: 'Google Sheets API no inicializada' });

            // Leer metadatos
            const meta = await getSpreadsheetMetadata(spreadsheetId);
            if (!meta) return res.status(404).json({ error: 'No se pudo obtener metadatos del Spreadsheet' });

            // Guardar/actualizar integración
            const doc = await SheetIntegrationModel.findOneAndUpdate(
                { spreadsheetId },
                { $set: { url, title: meta.title, sheets: meta.sheets } },
                { upsert: true, new: true }
            );

            res.json({ success: true, data: doc });
        } catch (error) {
            logger.error('Error conectando Spreadsheet:', error);
            res.status(500).json({ error: 'Error conectando Spreadsheet' });
        }
    });

    // Listar integraciones
    router.get('/', authenticate, authorizeAdmin, async (_req, res) => {
        try {
            const docs = await SheetIntegrationModel.find().sort({ updatedAt: -1 });
            res.json({ data: docs });
        } catch (error) {
            logger.error('Error listando integraciones:', error);
            res.status(500).json({ error: 'Error listando integraciones' });
        }
    });

    // Obtener metadatos/hojas por integración
    router.get('/:id/sheets', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const integ = await SheetIntegrationModel.findById(id);
            if (!integ) return res.status(404).json({ error: 'Integración no encontrada' });

            const meta = await getSpreadsheetMetadata(integ.spreadsheetId);
            if (!meta) return res.status(404).json({ error: 'No se pudieron obtener hojas' });

            // Actualizar nombre y hojas en DB para mantener fresco
            integ.title = meta.title;
            integ.sheets = meta.sheets;
            await integ.save();

            res.json({ title: meta.title, sheets: meta.sheets });
        } catch (error) {
            logger.error('Error obteniendo hojas:', error);
            res.status(500).json({ error: 'Error obteniendo hojas' });
        }
    });

    // Guardar mapeo de una hoja a una colección de BD
    router.post('/:id/map', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const { sheetName, collection, fieldMap } = req.body;
            if (!sheetName || !collection) return res.status(400).json({ error: 'sheetName y collection son requeridos' });

            const integ = await SheetIntegrationModel.findById(id);
            if (!integ) return res.status(404).json({ error: 'Integración no encontrada' });

            const existing = integ.mappings.find(m => m.sheetName === sheetName);
            if (existing) {
                existing.collection = collection;
                existing.fieldMap = fieldMap || {};
            } else {
                integ.mappings.push({ sheetName, collection, fieldMap: fieldMap || {} });
            }
            await integ.save();

            res.json({ success: true, data: integ });
        } catch (error) {
            logger.error('Error guardando mapeo:', error);
            res.status(500).json({ error: 'Error guardando mapeo' });
        }
    });

    // Desvincular una colección (quitar mapeo)
    router.delete('/:id/map', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const { collection } = req.body;
            if (!collection) return res.status(400).json({ error: 'Colección requerida' });
            const integ = await SheetIntegrationModel.findById(id);
            if (!integ) return res.status(404).json({ error: 'Integración no encontrada' });
            integ.mappings = (integ.mappings || []).filter(m => m.collection !== collection);
            await integ.save();
            res.json({ success: true, data: integ });
        } catch (error) {
            logger.error('Error desvinculando mapeo:', error);
            res.status(500).json({ error: 'Error desvinculando mapeo' });
        }
    });

    // Sincronizar: volcar datos de una colección a su hoja mapeada
    router.post('/:id/sync', authenticate, authorizeAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const { collection } = req.body;
            if (!collection) return res.status(400).json({ error: 'Colección requerida' });
            const integ = await SheetIntegrationModel.findById(id);
            if (!integ) return res.status(404).json({ error: 'Integración no encontrada' });
            const mapping = (integ.mappings || []).find(m => m.collection === collection);
            if (!mapping) return res.status(400).json({ error: 'No existe mapeo para esta colección' });

            const sheetName = mapping.sheetName;
            const spreadsheetId = integ.spreadsheetId;

            logger.info(`Sync: ${collection} -> ${sheetName} en ${spreadsheetId}`);

            const db = mongoose.connection.db;
            if (!db) return res.status(500).json({ error: 'DB no disponible' });
            
            const docs = await db.collection(collection).find({}).limit(5000).toArray();
            logger.info(`Sync: Encontrados ${docs.length} documentos en ${collection}`);
            
            if (docs.length === 0) {
                return res.json({ success: true, message: `Colección ${collection} está vacía`, synced: 0 });
            }

            // Generar headers: si hay fieldMap, usar valores; si no, usar keys del primer doc
            let headers: string[] = [];
            if (mapping.fieldMap && Object.keys(mapping.fieldMap).length > 0) {
                headers = Object.values(mapping.fieldMap);
            } else {
                // Obtener todas las keys únicas de todos los documentos
                const allKeys = new Set<string>();
                docs.forEach(doc => {
                    Object.keys(doc).forEach(k => {
                        if (k !== '_id') allKeys.add(k);
                    });
                });
                headers = Array.from(allKeys).sort();
            }

            logger.info(`Sync: Headers generados (${headers.length}): ${headers.join(', ')}`);

            const rows: any[][] = [headers]; // Primera fila: headers
            for (const doc of docs) {
                const row: any[] = [];
                if (mapping.fieldMap && Object.keys(mapping.fieldMap).length > 0) {
                    // Usar fieldMap para mapear campos
                    Object.keys(mapping.fieldMap).forEach(src => {
                        const val = (doc as any)[src];
                        row.push(val != null ? String(val) : '');
                    });
                } else {
                    // Usar headers en el mismo orden
                    headers.forEach(h => {
                        const val = (doc as any)[h];
                        row.push(val != null ? String(val) : '');
                    });
                }
                rows.push(row);
            }

            logger.info(`Sync: ${rows.length} filas preparadas (${rows.length - 1} datos + 1 header)`);

            await ensureSheetExists(spreadsheetId, sheetName);
            
            // Siempre sobrescribir desde A1 si no hay fieldMap o si queremos reemplazar todo
            // Por ahora: siempre escribir desde A1 para reemplazar completamente
            const ok = await writeRange(spreadsheetId, `${sheetName}!A1`, rows);
            
            if (!ok) {
                logger.error(`Sync: Falló writeRange para ${sheetName}!A1`);
                return res.status(500).json({ error: 'Falló escritura en Sheets' });
            }
            
            logger.info(`Sync: ✅ Éxito - ${docs.length} registros sincronizados a ${sheetName}`);
            res.json({ success: true, message: `Sincronizados ${docs.length} registros de ${collection} a ${sheetName}`, synced: docs.length });
        } catch (error: any) {
            logger.error('Error sincronizando colección a hoja:', error);
            logger.error('Stack:', error.stack);
            res.status(500).json({ error: error.message || 'Error al sincronizar' });
        }
    });

    // Listar colecciones de la BD
    router.get('/db/collections/list', authenticate, authorizeAdmin, async (_req, res) => {
        try {
            const db = mongoose.connection.db;
            if (!db) return res.status(500).json({ error: 'DB no disponible' });
            const cols = await db.listCollections().toArray();
            res.json({ collections: cols.map(c => c.name).sort() });
        } catch (error) {
            logger.error('Error listando colecciones:', error);
            res.status(500).json({ error: 'Error listando colecciones' });
        }
    });

    return router;
}


