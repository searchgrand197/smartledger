from django.urls import path

from .views import BackupStatusView, BusinessSettingsView, DismissSetupView, PublicHomeConfigView

urlpatterns = [
    path("settings/public/", PublicHomeConfigView.as_view(), name="public_home_config"),
    path("settings/", BusinessSettingsView.as_view(), name="business_settings"),
    path("settings/dismiss-setup/", DismissSetupView.as_view(), name="dismiss_setup"),
    path("backup/", BackupStatusView.as_view(), name="backup_status"),
]
