# 🤖 WhatsBot IT - Agente de Ventas Inteligente para WhatsApp

WhatsBot IT es un agente de ventas experto especializado en WhatsApp que utiliza la API de Gemini de Google para ayudar a las personas con sus consultas. Nuestro asistente virtual proporciona información experta sobre productos, maneja objeciones y guía a los clientes hasta cerrar la venta.

## ✨ Características Principales

- **🤖 Agente de Ventas Experto**: Agente de ventas especializado
- **🤖 Inteligencia Artificial Avanzada**: Utiliza Gemini AI para respuestas contextuales y orientadas a ventas
- **📱 Comandos Especializados**: Comandos específicos para productos, precios, guías y métodos de pago
- **🎯 Seguimiento de Leads**: Sistema de puntuación y seguimiento de clientes potenciales
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

## 📱 Comandos del Agente de Ventas

### Comandos Especializados en Ventas

| Comando | Descripción | Ejemplo |
|---------|-------------|---------|
| `/productos` | Información completa del compostero fermentador 15L | `/productos` |
| `/precios` | Precios, métodos de pago y garantías | `/precios` |
| `/guia` | Guía completa de uso del compostero | `/guia` |
| `/contacto` | Información de contacto y canales de atención | `/contacto` |
| `/pago` | Métodos de pago detallados | `/pago` |

### Comandos Generales

| Comando | Descripción | Ejemplo |
|---------|-------------|---------|
| `/chat [mensaje]` | Chatea con el agente de ventas | `/chat ¿Cuánto cuesta el compostero?` |
| `/help` | Muestra todos los comandos disponibles | `/help` |
| `/ping` | Verifica si WhatsBot IT está funcionando | `/ping` |

### Comandos de Administración

| Comando | Descripción | Ejemplo |
|---------|-------------|---------|
| `/estadisticas` | Estadísticas de ventas y leads | `/estadisticas` |

## 🎯 Características del Agente de Ventas

### Conocimiento Especializado
- Agente de ventas especializado
- Información detallada de productos
- Gestión de consultas y objeciones
- Seguimiento de leads y conversiones

### Manejo de Objeciones
- Gestión inteligente de objeciones
- Respuestas contextuales y personalizadas
- Seguimiento de interacciones

### Métodos de Pago
- Información detallada de métodos de pago
- Integración con sistemas de pago

### Seguimiento de Leads
- Sistema de puntuación automática
- Detección de intenciones de compra
- Estadísticas de conversión
- Seguimiento de interacciones

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
- Interacciones de ventas
- Puntuación de leads
- Objeciones manejadas
- Conversiones realizadas
- Errores de API

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

**WhatsBot IT** - *Agente de ventas inteligente de San Cosme IT* 🤖✨