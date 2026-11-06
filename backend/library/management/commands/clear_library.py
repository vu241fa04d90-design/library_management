from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from library.models import Book, Issue

User = get_user_model()


class Command(BaseCommand):
    help = "Delete ALL books, loans and student accounts (librarian accounts are kept)."

    def add_arguments(self, parser):
        parser.add_argument("--yes", action="store_true", help="Skip the confirmation question")

    def handle(self, *args, **options):
        if not options["yes"]:
            answer = input("This deletes every book, loan and student account. Type 'yes' to continue: ")
            if answer.strip().lower() != "yes":
                self.stdout.write("Cancelled. Nothing was deleted.")
                return
        with transaction.atomic():
            Issue.objects.all().delete()
            Book.objects.all().delete()
            User.objects.filter(is_staff=False).delete()  # also removes their member rows
        self.stdout.write(self.style.SUCCESS("Library cleared. Librarian accounts were kept."))
