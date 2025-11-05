# 🤖 WhatsBot IT - Bot de Soporte IT para WhatsApp

WhatsBot IT es un bot especializado en soporte técnico para WhatsApp que utiliza inteligencia artificial para ayudar a los usuarios con problemas de IT. El bot proporciona soporte técnico, gestión de tickets, proyectos y asistencia en general.

## ✨ Características Principales

- **🤖 Bot de Soporte IT**: Bot especializado en soporte técnico
- **🤖 Inteligencia Artificial Avanzada**: Utiliza Gemini AI y Claude para respuestas contextuales
- **📱 Comandos Especializados**: Comandos específicos para tickets, proyectos, horarios y más
- **🎯 Gestión de Tickets**: Sistema completo de gestión de tickets de soporte
- **🗣️ Comandos de Voz**: Procesamiento de audio con speech-to-text
- **🔊 Respuestas de Voz**: Text-to-speech para respuestas en audio
- **🌍 Multilingüe**: Soporte completo para múltiples idiomas
- **🔄 Traducción Automática**: Traducción instantánea entre idiomas
- **🌐 Panel de Administración**: Interfaz web para gestión y estadísticas

## 🚀 Instalación y Configuración

### Prerrequisitos

- **Node.js** (versión 16 o superior)
- **MongoDB** (local o en la nube)
- **Google Chrome** instalado
- **API Key de Gemini** (gratuita)

### 1. Instalación

```bash
# Clonar el repositorio
git clone <tu-repositorio>
cd whatsbot-it

# Instalar dependencias
npm install

# Configurar variables de entorno
cp whatsbot-it.env.example .env
```

### 2. Configuración de Variables de Entorno

Edita el archivo `.env` con tus configuraciones:

```env
# API Key de Gemini (OBLIGATORIO)
GEMINI_API_KEY=tu_api_key_de_gemini_aqui

# Ruta de Chrome (ajusta según tu sistema operativo)
PUPPETEER_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe

# Configuración básica
ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/whatsbot-it
JWT_SECRET=whatsbot_it_jwt_secret_muy_seguro_2024
```

### 3. Obtener API Key de Gemini

1. Ve a [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Inicia sesión con tu cuenta de Google
3. Haz clic en "Create API Key"
4. Copia la key generada
5. Pégala en tu archivo `.env`

### 4. Ejecutar WhatsBot IT

```bash
# Modo desarrollo (con recarga automática)
npm run dev

# Modo producción
npm start
```

## 📱 Comandos del Bot de Soporte IT

### Comandos de Soporte IT

| Comando | Descripción | Ejemplo |
|---------|-------------|---------|
| `/ticket` | Gestión de tickets de soporte | `/ticket create pos El POS no imprime` |
| `/proyectos` | Ver proyectos IT | `/proyectos` |
| `/horarios` | Ver horarios | `/horarios` |

### Comandos Generales

| Comando | Descripción | Ejemplo |
|---------|-------------|---------|
| `/chat [mensaje]` | Chatea con el asistente de IT | `/chat La impresora no funciona` |
| `/help` | Muestra todos los comandos disponibles | `/help` |
| `/ping` | Verifica si WhatsBot IT está funcionando | `/ping` |

### Comandos de Administración

| Comando | Descripción | Ejemplo |
|---------|-------------|---------|
| `/admin` | Panel de administración | `/admin` |

## 🎯 Características del Bot de Soporte IT

### Soporte Técnico
- Gestión completa de tickets de soporte
- Asistencia con problemas técnicos
- Seguimiento de incidencias
- Resolución de problemas comunes

### Gestión de Proyectos
- Visualización de proyectos IT
- Seguimiento de tareas
- Gestión de horarios

### Respuestas Inteligentes
- Respuestas contextuales usando IA
- Sugerencias proactivas de soluciones
- Guía paso a paso para resolver problemas

## 🔧 APIs Opcionales

Para funcionalidades adicionales, puedes configurar:

```env
# Para comandos de clima
OPENWEATHERMAP_API_KEY=tu_api_key

# Para text-to-speech
SPEECHIFY_API_KEY=tu_api_key

# Para speech-to-text
ASSEMBLYAI_API_KEY=tu_api_key
```

## 🌐 Panel de Administración

- Accede en: `http://localhost:3000`
- Gestión de usuarios y configuraciones
- Monitoreo del estado del bot
- Estadísticas de ventas y leads

## 🛠️ Solución de Problemas

### Error de API Key
```
Environment variable GEMINI_API_KEY is missing
```
**Solución**: Verifica que tu API key de Gemini esté correctamente configurada en `.env`

### Error de Chrome
```
PUPPETEER_EXECUTABLE_PATH is missing
```
**Solución**: Instala Google Chrome y actualiza la ruta en `.env`

### Error de MongoDB
```
MONGODB_URI is missing
```
**Solución**: Instala MongoDB y configura la URI de conexión

### Error de Conexión
```
Error comunicándose con WhatsBot IT
```
**Solución**: Verifica tu conexión a internet y la validez de tu API key

## 📊 Monitoreo y Logs

WhatsBot IT genera logs detallados para:
- Interacciones de soporte
- Tickets creados y resueltos
- Errores de API
- Problemas técnicos reportados

## 🔒 Seguridad

- Todas las comunicaciones están cifradas
- Las API keys se almacenan de forma segura
- No se almacenan mensajes personales
- Cumple con las políticas de WhatsApp

## 🤝 Contribuir

¿Quieres contribuir a WhatsBot IT? ¡Excelente!

1. Fork el repositorio
2. Crea una rama para tu feature
3. Haz commit de tus cambios
4. Push a la rama
5. Abre un Pull Request

## 📄 Licencia

MIT License - Ver archivo LICENSE para más detalles.

## 🆘 Soporte

¿Necesitas ayuda? Contacta con nosotros:
- 📱 WhatsApp: +52 56 6453 1621
- 📧 Email: contacto@sancosmeit.com
- 📘 Facebook: San Cosme IT
- 📸 Instagram: @sancosmeit

---

**WhatsBot IT** - *Bot de soporte IT de San Cosme Orgánico* 🤖✨