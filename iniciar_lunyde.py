"""Arranca la web y Flask desde una sola terminal."""

import argparse
import errno
import getpass
import os
import subprocess
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--nueva-clave", action="store_true", help="Cargar otra clave de Gemini")
    opciones = parser.parse_args()
    raiz = Path(__file__).resolve().parent
    sys.path.insert(0, str(raiz / "analisis"))
    from app import app
    from diagnostico import ClaveGeminiIncompleta, clave_gemini, validar_clave_gemini

    clave = clave_gemini()
    if opciones.nueva_clave or not clave:
        try:
            if os.name == "nt":
                input("Copia la clave en Google AI Studio, vuelve aquí y pulsa Enter: ")
                clave = subprocess.run(
                    ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", "Get-Clipboard -Raw"],
                    check=True, capture_output=True, text=True, errors="replace",
                ).stdout.strip()
            else:
                clave = getpass.getpass("Pega tu clave de Gemini y pulsa Enter: ").strip()
        except (OSError, subprocess.SubprocessError):
            raise SystemExit("No se pudo leer el portapapeles.") from None
        except (EOFError, KeyboardInterrupt):
            raise SystemExit("\nArranque cancelado.") from None
    try:
        validar_clave_gemini(clave)
    except ClaveGeminiIncompleta:
        raise SystemExit("La clave está incompleta o tiene caracteres inválidos. Vuelve a arrancar con --nueva-clave.") from None
    os.environ["GEMINI_API_KEY"] = clave

    servir_archivos = partial(SimpleHTTPRequestHandler, directory=str(raiz))
    try:
        web = ThreadingHTTPServer(("127.0.0.1", 8000), servir_archivos)
    except OSError as error:
        if error.errno not in (errno.EADDRINUSE, 10048):
            raise
        web = None
        print("El puerto 8000 ya está ocupado. Se usará el servidor web que está abierto.")

    if web is not None:
        Thread(target=web.serve_forever, daemon=True).start()
    try:
        print("Abre http://127.0.0.1:8000/web/ cuando Flask muestre Running on.", flush=True)
        app.run(host="127.0.0.1", port=5000, debug=False, use_reloader=False)
    finally:
        if web is not None:
            web.shutdown()
            web.server_close()


if __name__ == "__main__":
    main()
