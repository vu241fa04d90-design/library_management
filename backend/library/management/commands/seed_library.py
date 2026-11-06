from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from library.models import Book, Issue, Member

User = get_user_model()

BOOKS = [
    ("Introduction to Algorithms", "Thomas H. Cormen", "Computer Science", 3),
    ("Clean Code", "Robert C. Martin", "Computer Science", 2),
    ("The Pragmatic Programmer", "Andrew Hunt, David Thomas", "Computer Science", 2),
    ("Database System Concepts", "Abraham Silberschatz", "Computer Science", 3),
    ("Operating System Concepts", "Abraham Silberschatz", "Computer Science", 2),
    ("Computer Networks", "Andrew S. Tanenbaum", "Computer Science", 2),
    ("Python Crash Course", "Eric Matthes", "Computer Science", 4),
    ("Discrete Mathematics and Its Applications", "Kenneth H. Rosen", "Mathematics", 3),
    ("A Brief History of Time", "Stephen Hawking", "Science", 2),
    ("Wings of Fire", "A. P. J. Abdul Kalam", "Biography", 3),
    ("The Discovery of India", "Jawaharlal Nehru", "History", 1),
    ("Godan", "Premchand", "Fiction", 2),
    ("Sapiens", "Yuval Noah Harari", "History", 2),
    ("Atomic Habits", "James Clear", "Self-help", 3),
]


def lend(book, member, days_ago, loan_days=14):
    """Create a loan directly, keeping the book's available count in step."""
    today = timezone.localdate()
    Issue.objects.create(
        book=book,
        member=member,
        issued_on=today - timedelta(days=days_ago),
        due_on=today - timedelta(days=days_ago) + timedelta(days=loan_days),
    )
    book.available_copies -= 1
    book.save(update_fields=["available_copies"])


class Command(BaseCommand):
    help = "Create a demo librarian, two students and sample books."

    def handle(self, *args, **options):
        librarian, created = User.objects.get_or_create(
            username="librarian",
            defaults={"first_name": "Lata", "is_staff": True, "is_superuser": True},
        )
        if created:
            librarian.set_password("library123")
            librarian.save()

        students = []
        for i, (username, name) in enumerate([("student1", "Nusala"), ("student2", "Ravi")], start=1):
            user, made = User.objects.get_or_create(
                username=username,
                defaults={"first_name": name, "email": f"{username}@example.com"},
            )
            if made:
                user.set_password("student123")
                user.save()
            member, _ = Member.objects.get_or_create(
                user=user, defaults={"student_id": f"CS2026{i:03d}", "phone": f"98765432{i:02d}"}
            )
            students.append(member)

        books = []
        for n, (title, author, category, copies) in enumerate(BOOKS, start=1):
            book, _ = Book.objects.get_or_create(
                isbn=f"SAMPLE-{n:03d}",
                defaults={
                    "title": title,
                    "author": author,
                    "category": category,
                    "total_copies": copies,
                    "available_copies": copies,
                },
            )
            books.append(book)

        if not Issue.objects.exists():
            lend(books[0], students[0], days_ago=3)    # active
            lend(books[6], students[0], days_ago=20)   # overdue by 6 days
            lend(books[9], students[1], days_ago=5)    # active
            lend(books[1], students[1], days_ago=30)   # overdue by 16 days

        self.stdout.write(self.style.SUCCESS("Sample data ready."))
        self.stdout.write("Librarian: librarian / library123")
        self.stdout.write("Student:   student1 / student123")
