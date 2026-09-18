import logging

import requests
from django.conf import settings
from django.http import HttpResponse
from django.views import View

logger = logging.getLogger("messaging")


def whatsapp_internal_base_url() -> str:
    return getattr(settings, "WHATSAPP_INTERNAL_BASE_URL", "http://127.0.0.1:8787").rstrip("/")


class WhatsAppProxyView(View):
    """Reverse-proxy WhatsApp sender UI/API through Django (port 8000) for hosting."""

    def dispatch(self, request, *args, **kwargs):
        path = (kwargs.get("path") or "").lstrip("/")
        internal = whatsapp_internal_base_url()

        if path.startswith("api/") or path == "api":
            target = f"{internal}/{path}"
        else:
            target = f"{internal}/whatsapp/{path}" if path else f"{internal}/whatsapp/"

        if request.META.get("QUERY_STRING"):
            target = f"{target}?{request.META['QUERY_STRING']}"

        headers = {
            key[5:].replace("_", "-"): value
            for key, value in request.META.items()
            if key.startswith("HTTP_") and key not in ("HTTP_HOST", "HTTP_CONNECTION", "HTTP_CONTENT_LENGTH")
        }

        try:
            upstream = requests.request(
                method=request.method,
                url=target,
                headers=headers,
                data=request.body if request.method not in ("GET", "HEAD") else None,
                timeout=60,
                stream=True,
            )
        except requests.exceptions.ConnectionError:
            logger.warning("WhatsApp sender unavailable at %s", internal)
            return HttpResponse(
                '{"error":"WhatsApp sender service is not running"}',
                status=502,
                content_type="application/json",
            )
        except requests.exceptions.RequestException as exc:
            logger.error("WhatsApp proxy error: %s", exc)
            return HttpResponse(
                '{"error":"WhatsApp proxy failed"}',
                status=502,
                content_type="application/json",
            )

        response = HttpResponse(
            upstream.content,
            status=upstream.status_code,
            content_type=upstream.headers.get("Content-Type", "application/octet-stream"),
        )
        for header in ("Content-Disposition", "Cache-Control"):
            if header in upstream.headers:
                response[header] = upstream.headers[header]
        return response
