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

### 4. Acceder

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Documentación API: http://localhost:8000/docs

## Usuarios de demostración

| Rol | Correo | Contraseña |
|-----|--------|-----------|
| Administrador | admin@hotel.com | admin123 |
| Gerente | gerente@hotel.com | gerente123 |
| Recepcionista | recepcion@hotel.com | recepcion123 |

## Docker Compose (producción local)

```bash
docker compose -f infrastructure/docker-compose.yml up -d
```

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
