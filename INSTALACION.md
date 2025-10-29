# Guía de Instalación - Sistema IT San Cosme Orgánico

## ⚠️ IMPORTANTE: Crear Usuario Administrador Primero

Antes de acceder al panel, debes crear un usuario administrador.

### Paso 1: Navegar al directorio del proyecto

```powershell
cd C:\Users\Boogie\Desktop\whatsbot-it\whatsbot-main\WhatsBot-main
```

### Paso 2: Ejecutar el script de creación de admin

```powershell
npm run create-admin
```

Esto te pedirá:
- **Username**: Elige un nombre de usuario (ejemplo: `admin`)
- **Password**: Elige una contraseña segura (ejemplo: `admin123`)

### Paso 3: Guardar tus credenciales

```
Username: admin
Password: (la que hayas elegido)
```

## 🔐 Acceso al Panel

Una vez creado el usuario:

1. Ve a: `http://localhost:3000/admin/it`
2. Inicia sesión con las credenciales que creaste
3. Tu sesión durará 1 día

## 🚀 Iniciar el Servidor

Después de crear el admin, inicia el servidor:

```powershell
npm run dev
```

O si prefieres:

```powershell
npm start
```

## 📝 Notas

- Si olvidas tu contraseña, puedes ejecutar `npm run create-admin` de nuevo con otro nombre de usuario
- El token JWT expira después de 1 día
- Las credenciales son específicas de tu base de datos MongoDB

