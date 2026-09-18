from django.urls import path
from .views import MessageQueueListView, MessageQueueRetryView, MessageQueueStatsView

urlpatterns = [
    path("queue/", MessageQueueListView.as_view(), name="message-queue-list"),
    path("queue/<int:pk>/retry/", MessageQueueRetryView.as_view(), name="message-queue-retry"),
    path("queue/stats/", MessageQueueStatsView.as_view(), name="message-queue-stats"),
]
