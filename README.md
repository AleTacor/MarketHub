# MarketHub

Encuentra los comercios de tu barrio por código postal o dibujando una zona en el mapa, y consulta sus productos y existencias.

- **Clientes**: buscan tiendas sin necesidad de registrarse.
- **Empresarios**: se registran para crear sus tiendas y gestionar productos y existencias.

## Requisitos

- [Node.js](https://nodejs.org/) 22 o superior
- [pnpm](https://pnpm.io/) (el proyecto fija la versión 9.15.9)
- [Docker](https://docs.docker.com/engine/install/) con Docker Compose

Instala pnpm una sola vez. Al ejecutarlo dentro del proyecto, pnpm usa automáticamente la versión fijada en `package.json`:

```bash
npm install -g pnpm
```

Para usar Docker sin `sudo`, añade tu usuario al grupo `docker` y vuelve a iniciar sesión:

```bash
sudo usermod -aG docker $USER
```

> No ejecutes los comandos del proyecto con `sudo`, porque se crearían archivos del repositorio que pertenecen a root.

## Instalar dependencias

Desde la raíz del repositorio. Instala las dependencias de todos los servicios y paquetes del monorepo:

```bash
pnpm install
```

No uses `npm install`. El monorepo usa los workspaces de pnpm.

Para añadir una dependencia a un servicio concreto:

```bash
pnpm --filter @markethub/shop-service add <paquete>       # dependencia
pnpm --filter @markethub/web add -D <paquete>             # dependencia de desarrollo
pnpm add -D -w <paquete>                                  # herramienta de la raíz
```

Servicios: `@markethub/web`, `@markethub/auth-service`, `@markethub/shop-service` y `@markethub/shared`.

## Modo desarrollo

```bash
pnpm dev
```

Este comando:

1. arranca PostgreSQL + PostGIS en Docker (puerto 5432) y espera a que esté listo;
2. inicia los tres servicios con recarga automática al guardar cambios:
   - **web** (Next.js): http://localhost:3000
   - **auth-service** (registro e inicio de sesión): puerto 4001
   - **shop-service** (tiendas y productos): puerto 4002

Abre **http://localhost:3000**. Next.js redirige `/api` y `/uploads` a los backends, así que no hace falta nginx en este modo. Las migraciones de la base de datos se aplican automáticamente al arrancar cada servicio.

Pulsa `Ctrl+C` para parar los servicios. La base de datos sigue en marcha; para pararla:

```bash
pnpm db:down
```

## Todo en Docker

Para levantar el entorno completo en contenedores (con nginx, como en producción):

```bash
docker compose up --build
```

Abre http://localhost:8080.

```bash
docker compose down        # parar
docker compose down -v     # parar y borrar datos (base de datos, imágenes y claves)
```

Si cambias dependencias, ejecuta `pnpm install` en tu máquina y después `pnpm docker:install` para reinstalarlas en los contenedores.

## Otros comandos

```bash
pnpm typecheck    # comprobación de tipos en todo el monorepo
pnpm test         # tests
pnpm build        # compilación de producción del frontend
```

## Problemas frecuentes

- **`permission denied ... docker.sock`**: tu usuario no está en el grupo `docker` (ver *Requisitos*).
- **El puerto 5432 está ocupado**: tienes otro PostgreSQL en marcha. Páralo o cambia el puerto en `docker-compose.yml`.
- **Archivos con permisos de root** tras usar `sudo`: `sudo chown -R $USER:$USER .`

Más detalles de arquitectura, API y convenciones en [CLAUDE.md](CLAUDE.md).
