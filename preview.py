#!/usr/bin/env python3
"""Start this local review site. No upload, account, or cloud deployment."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import webbrowser
import sys

root = Path(__file__).resolve().parent
class PreviewHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

class PreviewServer(ThreadingHTTPServer):
    request_queue_size = 128
    daemon_threads = True

handler = partial(PreviewHandler, directory=str(root))
server = PreviewServer(('127.0.0.1', 0), handler)
entry = 'atelier.html' if len(sys.argv) > 1 and sys.argv[1] == 'atelier.html' else ''
url = f'http://127.0.0.1:{server.server_port}/{entry}'
print(f'Vision Apartments: {url}\nЧтобы закрыть предпросмотр, нажмите Control+C.', flush=True)
threading.Timer(0.5, lambda: webbrowser.open(url)).start()
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
