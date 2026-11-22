# Open Emulator — Consola Retro PWA para Lenovo Tab 11

Emulador multiconsola web/PWA optimizado para la pantalla de 11 pulgadas de la **Lenovo Tab 11**, con soporte para **controles táctiles en pantalla**, **mandos Bluetooth / USB** (Xbox, PlayStation, 8BitDo, genéricos) y guardado persistente de juegos en la tablet.

## Consolas soportadas (10 sistemas)

| Consola | Extensiones | Clásicos de ejemplo |
| :--- | :--- | :--- |
| **SNES** | `.sfc`, `.smc`, `.fig`, `.swc` | Super Mario World, Super Mario Kart, Donkey Kong Country, Prince of Persia |
| **NES** | `.nes`, `.fds`, `.unif` | Super Mario Bros. 1/3, Donkey Kong, Zelda |
| **Game Boy Advance** | `.gba` | Mario Kart: Super Circuit, Metroid Fusion |
| **Game Boy / Color** | `.gb`, `.gbc` | Super Mario Land, Donkey Kong '94, Tetris |
| **Nintendo 64** | `.z64`, `.n64`, `.v64` | Super Mario 64, Mario Kart 64, Donkey Kong 64 |
| **Nintendo DS** | `.nds` | New Super Mario Bros., Mario Kart DS |
| **Sega Genesis / MD** | `.md`, `.gen`, `.smd` | Sonic, Streets of Rage, Prince of Persia |
| **Sega Master System / GG** | `.sms`, `.gg` | Alex Kidd, Sonic |
| **PlayStation (PS1)** | `.chd`, `.pbp`, `.cue`, `.iso` | Crash Team Racing, Spyro, Tekken 3 |
| **Arcade (FBNeo)** | `.zip` | Donkey Kong Arcade, Pac-Man, Metal Slug |

> **Nota legal:** Open Emulator no incluye ROMs con derechos de autor. Está diseñado para cargar tus propios respaldos de cartuchos o juegos homebrew legales.

## Cómo iniciar y abrir en tu Lenovo Tab 11

1. Haz doble clic en **`iniciar_emulador.bat`** (o ejecuta `python server.py` en la terminal).
2. Verás una dirección de red local como `http://192.168.1.XX:8080`.
3. Abre esa dirección en **Chrome** desde tu **Lenovo Tab 11** (conectada al mismo Wi-Fi).
4. Toca el menú **⋮** de Chrome → **"Instalar app"** / **"Agregar a la pantalla principal"** para jugarlo en pantalla completa horizontal como una app nativa.

## Cómo agregar tus juegos (2 opciones)

1. **Directo desde tu Lenovo 11:** Toca **+ Agregar ROMs** y elige los archivos desde el almacenamiento o microSD de la tablet (se guardan localmente en IndexedDB).
2. **Desde tu PC por Wi-Fi:** Copia tus archivos ROM en la carpeta `roms/` de este proyecto y toca **↻ Sincronizar PC** en la tablet.
