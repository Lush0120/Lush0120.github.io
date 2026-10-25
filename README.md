# CV virtual · Cristian Alexander Muñoz Caro

Sitio personal bilingüe (español / inglés) que amplía mi CV de una página:
perfil, experiencia, proyectos como casos de estudio y certificados.

**Sitio publicado:** https://lush0120.github.io

## Stack

- **HTML, CSS y JavaScript puros**, sin frameworks ni paso de compilación: lo
  que está en el repositorio es exactamente lo que publica GitHub Pages.
- **GitHub Pages** (rama `main`, carpeta raíz).
- **Python** solo para preparar los certificados antes de publicarlos
  (`scripts/`, con PyMuPDF y Pillow). No forma parte del sitio.

Funcionalidades:

- Botón `ES | EN`; los textos viven en `i18n/es.json` e `i18n/en.json`.
- Modo oscuro automático según el sistema, con botón para alternarlo.
- Idioma y tema se recuerdan en el navegador (`localStorage`).
- Galería de certificados con destacados y filtros, generada desde
  `data/certificados.json`.
- Formulario de contacto (Formspree, con respaldo `mailto:`).
- Diseño responsive desde 360 px, navegable con teclado.

## Estructura

```
├── index.html               # estructura de la página
├── css/styles.css           # estilos y paleta (claro / oscuro)
├── js/main.js               # idioma, tema, galería y formulario
├── i18n/es.json, en.json    # textos de cada idioma
├── data/certificados.json   # listado de certificados
├── assets/
│   ├── img/foto.jpg
│   ├── cv/CV_Cristian_Munoz_Caro.pdf
│   └── certificados/
│       ├── pdf/             # certificados con datos personales tapados
│       └── thumbs/          # miniaturas .webp de la galería
└── scripts/                 # preparación de certificados (no es parte del sitio)
    ├── redactar_certificados.py
    └── generar_miniaturas.py
```

## Correrlo localmente

El sitio lee archivos JSON con `fetch()`, y el navegador lo bloquea si se abre
`index.html` con doble clic (`file://`). Hace falta un servidor local; el de
Python sirve:

```
python -m http.server 8765 --bind 127.0.0.1
```

Luego abrir http://127.0.0.1:8765 en el navegador. `Ctrl+C` detiene el servidor.

## Cómo agregar un certificado

1. Copiar el PDF original a `_originales/` con el nombre
   `AAAA-MM_institucion_nombre-corto.pdf`. Esa carpeta está en `.gitignore`:
   los originales **nunca** se suben.
2. Preparar el entorno (solo la primera vez):
   ```
   python -m venv venv
   venv\Scripts\activate
   pip install pymupdf pillow
   ```
3. Tapar los datos y generar la miniatura:
   ```
   python scripts/redactar_certificados.py
   python scripts/generar_miniaturas.py
   ```
4. **Revisar visualmente** el PDF resultante en `assets/certificados/pdf/` y su
   miniatura antes de hacer commit.
5. Agregar la entrada en `data/certificados.json` (nombre en ES/EN, institución,
   horas, fecha `AAAA-MM`, categoría y `"destacado": true/false`).

### Por qué los certificados se tapan y se rasterizan

Varios certificados incluyen el número de documento, códigos de verificación y
códigos QR. `redactar_certificados.py` los tapa y además convierte cada página
en imagen. Un rectángulo dibujado encima no basta: el texto de debajo seguiría
pudiéndose seleccionar y copiar. El script comprueba al final que ningún PDF
publicado conserve texto extraíble.

Los certificados están disponibles para verificación a solicitud.

## Contacto

- Correo: yoesel52@gmail.com
- LinkedIn: https://www.linkedin.com/in/cristian-alexander-mu%C3%B1oz-caro-88648b306
- GitHub: https://github.com/Lush0120
