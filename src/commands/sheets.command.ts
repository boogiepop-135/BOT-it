import { Message } from "whatsapp-web.js";
import { UserI18n } from "../utils/i18n.util";
import logger from "../configs/logger.config";
import { BotManager } from "../bot.manager";
import EnvConfig from "../configs/env.config";
import {
  initializeGoogleSheets,
  writeCell,
  writeRange,
  readRange,
  appendRow,
  syncProjectToSheets,
  syncTaskToSheets,
  createSheetHeaders
} from "../utils/google-sheets.util";
import { ProjectModel } from "../crm/models/project.model";
import { TaskModel } from "../crm/models/task.model";

export interface SheetsConversation {
  step: 'command' | 'write_cell_range' | 'write_cell_value' | 'write_row_data' | 'read_range' | 'sync_project' | 'sync_task' | 'none';
  action?: string;
  spreadsheetId?: string;
  sheetName?: string;
  range?: string;
}

export const conversations = new Map<string, SheetsConversation>();

export const run = async (message: Message, args: string[] | null, userI18n: UserI18n) => {
  try {
    const contact = await message.getContact();
    const userNumber = contact.number;
    const textoMensaje = message.body.trim().toLowerCase();
    const argsArray = args || textoMensaje.split(' ');

    // Verificar configuración
    if (!EnvConfig.GOOGLE_SHEETS_SPREADSHEET_ID && !EnvConfig.GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY && !EnvConfig.GOOGLE_SHEETS_CLIENT_EMAIL) {
      await message.reply(
        `❌ Google Sheets no está configurado.\n\n` +
        `Contacta al administrador para configurar la integración con Google Sheets.`
      );
      return;
    }

    // Inicializar Google Sheets si no está inicializado
    await initializeGoogleSheets();

    // Verificar si hay una conversación activa
    const conversation = conversations.get(userNumber);

    // Si el usuario escribe "cancel" o "cancelar"
    if (textoMensaje === 'cancel' || textoMensaje === 'cancelar' || textoMensaje === 'salir') {
      conversations.delete(userNumber);
      await message.reply('✅ Operación cancelada.');
      return;
    }

    // Si hay una conversación activa, procesarla
    if (conversation && conversation.step !== 'none') {
      await processSheetsConversation(message, conversation, userNumber);
      return;
    }

    // Detectar comandos
    const spreadsheetId = EnvConfig.GOOGLE_SHEETS_SPREADSHEET_ID || '';

    if (textoMensaje.includes("llenar hoja") || textoMensaje.includes("actualizar hoja") ||
        textoMensaje.includes("escribir en hoja") || textoMensaje.match(/llenar.*excel|actualizar.*excel/i)) {
      await iniciarLlenarHoja(message, userNumber, spreadsheetId);
      return;
    }

    if (textoMensaje.includes("leer hoja") || textoMensaje.includes("ver hoja") ||
        textoMensaje.includes("consultar hoja") || textoMensaje.match(/leer.*excel|ver.*excel/i)) {
      await iniciarLeerHoja(message, userNumber, spreadsheetId);
      return;
    }

    if (textoMensaje.includes("sincronizar proyecto") || textoMensaje.includes("sync proyecto") ||
        textoMensaje.match(/sincronizar.*proyecto|sync.*proyecto/i)) {
      await iniciarSincronizarProyecto(message, userNumber, spreadsheetId);
      return;
    }

    if (textoMensaje.includes("sincronizar todo") || textoMensaje.includes("sync todo") ||
        textoMensaje.includes("sincronizar proyectos")) {
      await sincronizarTodosProyectos(message, spreadsheetId);
      return;
    }

    // Si no se detecta intención, mostrar ayuda
    await message.reply(
      `📊 *Gestión de Google Sheets*\n\n` +
      `Comandos disponibles:\n\n` +
      `✏️ *LLENAR HOJA*\n` +
      `"llenar hoja" o "actualizar hoja"\n` +
      `Escribir datos en celdas específicas de Google Sheets.\n\n` +
      `👁️ *LEER HOJA*\n` +
      `"leer hoja" o "ver hoja"\n` +
      `Leer datos de un rango específico de Google Sheets.\n\n` +
      `🔄 *SINCRONIZAR PROYECTO*\n` +
      `"sincronizar proyecto [nombre]"\n` +
      `Sincronizar un proyecto específico a Google Sheets.\n\n` +
      `🔄 *SINCRONIZAR TODO*\n` +
      `"sincronizar todo" o "sync todo"\n` +
      `Sincronizar todos los proyectos y tareas a Google Sheets.\n\n` +
      `_Escribe \`cancel\` en cualquier momento para cancelar._`
    );
  } catch (error) {
    logger.error("Error en sheets.command:", error);
    await message.reply("❌ Ocurrió un error al procesar tu solicitud.");
  }
};

async function iniciarLlenarHoja(message: Message, userNumber: string, spreadsheetId: string) {
  const conversation: SheetsConversation = {
    step: 'write_cell_range',
    spreadsheetId
  };
  conversations.set(userNumber, conversation);
  
  await message.reply(
    `✏️ *Llenar Hoja de Google Sheets*\n\n` +
    `Primero, necesito el rango donde quieres escribir.\n\n` +
    `Ejemplos de rangos:\n` +
    `• A1 (una celda)\n` +
    `• A1:B5 (un rango)\n` +
    `• Proyectos!A1 (celda en hoja específica)\n` +
    `• Proyectos!A1:B10 (rango en hoja específica)\n\n` +
    `¿Cuál es el rango donde quieres escribir?`
  );
}

async function iniciarLeerHoja(message: Message, userNumber: string, spreadsheetId: string) {
  const conversation: SheetsConversation = {
    step: 'read_range',
    spreadsheetId
  };
  conversations.set(userNumber, conversation);
  
  await message.reply(
    `👁️ *Leer Hoja de Google Sheets*\n\n` +
    `Necesito el rango que quieres leer.\n\n` +
    `Ejemplos de rangos:\n` +
    `• A1:B10 (rango de celdas)\n` +
    `• Proyectos!A1:B10 (rango en hoja específica)\n` +
    `• Proyectos!A:A (toda la columna A)\n\n` +
    `¿Cuál es el rango que quieres leer?`
  );
}

async function iniciarSincronizarProyecto(message: Message, userNumber: string, spreadsheetId: string) {
  const texto = message.body.trim();
  const projectName = texto.replace(/sincronizar proyecto|sync proyecto/gi, '').trim();
  
  if (!projectName) {
    await message.reply(
      `🔄 *Sincronizar Proyecto*\n\n` +
      `¿Qué proyecto quieres sincronizar a Google Sheets?\n\n` +
      `Escribe el nombre del proyecto:`
    );
    return;
  }
  
  await sincronizarProyecto(message, spreadsheetId, projectName);
}

async function processSheetsConversation(message: Message, conversation: SheetsConversation, userNumber: string) {
  const texto = message.body.trim();
  const spreadsheetId = conversation.spreadsheetId || EnvConfig.GOOGLE_SHEETS_SPREADSHEET_ID || '';

  if (!spreadsheetId) {
    await message.reply('❌ No hay ID de hoja configurada. Contacta al administrador.');
    conversations.delete(userNumber);
    return;
  }

  switch (conversation.step) {
    case 'write_cell_range':
      conversation.range = texto;
      conversation.step = 'write_cell_value';
      
      await message.reply(
        `✅ Rango: *${texto}*\n\n` +
        `¿Qué valor quieres escribir en este rango?\n\n` +
        `Ejemplos:\n` +
        `• Un valor simple: "75"\n` +
        `• Texto: "Proyecto terminado"\n` +
        `• Múltiples valores (separados por coma): "Proyecto A, 75%, Activo"` +
        `¿Cuál es el valor?`
      );
      break;

    case 'write_cell_value':
      try {
        // Detectar si es un rango múltiple o una sola celda
        const range = conversation.range || 'A1';
        
        // Si el texto contiene comas, es múltiples valores
        if (texto.includes(',')) {
          const values = texto.split(',').map(v => v.trim());
          const values2D = [values];
          const success = await writeRange(spreadsheetId, range, values2D);
          
          if (success) {
            await message.reply(
              `✅ *Datos escritos exitosamente*\n\n` +
              `📍 Rango: ${range}\n` +
              `📝 Valores: ${values.join(', ')}\n\n` +
              `Los datos se han actualizado en Google Sheets.`
            );
          } else {
            await message.reply('❌ Error al escribir los datos. Verifica el rango y los permisos.');
          }
        } else {
          const success = await writeCell(spreadsheetId, range, texto);
          
          if (success) {
            await message.reply(
              `✅ *Dato escrito exitosamente*\n\n` +
              `📍 Rango: ${range}\n` +
              `📝 Valor: ${texto}\n\n` +
              `El dato se ha actualizado en Google Sheets.`
            );
          } else {
            await message.reply('❌ Error al escribir el dato. Verifica el rango y los permisos.');
          }
        }
      } catch (error: any) {
        logger.error('Error escribiendo en hoja:', error);
        await message.reply(`❌ Error: ${error.message || 'Error desconocido'}`);
      }
      conversations.delete(userNumber);
      break;

    case 'read_range':
      try {
        const data = await readRange(spreadsheetId, texto);
        
        if (!data || data.length === 0) {
          await message.reply(`⚠️ El rango "${texto}" está vacío o no existe.`);
          conversations.delete(userNumber);
          return;
        }

        let respuesta = `📊 *Datos de Google Sheets*\n\n`;
        respuesta += `📍 Rango: ${texto}\n\n`;
        
        // Mostrar hasta 20 filas para no saturar WhatsApp
        const maxRows = Math.min(data.length, 20);
        data.slice(0, maxRows).forEach((row: any[], index: number) => {
          respuesta += `${index + 1}. ${row.join(' | ')}\n`;
        });
        
        if (data.length > maxRows) {
          respuesta += `\n... y ${data.length - maxRows} filas más`;
        }

        await message.reply(respuesta);
      } catch (error: any) {
        logger.error('Error leyendo hoja:', error);
        await message.reply(`❌ Error: ${error.message || 'Error desconocido'}`);
      }
      conversations.delete(userNumber);
      break;
  }

  conversations.set(userNumber, conversation);
}

async function sincronizarProyecto(message: Message, spreadsheetId: string, projectName: string) {
  try {
    await message.reply('🔄 Sincronizando proyecto...');

    const project = await ProjectModel.findOne({ name: { $regex: projectName, $options: 'i' } }).lean();
    
    if (!project) {
      await message.reply(`❌ Proyecto "${projectName}" no encontrado.`);
      return;
    }

    const sheetName = 'Proyectos';
    
    // Crear headers si no existen
    await createSheetHeaders(spreadsheetId, sheetName, [
      'Nombre',
      'Estado',
      'Progreso (%)',
      'Fecha Inicio',
      'Fecha Fin',
      'Prioridad',
      'Última Actualización'
    ]);

    const success = await syncProjectToSheets(spreadsheetId, sheetName, project);

    if (success) {
      // Sincronizar tareas del proyecto también
      const tasks = await TaskModel.find({ projectId: project._id }).lean();
      
      if (tasks.length > 0) {
        const tasksSheetName = 'Tareas';
        
        // Crear headers para tareas
        await createSheetHeaders(spreadsheetId, tasksSheetName, [
          'ID Tarea',
          'Nombre',
          'Proyecto',
          'Estado',
          'Progreso (%)',
          'Fecha Inicio',
          'Fecha Fin',
          'Descripción',
          'Última Actualización'
        ]);

        for (const task of tasks) {
          await syncTaskToSheets(spreadsheetId, tasksSheetName, task, project.name);
        }
      }

      await message.reply(
        `✅ *Proyecto Sincronizado Exitosamente*\n\n` +
        `📝 Proyecto: ${project.name}\n` +
        `📊 Estado: ${project.status}\n` +
        `📈 Progreso: ${project.progress || 0}%\n` +
        `📋 Tareas sincronizadas: ${tasks.length}\n\n` +
        `Los datos se han actualizado en Google Sheets.`
      );
    } else {
      await message.reply('❌ Error al sincronizar el proyecto. Verifica la configuración de Google Sheets.');
    }
  } catch (error: any) {
    logger.error('Error sincronizando proyecto:', error);
    await message.reply(`❌ Error: ${error.message || 'Error desconocido'}`);
  }
}

async function sincronizarTodosProyectos(message: Message, spreadsheetId: string) {
  try {
    await message.reply('🔄 Sincronizando todos los proyectos y tareas... Esto puede tomar unos momentos.');

    const projects = await ProjectModel.find({}).lean();
    
    if (projects.length === 0) {
      await message.reply('⚠️ No hay proyectos para sincronizar.');
      return;
    }

    const sheetName = 'Proyectos';
    const tasksSheetName = 'Tareas';
    
    // Crear headers
    await createSheetHeaders(spreadsheetId, sheetName, [
      'Nombre',
      'Estado',
      'Progreso (%)',
      'Fecha Inicio',
      'Fecha Fin',
      'Prioridad',
      'Última Actualización'
    ]);

    await createSheetHeaders(spreadsheetId, tasksSheetName, [
      'ID Tarea',
      'Nombre',
      'Proyecto',
      'Estado',
      'Progreso (%)',
      'Fecha Inicio',
      'Fecha Fin',
      'Descripción',
      'Última Actualización'
    ]);

    let proyectosSincronizados = 0;
    let tareasSincronizadas = 0;

    for (const project of projects) {
      const success = await syncProjectToSheets(spreadsheetId, sheetName, project);
      if (success) proyectosSincronizados++;

      // Sincronizar tareas del proyecto
      const tasks = await TaskModel.find({ projectId: project._id }).lean();
      for (const task of tasks) {
        const taskSuccess = await syncTaskToSheets(spreadsheetId, tasksSheetName, task, project.name);
        if (taskSuccess) tareasSincronizadas++;
      }
    }

    await message.reply(
      `✅ *Sincronización Completa*\n\n` +
      `📊 Proyectos sincronizados: ${proyectosSincronizados}/${projects.length}\n` +
      `📋 Tareas sincronizadas: ${tareasSincronizadas}\n\n` +
      `Todos los datos se han actualizado en Google Sheets.`
    );
  } catch (error: any) {
    logger.error('Error sincronizando todos los proyectos:', error);
    await message.reply(`❌ Error: ${error.message || 'Error desconocido'}`);
  }
}
