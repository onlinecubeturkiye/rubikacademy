# Siteyi yerelde sunar; uzantısız adresleri .html dosyasına yönlendirir.
# Kullanım: python3 play-store/video/sunucu.py [port]  (repo kökünü sunar)
import http.server, os, sys
KOK = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=KOK, **k)
    def log_message(s, *a): pass
    def translate_path(s, path):
        p = super().translate_path(path)
        if not os.path.exists(p) and os.path.exists(p + ".html"): return p + ".html"
        if os.path.isdir(p) and not os.path.exists(os.path.join(p, "index.html")) and os.path.exists(p.rstrip("/") + ".html"): return p.rstrip("/") + ".html"
        return p
http.server.ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1]) if len(sys.argv) > 1 else 8765), H).serve_forever()
