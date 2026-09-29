#!/usr/bin/env python3
"""Serve this cut over HTTP, telling the browser to revalidate every file.

python3 -m http.server sends Last-Modified and no Cache-Control, so the browser
guesses a lifetime from the file's age: a page untouched for days is reused for
hours, and it keeps loading the scripts named by its old ?v= tokens. no-cache
makes each load ask first (a 304 when nothing changed), so an edit shows on the
next reload.

    python3 serve.py [port]
"""
import http.server
import os
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("PORT", 8007))
    http.server.ThreadingHTTPServer(("", port), NoCacheHandler).serve_forever()
