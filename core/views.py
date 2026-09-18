import mimetypes
from django.http import FileResponse, Http404
from django.conf import settings

def serve_spa(request, path=""):
    # Avoid serving api/admin/media requests here
    if path.startswith("api/") or path.startswith("admin/") or path.startswith("media/"):
        raise Http404()

    # Find the frontend dist directory relative to backend
    # Check if frontend is inside BASE_DIR first, fallback to parent directory
    frontend_dist_dir = settings.BASE_DIR / "frontend" / "dist"
    if not frontend_dist_dir.exists():
        frontend_dist_dir = settings.BASE_DIR.parent / "frontend" / "dist"
    print(frontend_dist_dir)
    # Resolve safe path
    file_path = (frontend_dist_dir / path).resolve()
    
    # Security check: ensure the resolved path stays within frontend_dist_dir
    try:
        file_path.relative_to(frontend_dist_dir)
    except ValueError:
        raise Http404()

    if file_path.exists() and file_path.is_file():
        content_type, _ = mimetypes.guess_type(str(file_path))
        content_type = content_type or 'application/octet-stream'
        
        # Set proper cache control for built assets (immutable/long cache since Vite uses content hashes)
        response = FileResponse(open(file_path, "rb"), content_type=content_type)
        if "assets/" in path:
            response["Cache-Control"] = "public, max-age=31536000, immutable"
        else:
            response["Cache-Control"] = "no-cache, no-store, must-revalidate"
        return response

    # Otherwise serve index.html (client-side routing fallback)
    index_path = frontend_dist_dir / "index.html"
    if index_path.exists() and index_path.is_file():
        response = FileResponse(open(index_path, "rb"), content_type="text/html")
        response["Cache-Control"] = "no-cache, no-store, must-revalidate"
        return response

    raise Http404("Frontend build not found. Please build the frontend first.")
