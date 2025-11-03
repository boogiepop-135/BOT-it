import { google } from 'googleapis';
import logger from '../configs/logger.config';
import EnvConfig from '../configs/env.config';
import fs from 'fs';
import path from 'path';

let sheetsClient: any = null;

/**
 * Inicializa el cliente de Google Sheets
 */
export async function initializeGoogleSheets(): Promise<boolean> {
  try {
    // Verificar si hay credenciales configuradas
    const credentialsPath = EnvConfig.GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY || 
                            process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY;
    const credsJsonInline = process.env.GOOGLE_CREDS_JSON;
    
    if (!credentialsPath && !credsJsonInline && !process.env.GOOGLE_SHEETS_CLIENT_EMAIL && !process.env.GOOGLE_SHEETS_PRIVATE_KEY) {
      logger.warn('⚠️  Google Sheets API no configurada. Variables de entorno faltantes.');
      return false;
    }

    let credentials: any;

    // Opción 1: Archivo JSON de Service Account
    if (credentialsPath) {
      const fullPath = path.isAbsolute(credentialsPath) 
        ? credentialsPath 
        : path.join(process.cwd(), credentialsPath);
      
      if (!fs.existsSync(fullPath)) {
        logger.error(`❌ Archivo de credenciales no encontrado: ${fullPath}`);
        return false;
      }

      credentials = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      logger.info('✅ Credenciales de Google Sheets cargadas desde archivo');
    }
    // Opción 1b: JSON inline via GOOGLE_CREDS_JSON
    else if (credsJsonInline) {
      try {
        credentials = JSON.parse(credsJsonInline);
        logger.info('✅ Credenciales de Google Sheets cargadas desde GOOGLE_CREDS_JSON');
      } catch (e) {
        logger.error('❌ GOOGLE_CREDS_JSON no es un JSON válido');
        return false;
      }
    }
    // Opción 2: Variables de entorno directas
    else if (process.env.GOOGLE_SHEETS_CLIENT_EMAIL && process.env.GOOGLE_SHEETS_PRIVATE_KEY) {
      credentials = {
        client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, '\n'),
        project_id: process.env.GOOGLE_SHEETS_PROJECT_ID || 'whatsbot-it'
      };
      logger.info('✅ Credenciales de Google Sheets cargadas desde variables de entorno');
    } else {
      logger.error('❌ Credenciales de Google Sheets no encontradas');
      return false;
    }

    // Crear cliente de autenticación
    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file'
      ]
    });

    const authClient = await auth.getClient();

    // Crear cliente de Google Sheets
    sheetsClient = google.sheets({ version: 'v4', auth: authClient });

    logger.info('✅ Google Sheets API inicializada correctamente');
    return true;
  } catch (error: any) {
    logger.error('❌ Error inicializando Google Sheets:', error);
    return false;
  }
}

/**
 * Obtiene metadatos del Spreadsheet (título y nombres de pestañas)
 */
export async function getSpreadsheetMetadata(spreadsheetId: string): Promise<{ title: string; sheets: string[] } | null> {
  try {
    if (!sheetsClient) {
      const initialized = await initializeGoogleSheets();
      if (!initialized) return null;
    }

    const response = await sheetsClient.spreadsheets.get({ spreadsheetId });
    const title = response.data.properties?.title || '';
    const sheets = (response.data.sheets || []).map((s: any) => s.properties?.title).filter(Boolean);
    return { title, sheets };
  } catch (error: any) {
    logger.error('❌ Error obteniendo metadatos del Spreadsheet:', error);
    return null;
  }
}

/**
 * Escribe datos en una celda específica de Google Sheets
 */
export async function writeCell(
  spreadsheetId: string,
  range: string,
  value: any
): Promise<boolean> {
  try {
    if (!sheetsClient) {
      const initialized = await initializeGoogleSheets();
      if (!initialized) {
        throw new Error('Google Sheets API no inicializada');
      }
    }

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[value]]
      }
    });

    logger.info(`✅ Celda actualizada: ${range} = ${value}`);
    return true;
  } catch (error: any) {
    logger.error(`❌ Error escribiendo celda ${range}:`, error);
    return false;
  }
}

/**
 * Escribe datos en múltiples celdas (rango)
 */
export async function writeRange(
  spreadsheetId: string,
  range: string,
  values: any[][]
): Promise<boolean> {
  try {
    if (!sheetsClient) {
      const initialized = await initializeGoogleSheets();
      if (!initialized) {
        throw new Error('Google Sheets API no inicializada');
      }
    }

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values
      }
    });

    logger.info(`✅ Rango actualizado: ${range} (${values.length} filas)`);
    return true;
  } catch (error: any) {
    logger.error(`❌ Error escribiendo rango ${range}:`, error);
    return false;
  }
}

/**
 * Limpia completamente el contenido de una hoja (todas las celdas)
 */
export async function clearSheet(
  spreadsheetId: string,
  sheetName: string
): Promise<boolean> {
  try {
    if (!sheetsClient) {
      const initialized = await initializeGoogleSheets();
      if (!initialized) {
        throw new Error('Google Sheets API no inicializada');
      }
    }
    await sheetsClient.spreadsheets.values.clear({
      spreadsheetId,
      range: `${sheetName}!A:ZZZ`
    });
    logger.info(`✅ Hoja limpiada: ${sheetName}`);
    return true;
  } catch (error: any) {
    logger.error(`❌ Error limpiando hoja ${sheetName}:`, error);
    return false;
  }
}

/**
 * Asegura que una hoja exista; si no, la crea
 */
export async function ensureSheetExists(
  spreadsheetId: string,
  sheetName: string
): Promise<boolean> {
  try {
    if (!sheetsClient) {
      const initialized = await initializeGoogleSheets();
      if (!initialized) return false;
    }
    const meta = await sheetsClient.spreadsheets.get({ spreadsheetId });
    const exists = meta.data.sheets?.some(s => s.properties?.title === sheetName);
    if (exists) return true;
    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: sheetName } } }]
      }
    });
    logger.info(`✅ Hoja creada: ${sheetName}`);
    return true;
  } catch (error: any) {
    logger.error(`❌ Error asegurando hoja ${sheetName}:`, error);
    return false;
  }
}

/**
 * Lee datos de un rango de Google Sheets
 */
export async function readRange(
  spreadsheetId: string,
  range: string
): Promise<any[][] | null> {
  try {
    if (!sheetsClient) {
      const initialized = await initializeGoogleSheets();
      if (!initialized) {
        throw new Error('Google Sheets API no inicializada');
      }
    }

    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId,
      range
    });

    const values = response.data.values || [];
    logger.info(`✅ Datos leídos: ${range} (${values.length} filas)`);
    return values;
  } catch (error: any) {
    logger.error(`❌ Error leyendo rango ${range}:`, error);
    return null;
  }
}

/**
 * Agrega una nueva fila al final de una hoja
 */
export async function appendRow(
  spreadsheetId: string,
  sheetName: string,
  values: any[]
): Promise<boolean> {
  try {
    if (!sheetsClient) {
      const initialized = await initializeGoogleSheets();
      if (!initialized) {
        throw new Error('Google Sheets API no inicializada');
      }
    }

    await sheetsClient.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:A`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [values]
      }
    });

    logger.info(`✅ Fila agregada a ${sheetName}: ${values.join(', ')}`);
    return true;
  } catch (error: any) {
    logger.error(`❌ Error agregando fila a ${sheetName}:`, error);
    return false;
  }
}

/**
 * Busca una fila por valor en una columna específica
 */
export async function findRowByValue(
  spreadsheetId: string,
  sheetName: string,
  searchColumn: string,
  searchValue: string
): Promise<number | null> {
  try {
    // Leer toda la columna
    const range = `${sheetName}!${searchColumn}:${searchColumn}`;
    const data = await readRange(spreadsheetId, range);
    
    if (!data) return null;

    // Buscar el valor (case-insensitive)
    const rowIndex = data.findIndex((row: any[]) => 
      row[0]?.toString().toLowerCase() === searchValue.toLowerCase()
    );

    if (rowIndex === -1) return null;

    // Retornar número de fila (1-indexed, +1 porque la primera fila es header)
    return rowIndex + 2;
  } catch (error: any) {
    logger.error(`❌ Error buscando fila:`, error);
    return null;
  }
}

/**
 * Actualiza una fila específica
 */
export async function updateRow(
  spreadsheetId: string,
  sheetName: string,
  rowNumber: number,
  values: any[]
): Promise<boolean> {
  try {
    // Calcular el rango (empezando desde la columna A)
    const startColumn = 'A';
    const endColumn = String.fromCharCode(65 + values.length - 1); // A, B, C, etc.
    const range = `${sheetName}!${startColumn}${rowNumber}:${endColumn}${rowNumber}`;

    return await writeRange(spreadsheetId, range, [values]);
  } catch (error: any) {
    logger.error(`❌ Error actualizando fila ${rowNumber}:`, error);
    return false;
  }
}

/**
 * Sincroniza un proyecto a Google Sheets
 */
export async function syncProjectToSheets(
  spreadsheetId: string,
  sheetName: string,
  project: any
): Promise<boolean> {
  try {
    // Buscar si el proyecto ya existe
    const rowNumber = await findRowByValue(spreadsheetId, sheetName, 'A', project.name);
    
    const values = [
      project.name || '',
      project.status || 'planned',
      project.progress || 0,
      project.startDate ? new Date(project.startDate).toLocaleDateString('es-MX') : '',
      project.endDate ? new Date(project.endDate).toLocaleDateString('es-MX') : '',
      project.priority || 'medium',
      new Date().toLocaleString('es-MX') // Última actualización
    ];

    if (rowNumber) {
      // Actualizar fila existente
      return await updateRow(spreadsheetId, sheetName, rowNumber, values);
    } else {
      // Agregar nueva fila
      return await appendRow(spreadsheetId, sheetName, values);
    }
  } catch (error: any) {
    logger.error('❌ Error sincronizando proyecto a Google Sheets:', error);
    return false;
  }
}

/**
 * Sincroniza una tarea a Google Sheets
 */
export async function syncTaskToSheets(
  spreadsheetId: string,
  sheetName: string,
  task: any,
  projectName: string
): Promise<boolean> {
  try {
    // Buscar si la tarea ya existe (usando ID o nombre único)
    const searchValue = task._id?.toString() || task.name;
    const rowNumber = await findRowByValue(spreadsheetId, sheetName, 'A', searchValue);
    
    const values = [
      task._id?.toString() || task.name,
      task.name || '',
      projectName || '',
      task.status || 'todo',
      task.progress || 0,
      task.startDate ? new Date(task.startDate).toLocaleDateString('es-MX') : '',
      task.endDate ? new Date(task.endDate).toLocaleDateString('es-MX') : '',
      task.description || '',
      new Date().toLocaleString('es-MX') // Última actualización
    ];

    if (rowNumber) {
      // Actualizar fila existente
      return await updateRow(spreadsheetId, sheetName, rowNumber, values);
    } else {
      // Agregar nueva fila
      return await appendRow(spreadsheetId, sheetName, values);
    }
  } catch (error: any) {
    logger.error('❌ Error sincronizando tarea a Google Sheets:', error);
    return false;
  }
}

/**
 * Crea los headers de una hoja si no existen
 */
export async function createSheetHeaders(
  spreadsheetId: string,
  sheetName: string,
  headers: string[]
): Promise<boolean> {
  try {
    if (!sheetsClient) {
      const initialized = await initializeGoogleSheets();
      if (!initialized) {
        throw new Error('Google Sheets API no inicializada');
      }
    }

    // Leer la primera fila para verificar si ya existen headers
    const existing = await readRange(spreadsheetId, `${sheetName}!A1:${String.fromCharCode(65 + headers.length - 1)}1`);
    
    if (existing && existing.length > 0) {
      logger.info(`✅ Headers ya existen en ${sheetName}`);
      return true;
    }

    // Crear headers
    await writeRange(spreadsheetId, `${sheetName}!A1:${String.fromCharCode(65 + headers.length - 1)}1`, [headers]);

    // Formatear headers (negrita, fondo gris)
    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: await getSheetId(spreadsheetId, sheetName),
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: headers.length
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
                  textFormat: { bold: true }
                }
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)'
            }
          }
        ]
      }
    });

    logger.info(`✅ Headers creados en ${sheetName}`);
    return true;
  } catch (error: any) {
    logger.error(`❌ Error creando headers:`, error);
    return false;
  }
}

/**
 * Obtiene el ID numérico de una hoja por nombre
 */
async function getSheetId(spreadsheetId: string, sheetName: string): Promise<number | null> {
  try {
    if (!sheetsClient) {
      const initialized = await initializeGoogleSheets();
      if (!initialized) return null;
    }

    const response = await sheetsClient.spreadsheets.get({
      spreadsheetId
    });

    const sheet = response.data.sheets?.find((s: any) => s.properties.title === sheetName);
    return sheet?.properties.sheetId || null;
  } catch (error: any) {
    logger.error('Error obteniendo Sheet ID:', error);
    return null;
  }
}
