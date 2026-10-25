"""Tapa los datos sensibles de los certificados y los rasteriza (regla 2 del SPEC).

Uso (desde la raíz del proyecto, con el entorno virtual activo):
    python scripts/redactar_certificados.py [origen] [destino]

Por defecto lee `_originales/` (ignorada por Git) y escribe en
`assets/certificados/pdf/`.

Qué se tapa:
  1. Cualquier palabra con 7 o más dígitos seguidos: número de cédula,
     número de registro del SENA y el código de verificación del SENA (que
     incluye la cédula). Así el script no necesita conocer la cédula y no
     queda escrita en ningún archivo del repositorio.
  2. El párrafo del SENA "La autenticidad de este documento..." completo,
     porque lleva el enlace y el código de verificación (regla 4).
  3. El valor que sigue a "ID del certificado:" (IzyAcademy).
  4. Los números de folio y registro de la Universidad Católica de Oriente.
  5. Zonas fijas por archivo (ZONAS_MANUALES): códigos QR y certificados que
     son solo imagen, donde no hay texto que buscar.

Por qué se rasteriza después: un rectángulo dibujado encima no borra el
texto seleccionable que queda debajo. `apply_redactions()` ya elimina ese
texto, pero además convertimos cada página en una imagen y armamos un PDF
nuevo: así no sobrevive ninguna capa de texto, metadato ni objeto oculto.
"""

import re
import sys
from pathlib import Path

import pymupdf

DPI = 150
CALIDAD_JPEG = 82

# Por defecto la caja de cada palabra usa la altura completa de la fuente
# (ascendente + descendente) y puede invadir la línea de arriba o de abajo.
# `apply_redactions()` borra todo carácter que toque una zona, así que una
# caja alta borraba letras vecinas (p. ej. parte del nombre). Con esta opción
# las cajas se ajustan al tamaño real del texto.
pymupdf.TOOLS.set_small_glyph_heights(True)

# Rectángulos relativos al tamaño de la página: (x0, y0, x1, y1) entre 0 y 1.
ZONAS_MANUALES = {
    # QR de verificación dentro de la imagen de fondo.
    "2025-12_aportes-en-linea_power-bi.pdf": [(0.83, 0.725, 0.96, 0.887)],
    # QR de verificación.
    "2026-05_uco_metodologias-agiles.pdf": [(0.020, 0.700, 0.135, 0.850)],
    # PDF solo imagen: número, URL y referencia del certificado (arriba a la derecha).
    "2025-08_udemy_interfaces-tkinter.pdf": [(0.58, 0.035, 0.98, 0.15)],
}

DIGITOS_LARGOS = re.compile(r"\d{7,}")
NUMERO_REGISTRO = re.compile(r"\d{3,}")
ANIO = re.compile(r"^(19|20)\d\d$")


def misma_linea(a: pymupdf.Rect, b: pymupdf.Rect) -> bool:
    """True si el centro vertical de `b` cae dentro de la altura de `a`."""
    centro = (b.y0 + b.y1) / 2
    return a.y0 <= centro <= a.y1


def zonas_a_tapar(pagina: pymupdf.Page, nombre: str) -> list[pymupdf.Rect]:
    palabras = pagina.get_text("words")  # (x0, y0, x1, y1, texto, bloque, línea, n)
    zonas: list[pymupdf.Rect] = []

    # 1. Secuencias largas de dígitos.
    for *caja, texto, _b, _l, _n in palabras:
        if DIGITOS_LARGOS.search(texto):
            zonas.append(pymupdf.Rect(caja))

    # 2. Párrafo de autenticidad del SENA (bloque completo).
    for x0, y0, x1, y1, texto, *_ in pagina.get_text("blocks"):
        if "autenticidad" in texto.lower():
            zonas.append(pymupdf.Rect(x0, y0, x1, y1))

    for *caja, texto, _b, _l, _n in palabras:
        etiqueta = pymupdf.Rect(caja)

        # 3. "ID del certificado:" -> tapar lo que sigue en la misma línea,
        #    incluido el caso pegado "certificado:Ab12Cd34Ef" (ejemplo ficticio).
        if texto.lower().startswith("certificado:"):
            pegado = texto.split(":", 1)[1]
            if pegado:
                zonas.extend(pagina.search_for(pegado, clip=etiqueta))
            for *otra, t2, _b2, _l2, _n2 in palabras:
                r = pymupdf.Rect(otra)
                if r.x0 >= etiqueta.x1 - 1 and misma_linea(etiqueta, r):
                    zonas.append(r)

        # 4. Folio y registro (UCO): números de 3+ cifras que no son un año.
        if texto.startswith("Folio"):
            for *otra, t2, _b2, _l2, _n2 in palabras:
                r = pymupdf.Rect(otra)
                limpio = t2.strip(".,;:–-")
                if (misma_linea(etiqueta, r) and NUMERO_REGISTRO.search(t2)
                        and not ANIO.match(limpio)):
                    zonas.append(r)

    # 5. Zonas fijas por archivo.
    ancho, alto = pagina.rect.width, pagina.rect.height
    for x0, y0, x1, y1 in ZONAS_MANUALES.get(nombre, []):
        zonas.append(pymupdf.Rect(x0 * ancho, y0 * alto, x1 * ancho, y1 * alto))

    # Un pequeño margen para que no asomen bordes de los caracteres.
    return [z + (-1, -1, 1, 1) for z in zonas]


def redactar(origen: Path, destino: Path) -> int:
    doc = pymupdf.open(origen)
    nuevo = pymupdf.open()
    total = 0
    for pagina in doc:
        zonas = zonas_a_tapar(pagina, origen.name)
        total += len(zonas)
        # `apply_redactions()` borra todo carácter cuya caja toque la zona.
        # En algunos PDF las cajas de las líneas vecinas se solapan unos
        # puntos (p. ej. la tilde de la Ñ en la línea del nombre), así que
        # para BORRAR usamos el núcleo de la zona (recortada arriba y abajo)
        # y después PINTAMOS la zona completa en negro.
        for z in zonas:
            recorte = z.height * 0.25
            pagina.add_redact_annot(z + (0, recorte, 0, -recorte), fill=(0, 0, 0))
        # Borra el texto bajo las zonas y pinta de negro los píxeles de las
        # imágenes que se crucen con ellas (p. ej. el QR del fondo).
        pagina.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_PIXELS)
        for z in zonas:
            pagina.draw_rect(z, color=None, fill=(0, 0, 0))

        imagen = pagina.get_pixmap(dpi=DPI).tobytes("jpeg", jpg_quality=CALIDAD_JPEG)
        hoja = nuevo.new_page(width=pagina.rect.width, height=pagina.rect.height)
        hoja.insert_image(hoja.rect, stream=imagen)

    nuevo.set_metadata({})
    nuevo.save(destino, garbage=4, deflate=True)
    return total


def verificar(pdf: Path) -> None:
    """El resultado no debe tener ni un carácter de texto extraíble."""
    with pymupdf.open(pdf) as doc:
        texto = "".join(p.get_text() for p in doc).strip()
    if texto:
        raise SystemExit(f"ERROR: {pdf.name} conserva texto extraíble.")


def main() -> None:
    raiz = Path(__file__).resolve().parent.parent
    origen = Path(sys.argv[1]) if len(sys.argv) > 1 else raiz / "_originales"
    destino = Path(sys.argv[2]) if len(sys.argv) > 2 else raiz / "assets/certificados/pdf"
    destino.mkdir(parents=True, exist_ok=True)

    pdfs = sorted(origen.glob("*.pdf"))
    if not pdfs:
        raise SystemExit(f"No hay PDF en {origen}")
    for pdf in pdfs:
        salida = destino / pdf.name
        n = redactar(pdf, salida)
        verificar(salida)
        aviso = "  <-- REVISAR: no se tapó nada" if n == 0 else ""
        print(f"{n:3d} zonas  {salida.stat().st_size // 1024:5d} KB  {pdf.name}{aviso}")
    print(f"\n{len(pdfs)} certificados en {destino}")


if __name__ == "__main__":
    main()
