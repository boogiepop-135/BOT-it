# 📊 Configuración de Google Sheets Integration

Esta guía explica cómo configurar la integración con Google Sheets para llenar y actualizar datos en hojas de Excel en línea desde WhatsApp.

## 🚀 Configuración Rápida

### 1. Crear un Service Account en Google Cloud

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita la **Google Sheets API**:
   - Ve a "APIs & Services" > "Library"
   - Busca "Google Sheets API"
   - Haz clic en "Enable"

4. Crea un **Service Account**:
   - Ve a "APIs & Services" > "Credentials"
   - Haz clic en "Create Credentials" > "Service Account"
   - Nombre: `whatsbot-sheets` (o el que prefieras)
   - Role: "Editor" o "Owner"
   - Haz clic en "Done"

5. **Genera una clave JSON**:
   - En la lista de Service Accounts, haz clic en el que acabas de crear
   - Ve a la pestaña "Keys"
   - Haz clic en "Add Key" > "Create new key"
   - Selecciona "JSON"
   - Descarga el archivo JSON

### 2. Compartir la Hoja de Google Sheets

1. Abre tu hoja de Google Sheets
2. Haz clic en "Compartir" (botón azul en la esquina superior derecha)
3. Copia el **email del Service Account** (se ve como `whatsbot-sheets@tu-proyecto.iam.gserviceaccount.com`)
4. Pega el email y dale permisos de **Editor**
5. Haz clic en "Enviar"

### 3. Obtener el ID de la Hoja

El ID de la hoja está en la URL:
```
https://docs.google.com/spreadsheets/d/[ESTE_ES_EL_ID]/edit
```

Por ejemplo, si tu URL es:
```
https://docs.google.com/spreadsheets/d/1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uV2wX3yZ4aB5cD/edit
```

El ID es: `1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uV2wX3yZ4aB5cD`

### 4. Configurar Variables de Entorno

Tienes dos opciones para configurar las credenciales:

#### Opción A: Archivo JSON (Recomendado para desarrollo)

1. Guarda el archivo JSON del Service Account en tu proyecto (ej: `credentials/google-sheets-key.json`)
2. Agrega a tu `.env`:
```env
GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY=./credentials/google-sheets-key.json
GOOGLE_SHEETS_SPREADSHEET_ID=1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uV2wX3yZ4aB5cD
GOOGLE_SHEETS_AUTO_SYNC=true  # Opcional: sincronización automática
```

#### Opción B: JSON String (Recomendado para producción/Railway)

1. Lee el contenido del archivo JSON
2. Conviértelo a una sola línea (sin saltos de línea)
3. Agrega a tu `.env` o variables de entorno de Railway:
```env
GOOGLE_SHEETS_CREDENTIALS={"type":"service_account","project_id":"tu-proyecto",...}
GOOGLE_SHEETS_SPREADSHEET_ID=1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uV2wX3yZ4aB5cD
GOOGLE_SHEETS_AUTO_SYNC=true
```

## 📝 Comandos de WhatsApp

Una vez configurado, puedes usar estos comandos desde WhatsApp:

### Actualizar Celda
```
"actualizar celda"
o "llenar celda"
```
Te guiará paso a paso para actualizar una celda específica.

### Buscar y Actualizar Fila
```
"actualizar fila"
o "buscar y actualizar"
```
Busca una fila por un valor y actualiza otra columna.

### Agregar Fila
```
"agregar fila"
o "nueva fila"
```
Agrega una nueva fila al final de la hoja.

### Leer Hoja
```
"leer hoja"
o "ver hoja"
```
Lee y muestra datos de un rango específico.

### Sincronizar Proyectos
```
"sincronizar proyectos"
o "sync"
```
Sincroniza todos los proyectos de la base de datos a una hoja llamada "Proyectos".

## 🔄 Sincronización Automática

Si configuraste `GOOGLE_SHEETS_AUTO_SYNC=true`, el sistema sincronizará automáticamente los proyectos cuando:

- Se crea un nuevo proyecto
- Se actualiza un proyecto
- Se crea una nueva tarea
- Se actualiza una tarea

La sincronización es opcional y no fallará la operación principal si hay algún error.

## 📋 Estructura de la Hoja "Proyectos"

Cuando sincronizas proyectos, se crea/actualiza una hoja con esta estructura:

| Proyecto | Estado | Progreso (%) | Prioridad | Fecha Inicio | Fecha Fin | Tareas Totales | Tareas Completadas |
|----------|--------|--------------|-----------|--------------|-----------|----------------|-------------------|
| Proyecto A | En Progreso | 75 | Media | 01/11/2025 | 15/12/2025 | 10 | 7 |

## ⚠️ Notas Importantes

1. **Permisos**: Asegúrate de que el Service Account tenga permisos de "Editor" en la hoja
2. **ID de Hoja**: El ID debe ser correcto, de lo contrario recibirás errores
3. **Formato de Rangos**: Usa el formato `Hoja1!A1` o `Hoja1!A1:B10` para rangos
4. **Sincronización Automática**: Puede tardar unos segundos, es normal
5. **Errores**: Si hay errores, verifica los logs del servidor

## 🐛 Solución de Problemas

### Error: "Authentication failed"
- Verifica que el archivo JSON del Service Account sea correcto
- Asegúrate de que el Service Account esté habilitado

### Error: "Permission denied"
- Verifica que compartiste la hoja con el email del Service Account
- Asegúrate de dar permisos de "Editor"

### Error: "Spreadsheet not found"
- Verifica que el ID de la hoja sea correcto
- Asegúrate de que la hoja existe y está accesible

### La sincronización no funciona
- Verifica que `GOOGLE_SHEETS_AUTO_SYNC=true` esté configurado
- Verifica que `GOOGLE_SHEETS_SPREADSHEET_ID` esté configurado
- Revisa los logs del servidor para más detalles

## 📚 Recursos

- [Google Sheets API Documentation](https://developers.google.com/sheets/api)
- [Service Accounts Guide](https://cloud.google.com/iam/docs/service-accounts)
- [Node.js Google APIs Client](https://github.com/googleapis/google-api-nodejs-client)

