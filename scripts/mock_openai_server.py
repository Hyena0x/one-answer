from http.server import BaseHTTPRequestHandler, HTTPServer
import json

RESPONSES = [
    {
        "direct_answer": "Start with the narrow MCP path first.",
        "key_points": ["A smaller scope is easier to ship and validate."],
        "disagreements_or_risks": ["A visible UI may still help explain the product early on."],
        "uncertainties": ["The effect of a thin demo layer on adoption still needs validation."],
        "recommended_direction": "Build the MCP path first."
    },
    {
        "direct_answer": "Do not fully discard a thin demo surface yet.",
        "key_points": ["A tiny visible layer can help distribution and comprehension."],
        "disagreements_or_risks": ["Pure backend tools can be harder to discover and explain."],
        "uncertainties": ["It is unclear whether the distribution benefit is large enough to justify even a thin UI."],
        "recommended_direction": "Keep at most a thin demo layer if needed."
    },
    {
        "final_answer": "Start with the narrow MCP path first, and only keep a very thin demo surface if real distribution evidence shows it is necessary.",
        "consensus_points": [
            "A narrower initial product is easier to ship than a full desktop client.",
            "The highest-leverage surface is the reusable capability layer, not a heavy standalone UI."
        ],
        "divergence_points": [
            "The main disagreement is whether a thin demo UI should exist early for distribution and explanation."
        ],
        "uncertainties": [
            "The real adoption effect of a thin demo layer is still unclear and should be validated with actual users."
        ],
        "confidence": {
            "level": "medium",
            "reason": "The single-model self-critique flow supports a narrow-first strategy, but this is not true cross-model consensus."
        }
    }
]

class Handler(BaseHTTPRequestHandler):
    counter = 0

    def do_POST(self):
        if self.path != '/v1/chat/completions':
            self.send_response(404)
            self.end_headers()
            return
        length = int(self.headers.get('Content-Length', '0'))
        body = self.rfile.read(length).decode('utf-8')
        try:
            payload = json.loads(body)
        except Exception:
            payload = {"raw": body}
        idx = min(Handler.counter, len(RESPONSES) - 1)
        content = json.dumps(RESPONSES[idx])
        Handler.counter += 1
        response = {
            "choices": [
                {"message": {"content": content}}
            ],
            "debug": {
                "request_model": payload.get('model'),
                "call_index": Handler.counter,
            }
        }
        encoded = json.dumps(response).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def log_message(self, format, *args):
        return

if __name__ == '__main__':
    server = HTTPServer(('127.0.0.1', 18080), Handler)
    print('mock-openai-listening:18080', flush=True)
    server.serve_forever()
