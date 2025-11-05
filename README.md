# 🤖 Levi Assistant - Asistente Personal para Clientes Freelancer

Asistente virtual personal de Levi Villarreal diseñado para atender clientes freelancer a través de WhatsApp. Utiliza inteligencia artificial para proporcionar información sobre servicios, proyectos y disponibilidad.

## 👨‍💻 Sobre Levi Villarreal

🎓 De químico a Desarrollador Full Stack y Analista de IT, combino el análisis de datos y la precisión de laboratorio con la creatividad del código.

💻 Actualmente trabajo como Analista de IT y desarrollo soluciones completas con Python, Node.js, React, Flask, TensorFlow, análisis de datos y SQL.

🚀 Especializado en:
- Desarrollo Full Stack (Python, Node.js, React, Flask)
- Desarrollo de chatbots y automatización conversacional
- Análisis de datos y proyectos de data science
- Machine Learning y aplicaciones de IA
- Desarrollo de aplicaciones web completas
- Automatización de procesos

## ✨ Características Principales

- **🤖 Asistente Personal**: Bot especializado en atención a clientes freelancer
- **🤖 Inteligencia Artificial Avanzada**: Utiliza Gemini AI y Claude para respuestas contextuales
- **📱 Comandos Especializados**: Comandos específicos para tickets, proyectos, horarios y más
- **🎯 Gestión de Proyectos**: Sistema completo de gestión de proyectos freelancer
- **🗣️ Comandos de Voz**: Procesamiento de audio con speech-to-text
- **🔊 Respuestas de Voz**: Text-to-speech para respuestas en audio
- **🌍 Multilingüe**: Soporte completo para múltiples idiomas
- **🔄 Traducción Automática**: Traducción instantánea entre idiomas
- **🌐 Panel de Administración**: Interfaz web para gestión y estadísticas

## 🛠️ Tecnologías que manejo

**Frontend:**
- React
- JavaScript
- Bootstrap
- HTML5
- CSS3

**Backend:**
- Node.js
- Python
- Flask
- SQL

**Machine Learning & AI:**
- TensorFlow

**Análisis de Datos:**
- Pandas
- NumPy
- Jupyter

**Otras herramientas:**
- Git
- Linux
- Arduino

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

### 4. Ejecutar Levi Assistant

```bash
# Modo desarrollo (con recarga automática)
npm run dev

# Modo producción
npm start
```

## 📱 Comandos del Asistente

### Comandos de Gestión

| Comando | Descripción | Ejemplo |
|---------|-------------|---------|
| `/ticket` | Gestión de tickets de soporte/proyectos | `/ticket create proyecto Necesito una app web` |
| `/proyectos` | Ver proyectos activos | `/proyectos` |
| `/horarios` | Ver horarios disponibles | `/horarios` |

### Comandos Generales

| Comando | Descripción | Ejemplo |
|---------|-------------|---------|
| `/chat [mensaje]` | Chatea con el asistente | `/chat ¿Qué servicios ofreces?` |
| `/help` | Muestra todos los comandos disponibles | `/help` |
| `/ping` | Verifica si el asistente está funcionando | `/ping` |

### Comandos de Administración

| Comando | Descripción | Ejemplo |
|---------|-------------|---------|
| `/admin` | Panel de administración | `/admin` |

## 🎯 Servicios Disponibles

### Desarrollo Full Stack
- Desarrollo de aplicaciones web completas
- Frontend con React, JavaScript, Bootstrap
- Backend con Node.js, Python, Flask
- Bases de datos SQL

### Machine Learning & IA
- Desarrollo de modelos con TensorFlow
- Análisis de datos con Pandas y NumPy
- Aplicaciones de inteligencia artificial

### Chatbots y Automatización
- Desarrollo de chatbots conversacionales
- Automatización de procesos
- Soluciones de automatización empresarial

### Consultoría IT
- Análisis de sistemas
- Optimización de procesos
- Consultoría técnica

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
- Gestión de clientes y proyectos
- Monitoreo del estado del bot
- Estadísticas de interacciones

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
Error comunicándose con Levi Assistant
```
**Solución**: Verifica tu conexión a internet y la validez de tu API key

## 📊 Monitoreo y Logs

Levi Assistant genera logs detallados para:
- Interacciones con clientes
- Proyectos creados y gestionados
- Errores de API
- Consultas recibidas

## 🔒 Seguridad

- Todas las comunicaciones están cifradas
- Las API keys se almacenan de forma segura
- No se almacenan mensajes personales
- Cumple con las políticas de WhatsApp

## 🤝 Contacto

**Levi Villarreal**
- 💻 Desarrollador Full Stack & Analista de IT
- 🌐 GitHub: [boogiepop-135](https://github.com/boogiepop-135)
- 📧 LinkedIn: [Levi Villarreal](https://linkedin.com/in/levivillarreal)

---

**Levi Assistant** - *Asistente personal de Levi Villarreal* 💻✨

"Combino la precisión del laboratorio, el análisis de IT y la lógica del software para crear soluciones innovadoras. Desde análisis de datos con Python hasta chatbots, aplicaciones web y machine learning, siempre buscando resolver problemas reales. ¡Colaboremos!"
