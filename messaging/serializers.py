from rest_framework import serializers
from .models import MessageQueue


class MessageQueueSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    customer_name = serializers.CharField(source="customer.shop_name", read_only=True)
    bill_number = serializers.CharField(source="bill.bill_number", read_only=True)

    class Meta:
        model = MessageQueue
        fields = [
            "id",
            "organization",
            "organization_name",
            "message_type",
            "recipient",
            "caption",
            "file_path",
            "status",
            "retry_count",
            "max_retries",
            "error_message",
            "customer",
            "customer_name",
            "bill",
            "bill_number",
            "created_at",
            "updated_at",
        ]
