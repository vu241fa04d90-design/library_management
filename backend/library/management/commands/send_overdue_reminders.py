from django.core.management.base import BaseCommand

from library.notifications import send_overdue_reminders


class Command(BaseCommand):
    help = "Notify every student who has an overdue book (email, in-app, optional SMS)."

    def handle(self, *args, **options):
        result = send_overdue_reminders()
        self.stdout.write(
            self.style.SUCCESS(
                f"Reminders sent: {result['sent']} (already reminded today: {result['skipped']})"
            )
        )
