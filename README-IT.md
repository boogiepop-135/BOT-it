# Sistema de Gestión IT - San Cosme Orgánico

Sistema completo de gestión de tickets de incidencias, proyectos y panel de administración para el Analista de Tecnologías de la Información.

## Características Principales

### 🤖 Gestión de Tickets de Soporte
- **Crear tickets** directamente desde WhatsApp
- **Seguimiento de incidencias** en tiempo real
- **Categorización automática** por tipo de problema:
  - Hardware
  - Software
  - Red
  - Seguridad
  - Microsoft 365
  - POS (Punto de Venta)
  - Backup
  - Otro
- **Sistema de prioridades** (Baja, Media, Alta, Urgente)
- **Estados de tickets**: Abierto, Asignado, En Progreso, Resuelto, Cerrado
- **Comentarios** para seguimiento del ticket
- **Solución documentada** para cada ticket resuelto

### 📊 Panel de Administración Web

Accede al panel de administración en: `http://localhost:3000/admin/it`

**Características:**
- Dashboard con estadísticas en tiempo real
- Vista completa de todos los tickets
- Gestión de proyectos IT
- Reportes y métricas
- Filtros avanzados por estado, prioridad y categoría

### 🎯 Comandos de WhatsApp

#### Crear Ticket
```
!ticket create <categoría> <título> [descripción]

Ejemplos:
!ticket create pos El POS no imprime tickets en la sucursal 2
!ticket create m365 No puedo acceder a mi correo electrónico
!ticket create hardware La impresora está sin papel
!ticket create network No hay conexión a internet en la sucursal 1
```

#### Ver Lista de Tickets
```
!ticket list
```
Muestra tus últimos 10 tickets

#### Ver Detalles de un Ticket
```
!ticket view <número_ticket>

Ejemplo:
!ticket view TKT-000001
```

#### Agregar Comentario a un Ticket
```
!ticket comment <número_ticket> <mensaje>

Ejemplo:
!ticket comment TKT-000001 El técnico ya revisó, problema resuelto
```

#### Consultar Estado de un Ticket
```
!ticket status <número_ticket>

Ejemplo:
!ticket status TKT-000001
```

## Categorías de Tickets

| Categoría | Descripción |
|-----------|-------------|
| `hardware` | Problemas con equipos físicos (computadoras, impresoras, etc.) |
| `software` | Problemas con aplicaciones y programas |
| `network` | Problemas de conectividad y redes |
| `security` | Problemas de seguridad y accesos |
| `m365` | Microsoft 365, correo, Teams, OneDrive |
| `pos` | Sistema punto de venta Oracle POS |
| `backup` | Copias de seguridad |
| `other` | Otros tipos de problemas |

## Prioridades

El sistema asigna prioridades automáticamente según palabras clave en la descripción:

- **Urgente**: "urgente", "caído", "crítico", "emergencia", "no funciona"
- **Alta**: "importante", "rápido", "necesita", "problema"
- **Media**: (por defecto)
- **Baja**: "consultar", "duda", "pregunta", "mejorar"

## API REST

### Obtener Tickets
```bash
GET /api/it/tickets
GET /api/it/tickets?status=open&priority=urgent
GET /api/it/tickets/:id
```

### Crear Ticket
```bash
POST /api/it/tickets
Content-Type: application/json

{
  "title": "Título del ticket",
  "description": "Descripción detallada",
  "category": "pos",
  "priority": "urgent",
  "createdBy": "521234567890"
}
```

### Actualizar Ticket
```bash
PUT /api/it/tickets/:id
Content-Type: application/json

{
  "status": "resolved",
  "solution": "Se reinició el sistema POS y quedó funcionando"
}
```

### Dashboard Stats
```bash
GET /api/it/dashboard/stats
```

Retorna estadísticas completas incluyendo:
- Total de tickets
- Tickets abiertos/urgentes
- Proyectos activos
- Tiempo promedio de resolución
- Tickets por categoría
- Tickets por estado

## Proyectos IT

El sistema también gestiona proyectos:

### Crear Proyecto
```bash
POST /api/it/projects
Content-Type: application/json

{
  "name": "Implementación de Backup Automático",
  "description": "Configurar backup automático para M365",
  "status": "planning",
  "priority": "high",
  "assignedTo": "USER_ID",
  "createdBy": "USER_ID",
  "stakeholders": [],
  "deliverables": ["Backup configurado", "Pruebas realizadas"],
  "budget": 5000,
  "tags": ["backup", "m365"]
}
```

### Ver Proyectos
```bash
GET /api/it/projects
GET /api/it/projects/:id
```

### Gestión de Tareas en Proyectos
```bash
POST /api/it/projects/:id/tasks
PUT /api/it/projects/:id/tasks/:taskId
```

## Checklist Semanal - Objetivos del Área

El sistema está diseñado para apoyar todas las actividades del checklist semanal:

- ✅ Revisión de correos/tickets de urgencia
- ✅ Soporte/Incidencias de alta prioridad
- ✅ Control de Licencias (órdenes de servicio como tickets)
- ✅ Trabajo en Proyectos (análisis, diseño, desarrollo)
- ✅ Backups/Revisión de Seguridad (registro de incidencias)
- ✅ Mantenimiento preventivo y correctivo (tickets)
- ✅ Documentación (solución registrada en cada ticket)

## Objetivos Prioritarios

### Gestión POS
- Tickets de incidencias de POS
- Documentación de configuraciones
- Seguimiento de resoluciones

### Microsoft 365
- Gestión de cuentas (tickets)
- Soporte de aplicaciones
- Seguridad y cumplimiento
- Almacenamiento y colaboración

### Infraestructura y Redes
- Tickets de infraestructura
- Gestión de hardware
- Seguimiento de software y licencias
- Telecomunicaciones

### Seguridad y Respaldo
- Registro de backups
- Protección antivirus
- Recuperación ante desastres

## KPIs del Sistema

El dashboard muestra automáticamente:

1. **Optimización Digital**: % de automatización de procesos
2. **Tiempo de Resolución**: Tiempo promedio de resolución de tickets
3. **Cumplimiento de Proyectos**: Estado y progreso de proyectos
4. **Satisfacción del Usuario**: (a implementar en futura versión)

## Instalación

1. Asegúrate de tener las variables de entorno configuradas en `.env`:
```env
MONGODB_URI=tu_mongodb_uri
JWT_SECRET=tu_secret_jwt
GEMINI_API_KEY=tu_gemini_key
PORT=3000
```

2. Instala las dependencias:
```bash
npm install
```

3. Inicia el servidor:
```bash
npm run dev
```

4. Accede al panel de administración:
```
http://localhost:3000/admin/it
```

5. Escanea el código QR con WhatsApp para conectar el bot.

## Uso

### Desde WhatsApp

1. Envía un mensaje con el comando de ticket:
```
!ticket create pos El POS no imprime
```

2. El bot te responderá con el número de ticket asignado

3. Consulta el estado en cualquier momento:
```
!ticket view TKT-000001
```

### Desde el Panel Web

1. Inicia sesión en `/admin/it`

2. Ve al dashboard para ver estadísticas generales

3. Navega a "Tickets" para ver y gestionar tickets

4. Usa los filtros para encontrar tickets específicos

5. Crea nuevos tickets directamente desde el panel

## Estructura de Base de Datos

### Modelo Ticket
- `ticketNumber`: String único
- `title`: String
- `description`: String
- `priority`: enum (low, medium, high, urgent)
- `status`: enum (open, assigned, in_progress, resolved, closed)
- `category`: enum (hardware, software, network, security, m365, pos, backup, other)
- `createdBy`: String (teléfono)
- `assignedTo`: ObjectId (usuario)
- `comments`: Array de comentarios
- `solution`: String
- `resolutionTime`: Number (minutos)
- `createdAt`: Date
- `resolvedAt`: Date
- `closedAt`: Date

### Modelo Project
- `projectNumber`: String único
- `name`: String
- `description`: String
- `status`: enum (planning, in_progress, on_hold, completed, cancelled)
- `priority`: enum (low, medium, high, critical)
- `progress`: Number (0-100)
- `tasks`: Array de tareas
- `budget`: Number
- `deliverables`: Array
- `stakeholders`: Array de teléfonos

## Notas Adicionales

- El sistema genera números de ticket únicos automáticamente
- Los comentarios se agregan de forma cronológica
- El tiempo de resolución se calcula automáticamente
- Las métricas se actualizan en tiempo real
- Los filtros del panel permiten búsquedas avanzadas

## Soporte

Para problemas con el sistema, contacta al equipo de desarrollo o crea un ticket usando el mismo sistema.

---

Desarrollado para San Cosme Orgánico | Analista de IT

