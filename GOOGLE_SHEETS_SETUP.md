# Configuración de Google Sheets API

Esta guía te ayudará a configurar la integración con Google Sheets para que el bot pueda llenar y leer datos de hojas de Excel en línea.

## Paso 1: Crear un Proyecto en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita la **Google Sheets API** y **Google Drive API**:
   - Ve a "APIs & Services" > "Library"
   - Busca "Google Sheets API" y habilítala
   - Busca "Google Drive API" y habilítala

## Paso 2: Crear Service Account

1. Ve a "APIs & Services" > "Credentials"
2. Haz clic en "Create Credentials" > "Service Account"
3. Completa:
   - **Service account name**: `whatsbot-sheets` (o el que prefieras)
   - **Service account ID**: Se genera automáticamente
   - Haz clic en "Create and Continue"
4. En "Grant this service account access to project":
   - Rol: `Editor` (o más restrictivo según tus necesidades)
   - Haz clic en "Continue" > "Done"

## Paso 3: Generar Clave JSON

1. En la lista de Service Accounts, haz clic en el que acabas de crear
2. Ve a la pestaña "Keys"
3. Haz clic en "Add Key" > "Create new key"
4. Selecciona formato **JSON**
5. Haz clic en "Create"
6. Se descargará un archivo JSON con las credenciales (guárdalo de forma segura)

## Paso 4: Compartir la Hoja de Google Sheets

1. Abre o crea tu hoja de Google Sheets
2. Haz clic en el botón **"Compartir"** (arriba a la derecha)
3. En "Agregar personas o grupos", ingresa el **email del Service Account** (lo encuentras en el JSON descargado, campo `client_email`)
   - Ejemplo: `whatsbot-sheets@tu-proyecto.iam.gserviceaccount.com`
4. Da permisos de **"Editor"** al Service Account
5. Haz clic en "Compartir"
6. Copia el **ID de la hoja** desde la URL:
   ```
   https://docs.google.com/spreadsheets/d/[ESTE_ES_EL_ID]/edit
   ```

## Paso 5: Configurar Variables de Entorno

Tienes **3 opciones** para configurar las credenciales:

### Opción A: Archivo JSON (Recomendado para desarrollo local)

1. Coloca el archivo JSON descargado en el proyecto (por ejemplo, en `credentials/google-sheets-key.json`)
2. Agrega a tu `.env`:
   ```env
   GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY=credentials/google-sheets-key.json
   GOOGLE_SHEETS_SPREADSHEET_ID=tu_id_de_la_hoja_aqui
   ```

### Opción B: Variables de Entorno Directas (Recomendado para producción en Railway/Render)

Agrega estas variables de entorno:

```env
GOOGLE_SHEETS_CLIENT_EMAIL=whatsbot-sheets@tu-proyecto.iam.gserviceaccount.com
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...tu clave privada...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_PROJECT_ID=tu-proyecto-id
GOOGLE_SHEETS_SPREADSHEET_ID=tu_id_de_la_hoja_aqui
```

**Nota importante**: El `PRIVATE_KEY` debe incluir los caracteres `\n` literalmente, no saltos de línea reales. Si estás usando Railway/Render, copia el valor del JSON y reemplaza los saltos de línea reales con `\n`.

### Opción C: JSON como String (Alternativa)

Si prefieres, puedes pasar el JSON completo como string:

```env
GOOGLE_SHEETS_CREDENTIALS={"type":"service_account","project_id":"...","private_key_id":"...","private_key":"...","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}
GOOGLE_SHEETS_SPREADSHEET_ID=tu_id_de_la_hoja_aqui
```

## Paso 6: Estructura de las Hojas

El bot automáticamente creará las siguientes hojas si no existen:

### Hoja "Proyectos"
Headers:
- Nombre
- Estado
- Progreso (%)
- Fecha Inicio
- Fecha Fin
- Prioridad
- Última Actualización

### Hoja "Tareas"
Headers:
- ID Tarea
- Nombre
- Proyecto
- Estado
- Progreso (%)
- Fecha Inicio
- Fecha Fin
- Descripción
- Última Actualización

## Uso desde WhatsApp

Una vez configurado, puedes usar estos comandos:

### Llenar/Actualizar Hoja
```
llenar hoja
```
El bot te pedirá:
1. Rango (ej: `A1` o `Proyectos!A1:B10`)
2. Valor o valores (ej: `75` o `Proyecto A, 75%, Activo`)

### Leer Hoja
```
leer hoja
```
El bot te pedirá el rango a leer (ej: `A1:B10` o `Proyectos!A:A`)

### Sincronizar Proyecto
```
sincronizar proyecto [nombre del proyecto]
```
Sincroniza un proyecto específico y sus tareas a Google Sheets

### Sincronizar Todo
```
sincronizar todo
```
Sincroniza todos los proyectos y tareas a Google Sheets

## Sincronización Automática

El bot **automáticamente sincroniza** cuando:
- ✅ Se crea un nuevo proyecto
- ✅ Se actualiza un proyecto
- ✅ Se crea una nueva tarea
- ✅ Se actualiza una tarea

La sincronización es **opcional** y no bloqueará las operaciones si falla.

## Solución de Problemas

### Error: "Google Sheets API no inicializada"
- Verifica que las variables de entorno estén configuradas
- Revisa los logs para ver detalles del error

### Error: "Permission denied" o "Forbidden"
- Asegúrate de haber compartido la hoja con el email del Service Account
- Verifica que el Service Account tenga permisos de "Editor"

### Error: "Spreadsheet not found"
- Verifica que el `GOOGLE_SHEETS_SPREADSHEET_ID` sea correcto
- El ID está en la URL de la hoja: `https://docs.google.com/spreadsheets/d/[ID]/edit`

## Seguridad

⚠️ **IMPORTANTE**: 
- Nunca subas el archivo JSON de credenciales a Git
- Usa variables de entorno en producción
- El Service Account debe tener solo los permisos necesarios (Editor de la hoja específica, no del proyecto completo)
