# ⚽ Quiniela Mundial 2026 (servidor)

Quiniela del Mundial 2026 para jugar con amigos. **Servidor Node sin dependencias**
(no hace falta `npm install`), pensado para correr en tu PC y exponerlo con un
**túnel de Cloudflare**.

## ✨ Qué hace
- **Cuentas creadas por el administrador.** Los usuarios pueden cambiar su **nombre visible** y su **contraseña**.
- **Pantalla inicial: Clasificación.** Al pinchar un usuario se ven sus pronósticos de grupos solo para partidos ya jugados.
- **Grupos:** un formulario con todos los partidos por jugar; se envía **todo a la vez y una sola vez** (queda bloqueado, no se edita).
- **Eliminatorias (llave):** desde 1/16 hasta la final, formato de **cuadro interactivo**; eliges quién avanza en cada cruce. Se envía **una sola vez**. Se abre cuando terminan los grupos y se conocen los 32 equipos.
- **Resultados** desde football-data.org (en el servidor).
- **Puntos:** grupos = 3 por marcador exacto + 2 por ganador/empate (5 si aciertas exacto). Llave = 3 por cruce acertado + 5 por semifinalista (top 4) + 6 por finalista. Todo configurable en `config.mjs`.
- **Banderas** de cada selección automáticas (de la API o de flagcdn.com).
- **Bota de Oro / Goleador del torneo:** sección de apuesta que se abre con la fase eliminatoria; cada usuario elige 1 de los 20 mejores goleadores de grupos congelados desde football-data.org al abrirse la llave. +10 pts por acertar el goleador del torneo.
- **La Final:** apuesta especial que se abre al conocerse los finalistas: **marcador exacto** y **campeón** del Mundial. Si pronosticas empate, eliges quién levanta la copa; si no, el campeón se deduce del marcador. Puntos: 7 por exacto y +10 por campeón.

### Configurar la Bota de Oro (`config.mjs`, bloque `mvp`)
- En producción, los `candidates` se rellenan automáticamente desde el endpoint de goleadores de football-data.org cuando terminan los grupos.
- `candidates`: lista manual de respaldo si no hay API o para desarrollo local.
- `actual`: pon aquí el `id` del jugador ganador cuando se conozca la Bota de Oro, y reinicia el servidor para repartir los puntos.
- `points`: puntos por acertar la Bota de Oro.

## 🚀 Arrancar (Windows / PowerShell)

Requisito: **Node 18+** (ya lo tienes).

```powershell
# Opción 1: el lanzador
./start.ps1

# Opción 2: a mano
node server.mjs
```

Abre **http://localhost:8026**. La primera vez se crea el admin.

### Admin y seguridad (¡importante!)
Define el usuario/clave del admin **antes del primer arranque** (si no, se crea `admin` / `cambia-esta-clave`):

```powershell
$env:ADMIN_USER="jorge"; $env:ADMIN_PASS="una-clave-fuerte"; node server.mjs
```

Luego entra como admin → pestaña **Admin** → crea las cuentas de tus amigos.

### Reloj real vs demo
Por defecto usa un **reloj simulado** (13 jun 2026) y **datos de ejemplo** para que puedas
probarlo ya. Para producción con la fecha real:

```powershell
$env:REAL_CLOCK="1"; node server.mjs
```

## 🌐 Exponerlo con Cloudflare Tunnel

Con el servidor corriendo en el puerto 8026, en otra terminal:

```powershell
# Prueba rápida (URL temporal *.trycloudflare.com, sin cuenta):
cloudflared tunnel --url http://localhost:8026
```

Para un dominio fijo, usa un túnel con nombre (named tunnel) de tu cuenta Cloudflare.
Las cookies de sesión ya se marcan `Secure` automáticamente cuando entras por HTTPS del túnel.

> Instalar cloudflared: `winget install --id Cloudflare.cloudflared` (o descárgalo de Cloudflare).

## 🔌 Resultados reales (football-data.org)
1. Consigue tu token gratis en https://www.football-data.org/client/register
2. Arranca con el token:
   ```powershell
   $env:FOOTBALL_DATA_TOKEN="TU_TOKEN"; node server.mjs
   ```
3. Entra como admin → **Admin → Actualizar resultados**. (También puedes programarlo con el Programador de tareas de Windows reiniciando con el token.)

## 📁 Estructura
```
quiniela-mundial-2026/
├─ server.mjs            Servidor HTTP + rutas
├─ config.mjs            Puntos, fases, árbol de la llave, admin, API  (EDITA AQUÍ)
├─ lib/
│  ├─ store.mjs          Persistencia en data/*.json (atómica)
│  ├─ auth.mjs           Contraseñas (scrypt) + sesiones por cookie
│  ├─ data.mjs           Partidos, clasificación, ventanas de fase, API
│  ├─ bracket.mjs        Árbol de la llave + validación
│  └─ scoring.mjs        Puntuación y ranking
├─ public/               Frontend (index.html, css, js)
├─ sample/sample-data.mjs  Datos de ejemplo (sin token)
└─ data/                 Base de datos (se crea sola): db.json, results.json
```

## 🔒 Notas
- Toda la información vive en `data/` (cópialo para hacer copias de seguridad).
- Las predicciones son **definitivas** al enviarse (no se pueden editar), por diseño.
- La llave se rellena con los **equipos reales** al terminar los grupos; antes se ve el cuadro con las etiquetas (1E, 2A, 3.º…).
