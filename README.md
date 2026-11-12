# Hotel Paredes PMS

Property Management System para hoteles pequeños y medianos.

## Stack

| Parte | Tecnología |
|-------|-----------|
| Frontend | Next.js 14 + React + TypeScript |
| Diseño | Tailwind CSS + shadcn/ui |
| Backend | Python + FastAPI |
| ORM | SQLAlchemy 2 |
| Migraciones | Alembic |
| Base de datos | PostgreSQL |
| Contenedores | Docker Compose |

## Requisitos

- Python 3.11+
- Node.js 20+
- PostgreSQL 16
- Docker (opcional)

## Inicio rápido (desarrollo)

En desarrollo usa servidores con recarga automática. Así los cambios de frontend y backend se aplican sin apagar ni volver a levantar manualmente.

### 1. Base de datos

```bash
createdb hotel_paredes
```

### 2. Backend

```bash
cd backend
pip install .
uvicorn app.main:app --reload --port 8000
```

El flag `--reload` reinicia automáticamente FastAPI cuando cambias archivos `.py`.

Poblar datos de demostración:

```bash
python -m app.seed
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

`npm run dev` usa el servidor de desarrollo de Next.js con hot reload. No uses `npm run build` + `npm start` mientras estás programando.

### 4. Acceder

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Documentación API: http://localhost:8000/docs

## Usuarios de demostración

| Rol | Correo | Contraseña |
|-----|--------|-----------|
| Administrador | admin@hotel.com | AdminHotel2026! |
| Gerente | gerente@hotel.com | GerenteHotel2026! |
| Recepcionista | recepcion@hotel.com | RecepcionHotel2026! |

## Docker Compose (producción local)

```bash
docker compose -f infrastructure/docker-compose.yml up -d
```

## Docker Compose (desarrollo con hot reload)

Si trabajas con Docker y quieres ver cambios sin reconstruir ni reiniciar manualmente:

```bash
docker compose -f infrastructure/docker-compose.dev.yml up
```

Este compose monta el código como volumen y ejecuta:

- Backend: `uvicorn app.main:app --reload`
- Frontend: `npm run dev`

Casos donde sí conviene reiniciar:

- Cambias variables de entorno.
- Instalas dependencias nuevas.
- Cambias configuración de Docker.
- Hay migraciones o cambios grandes de base de datos.

## Respaldos

El respaldo incluye la base de datos PostgreSQL y la carpeta `backend/uploads`.
Requiere que `pg_dump` y `pg_restore` estén disponibles en el `PATH`.

Crear un respaldo manual en Windows:

```powershell
.\scripts\backup.ps1
```

Los archivos se guardan en `backups/` y se conservan 30 días. Para cambiar la
retención:

```powershell
.\scripts\backup.ps1 -RetentionDays 90
```

Para automatizarlo, crea una tarea diaria en el Programador de tareas de
Windows que ejecute `powershell.exe` con:

```text
-NoProfile -ExecutionPolicy Bypass -File "C:\xampp\htdocs\PMS HOTEL PAREDES\scripts\backup.ps1"
```

Restaurar requiere confirmación explícita porque reemplaza los datos actuales:

```powershell
.\scripts\restore.ps1 -BackupFile ".\backups\hotel_paredes_2026-11-08_020000.zip" -ConfirmRestore
```

Conserva una copia semanal fuera del equipo. No guardes archivos `.env` ni
credenciales junto con los respaldos.

## Estructura del proyecto

```
hotel-paredes-pms/
├── backend/
│   ├── app/
│   │   ├── core/          # Configuración, BD, seguridad
│   │   ├── common/        # Utilidades (auditoría)
│   │   ├── modules/       # Módulos del negocio
│   │   │   ├── auth/      # Autenticación
│   │   │   ├── users/     # Usuarios y roles
│   │   │   ├── rooms/     # Habitaciones y tipos
│   │   │   ├── guests/    # Huéspedes
│   │   │   ├── reservations/ # Reservas
│   │   │   ├── stays/     # Check-in/out
│   │   │   ├── housekeeping/ # Limpieza
│   │   │   ├── billing/   # Facturación
│   │   │   ├── cash/      # Caja
│   │   │   ├── reports/   # Reportes
│   │   │   └── audit/     # Auditoría
│   │   ├── seed.py        # Datos de demostración
│   │   └── main.py        # Punto de entrada
│   ├── migrations/        # Alembic
│   └── tests/             # Pruebas
├── frontend/
│   ├── app/               # Páginas Next.js
│   │   ├── (auth)/        # Login
│   │   └── (dashboard)/   # Dashboard y módulos
│   ├── components/ui/     # Componentes reutilizables
│   ├── hooks/             # Hooks (useAuth)
│   ├── lib/               # Utilidades y API client
│   └── types/             # TypeScript types
├── infrastructure/
│   └── docker-compose.yml
└── .env.example
```

## API endpoints

### Autenticación
- `POST /auth/login` - Iniciar sesión
- `POST /auth/verify` - Verificar token

### Usuarios
- `GET /users` - Listar usuarios
- `POST /users` - Crear usuario
- `PUT /users/{id}` - Actualizar usuario

### Habitaciones
- `GET /room-types` - Tipos de habitación
- `POST /room-types` - Crear tipo
- `PUT /room-types/{id}` - Actualizar tipo
- `GET /rooms` - Listar habitaciones
- `POST /rooms` - Crear habitación
- `PATCH /rooms/{id}/status` - Actualizar estado

### Huéspedes
- `GET /guests` - Listar (búsqueda)
- `POST /guests` - Crear
- `GET /guests/{id}/history` - Historial

### Reservas
- `GET /availability` - Disponibilidad
- `GET /reservations` - Listar
- `POST /reservations` - Crear
- `PUT /reservations/{id}` - Actualizar
- `POST /reservations/{id}/cancel` - Cancelar

### Recepción
- `POST /reservations/{id}/check-in` - Check-in
- `POST /reservations/{id}/check-out` - Check-out

### Housekeeping
- `GET /housekeeping/tasks` - Tareas
- `POST /housekeeping/tasks` - Crear tarea
- `PATCH /housekeeping/tasks/{id}` - Actualizar

### Facturación
- `POST /reservations/{id}/charges` - Agregar cargo
- `POST /reservations/{id}/payments` - Registrar pago
- `GET /reservations/{id}/folio` - Ver folio

### Caja
- `POST /cash-sessions/open` - Abrir caja
- `POST /cash-sessions/{id}/close` - Cerrar caja

### Reportes
- `GET /reports/occupancy` - Ocupación
- `GET /reports/revenue` - Ingresos
- `GET /reports/arrivals` - Llegadas del día
- `GET /reports/departures` - Salidas del día

### Auditoría
- `GET /audit-logs` - Registros de auditoría
