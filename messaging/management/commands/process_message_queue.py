from django.core.management.base import BaseCommand
from messaging.services import process_failed_retries, process_single_message_from_queue
from messaging.models import MessageQueue


class Command(BaseCommand):
    help = "Checks the messaging database queue for pending and failed messages."

    def handle(self, *args, **options):
        self.stdout.write("Checking and processing message queue...")
        
        # 1. Catch any pending messages that got stuck (e.g. due to server crash/restart)
        stuck_messages = MessageQueue.all_objects.filter(status="pending")
        self.stdout.write(f"Found {stuck_messages.count()} stuck pending messages.")
        for msg in stuck_messages:
            self.stdout.write(f"Processing pending message ID: {msg.id}")
            process_single_message_from_queue(msg.id)
            
        # 2. Process exponential backoff retries for failed messages
        self.stdout.write("Running exponential backoff retry checks...")
        process_failed_retries()
        
        self.stdout.write("Queue processing complete.")
