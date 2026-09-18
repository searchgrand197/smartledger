from rest_framework.renderers import BaseRenderer


class PDFRenderer(BaseRenderer):
    """Allow Accept: application/pdf on API views that return raw PDF bytes."""

    media_type = "application/pdf"
    format = "pdf"
    charset = None
    render_style = "binary"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data
