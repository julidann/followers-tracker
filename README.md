# Followers Tracker

Aplicación personal para analizar la evolución de una cuenta de Instagram y construir métricas históricas de seguidores e interacción.

## Objetivo

- Followers y following.
- No me siguen.
- Yo no sigo.
- Mutuos.
- Nuevos seguidores.
- Unfollowers recientes e historial.
- Admiradores / top supporters.
- Ghost followers.
- Active followers.
- Lost interest.
- Analytics de posts y stories cuando los datos disponibles lo permitan.
- Evolución y comparaciones por período.
- Favoritos / whitelist.
- Exportaciones.

## Arquitectura inicial

- Frontend: Angular
- Backend: FastAPI (Python)
- Base de datos: PostgreSQL
- Contenedores: Docker Compose

## Importante sobre Instagram

La app no guardará contraseñas de Instagram en texto plano. La integración se implementará de forma modular para poder usar mecanismos autorizados o importación de datos/snapshots sin acoplar toda la aplicación a un método frágil.

## Estado

Primera etapa: estructura base del proyecto, API, base de datos y frontend.

## Desarrollo local

1. Copiar .env.example a .env.
2. Completar las variables locales.
3. Ejecutar: docker compose up --build

Backend: http://localhost:8000
Frontend: http://localhost:4200
