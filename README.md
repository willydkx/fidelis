<p align="center">
  <img src="assets/images/icon.png" width="120" alt="Icono de Fidelis">
</p>

<h1 align="center">Fidelis</h1>

<p align="center">App para cumplir tus objetivos diarios, semanales y mensuales, y no romper la racha. Para Android, navegador y Windows.</p>

<p align="center">
  <a href="../../releases/latest"><b>⬇️ Descargar (Android y Windows)</b></a>
  &nbsp;·&nbsp;
  <a href="https://willydkx.github.io/fidelis/"><b>🌐 Abrir la versión web</b></a>
</p>

---

## Qué hace

- **Registro diario**: marca los objetivos de sí/no con un toque o apunta cantidades en los numéricos (minutos, páginas, km…). También puedes registrar días anteriores.
- **Diario**: en Hoy, cuenta cómo te ha ido el día y elige una carita de ánimo. En *Ver diario* tienes todos los días, con buscador, y en el Dashboard la evolución de tu ánimo comparada con los días en que cumpliste todo.
- **Cadencias flexibles**: objetivos diarios, semanales, mensuales o solo ciertos días de la semana. En los semanales y mensuales puedes pedir «N veces».
- **Estadísticas**: eficiencia de los últimos 30 días, cumplimiento diario, mapa de constancia anual, rachas actuales y récord, y cumplimiento por objetivo.
- **Recordatorios**: hasta 5 horas al día, los días que elijas, siempre o solo si te faltan objetivos, y con tu propio mensaje.
- **Temporizador pomodoro** (pestaña Enfoque): enfoque y descansos a tu medida, alarma al terminar cada fase y, si quieres, suma los minutos a un objetivo.
- **Organización**: pausa, archiva, reordena o elimina objetivos, y elige su color.
- **Para empezar rápido**: la primera vez te pregunta qué quieres mejorar y te sugiere unos pocos objetivos.
- **En el móvil y en el ordenador**: app de Android, app de Windows y versión web. El móvil y el ordenador se pueden **sincronizar solos** a través de tu Google Drive.
- **Tus datos son tuyos**: se guardan en tus dispositivos (y en tu Drive si sincronizas). Sin cuentas, sin publicidad y sin analíticas.

## Instalación

1. Descarga el archivo `.apk` de la [última versión](../../releases/latest) desde el móvil.
2. Ábrelo. Si Android lo pide, permite **instalar apps de origen desconocido** para tu navegador.
3. Google Play Protect avisará de que **no conoce a este desarrollador**. Es normal en apps que no vienen de Google Play: pulsa **Más detalles → Instalar de todos modos**.

Las versiones nuevas se instalan encima de la anterior sin perder datos.

Requiere Android 7.0 o superior.

## Versión web (iPhone, PC y cualquier navegador)

Abre **https://willydkx.github.io/fidelis/** e instálala como una app:

- **iPhone o iPad (Safari):** botón *Compartir* → **Añadir a pantalla de inicio**.
- **Android (Chrome):** menú ⋮ → **Instalar aplicación** (o *Añadir a pantalla de inicio*).
- **PC (Chrome o Edge):** icono de instalar en la barra de direcciones.

Una vez abierta, funciona también sin conexión. Diferencias con el APK:

- No hay **recordatorios**: el navegador no permite programar notificaciones.
- La alarma del **pomodoro** solo suena si Fidelis sigue abierta.
- Los datos se guardan **en ese navegador** y no se comparten con el APK ni con otros dispositivos. Si borras los datos del sitio, se pierden. En iPhone, instálala en la pantalla de inicio: Safari puede borrar los datos de webs que no se visitan en unas semanas, pero no los de las apps instaladas.

## Versión de escritorio (Windows)

La misma app en una ventana para el PC, con menú lateral, Dashboard en columnas y atajos de teclado (← y → cambian de día, H vuelve a hoy, Espacio inicia o pausa el pomodoro y N crea un objetivo).

- **Se abre al encender el ordenador** (se puede desactivar en *Ajustes → Escritorio*).
- **Al cerrar la ventana se queda junto al reloj** para avisarte de los recordatorios y del fin del pomodoro. La parte pesada (el motor web) se cierra del todo, así que en la bandeja apenas gasta memoria y nada de CPU. Para salir del todo: clic derecho en el icono → *Salir*.
- Tus datos se guardan en `%LOCALAPPDATA%\Fidelis\fidelis.db`, un archivo SQLite normal (con una copia `.bak` del guardado anterior).

### Instalación en Windows

1. Descarga `fidelis-X.Y.Z-windows.zip` de la [última versión](../../releases/latest).
2. Descomprímelo en una carpeta fija (por ejemplo `Documentos\Fidelis`) y abre `Fidelis.exe`.
3. Windows avisará de que es de un **editor desconocido**, porque la app no está firmada: pulsa **Más información → Ejecutar de todas formas**.

Para actualizar, cierra Fidelis (clic derecho en el icono junto al reloj → *Salir*) y sustituye los archivos de la carpeta. Tus datos no se tocan.

Requiere Windows 10 u 11 con el [runtime de escritorio de .NET 8](https://dotnet.microsoft.com/download/dotnet/8.0) y WebView2 (ya incluido en Windows 11).

## Sincronización (Android y Windows)

En *Ajustes → Sincronización → Conectar con Google* puedes mantener iguales tus objetivos, registros y diario en el móvil y en el ordenador. Después es automática: al abrir la app, unos segundos después de cada cambio y cada pocos minutos mientras está abierta.

- Los datos se guardan en **tu propio Google Drive**, en una carpeta oculta que solo Fidelis puede ver. Fidelis no ve tus archivos, tu correo ni tu contraseña, y no hay ningún servidor de por medio.
- Si un mismo dato cambia en dos sitios, gana el cambio más reciente. Los borrados también se sincronizan.
- Los recordatorios y el pomodoro son propios de cada dispositivo.
- La copia de Drive no lleva un cifrado propio de Fidelis: la protege tu cuenta de Google, como al resto de tu Drive. Tenlo en cuenta con lo que escribas en el diario.
- Puedes quitarle el acceso cuando quieras en *Ajustes → Sincronización → Desconectar* o desde [tu cuenta de Google](https://myaccount.google.com/permissions).
- La versión web del navegador no sincroniza.

## Privacidad

- Todos tus datos se guardan **solo en tu dispositivo** (base de datos SQLite local; en la versión web, dentro del navegador).
- No hay cuentas, ni publicidad, ni analíticas, ni se envía nada a ningún servidor. Si activas la sincronización, tus datos van solo a tu Google Drive.
- [Política de privacidad completa](https://willydkx.github.io/fidelis/privacy.html).
- Solo pide permiso de **notificaciones** (recordatorios y fin del pomodoro) y de **alarmas exactas**, para que el aviso del pomodoro llegue justo a su hora. En Android 14 o superior este último se activa en *Ajustes de la app → Alarmas y recordatorios*.

Si desinstalas la app, se borran sus datos.

## Compilar desde el código

Hecha con [Expo](https://expo.dev) (SDK 57), React Native y TypeScript.

```bash
npm install
npm test             # tests de la lógica (fechas, repositorios, estadísticas, recordatorios)
npm run typecheck
npx expo lint
```

Para generar el APK con [EAS Build](https://docs.expo.dev/build/introduction/) (necesitas una cuenta gratuita de Expo y cambiar `owner` y `extra.eas.projectId` en `app.json` por los tuyos):

```bash
npx eas-cli@latest build --profile preview --platform android
```

Para desarrollar con recarga en caliente, instala un development build (`--profile development`) y ejecuta `npx expo start`.

Para la versión de escritorio (necesita además el [SDK de .NET 8](https://dotnet.microsoft.com/download/dotnet/8.0)):

```bash
npm run build:desktop      # genera desktop/dist/Fidelis
npm run install:desktop    # la instala para tu usuario, con acceso en el menú Inicio y arranque con Windows
```

Para desinstalarla: `powershell -File desktop/uninstall.ps1` (tus datos no se borran).

### Sincronización en tu propia compilación

La sincronización usa clientes OAuth de Google. El ID web de `src/config.ts` es público y solo funciona con el APK firmado por el autor; para compilar tu propia versión con sincronización, crea un proyecto en Google Cloud con la API de Drive y el permiso `drive.appdata`, y:

- Pon el ID de tu cliente web en `GOOGLE_WEB_CLIENT_ID` (`src/config.ts`) y registra un cliente Android con tu paquete y la huella SHA-1 de tu firma.
- Para Windows, crea un cliente «App de escritorio» y guarda `desktop/google-oauth.json` con `{ "client_id": "...", "client_secret": "..." }`. Ese archivo no se sube al repositorio.

Para la versión web:

```bash
npm run build:web    # genera la PWA en dist/
```

Se publica en GitHub Pages subiendo el contenido de `dist/` a la rama `gh-pages`. Si usas otro repositorio, cambia `experiments.baseUrl` en `app.json` por `/<nombre-del-repo>`.

## Créditos

Desarrollada por [willydkx](https://github.com/willydkx), apoyándome en [Claude](https://claude.ai) (Anthropic) como asistente de programación.

## Licencia

[MIT](LICENSE)
