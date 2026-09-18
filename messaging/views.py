from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters

from .models import MessageQueue
from .serializers import MessageQueueSerializer
from .services import send_message_async


class MessageQueueListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = MessageQueueSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "message_type", "customer", "bill"]
    search_fields = ["recipient", "caption", "error_message"]
    ordering = ["-created_at"]

    def get_queryset(self):
        # Tenant manager handles filtering by active organization automatically
        return MessageQueue.objects.all()


class MessageQueueRetryView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            # Fetch message (Tenant scoped)
            message = MessageQueue.objects.get(pk=pk)
        except MessageQueue.DoesNotExist:
            return Response({"detail": "Message not found."}, status=status.HTTP_404_NOT_FOUND)

        if message.status != "failed":
            return Response(
                {"detail": f"Only failed messages can be retried. Current status is '{message.status}'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Reset status and retry count for manual retry
        message.status = "pending"
        message.error_message = "Manual retry requested."
        message.retry_count = 0 
        message.save()

        # Trigger async sending
        send_message_async(message.id)

        return Response(
            {"detail": "Message queued for retry.", "message": MessageQueueSerializer(message).data},
            status=status.HTTP_200_OK
        )


class MessageQueueStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Count
        stats = MessageQueue.objects.values("status").annotate(count=Count("id"))
        
        result = {
            "pending": 0,
            "processing": 0,
            "sent": 0,
            "failed": 0,
            "total": 0
        }
        for item in stats:
            status_name = item["status"]
            count = item["count"]
            if status_name in result:
                result[status_name] = count
            result["total"] += count
            
        return Response(result)
