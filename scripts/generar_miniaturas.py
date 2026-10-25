"""Genera miniaturas .webp de la primera página de cada certificado tapado.

Uso (desde la raíz del proyecto, con el entorno virtual activo):
    python scripts/generar_miniaturas.py

Lee `assets/certificados/pdf/` (los PDF YA tapados, nunca los originales)
y escribe `assets/certificados/thumbs/<mismo-nombre>.webp`.

Por qué .webp y 480 px de ancho: la galería muestra tarjetas pequeñas; una
miniatura así pesa unos pocos KB y la página carga rápido incluso en datos
móviles. El PDF completo se abre solo cuando alguien pulsa "Ver PDF".
"""

from pathlib import Path

import pymupdf
from PIL import Image

ANCHO = 480
CALIDAD = 72


def main() -> None:
    raiz = Path(__file__).resolve().parent.parent
    origen = raiz / "assets/certificados/pdf"
    destino = raiz / "assets/certificados/thumbs"
    destino.mkdir(parents=True, exist_ok=True)

    for pdf in sorted(origen.glob("*.pdf")):
        pagina = pymupdf.open(pdf)[0]
        escala = ANCHO / pagina.rect.width
        pix = pagina.get_pixmap(matrix=pymupdf.Matrix(escala, escala))
        imagen = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        salida = destino / f"{pdf.stem}.webp"
        imagen.save(salida, "WEBP", quality=CALIDAD, method=6)
        print(f"{salida.stat().st_size // 1024:4d} KB  {salida.name}")


if __name__ == "__main__":
    main()
