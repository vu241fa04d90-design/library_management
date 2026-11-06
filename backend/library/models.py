from django.conf import settings
from django.db import models
from django.utils import timezone

# Starting values only. The librarian can change all of these on the Settings page.
DEFAULT_LOAN_DAYS = 14
DEFAULT_FINE_PER_DAY = 5
DEFAULT_MAX_ACTIVE_LOANS = 3


class LibrarySettings(models.Model):
    """One row that holds the library's rules. Edited from the Settings page."""

    library_name = models.CharField(max_length=80, default="Campus Library")
    currency = models.CharField(max_length=10, default="Rs.")
    loan_days = models.PositiveIntegerField(default=DEFAULT_LOAN_DAYS)
    fine_per_day = models.PositiveIntegerField(default=DEFAULT_FINE_PER_DAY)
    max_active_loans = models.PositiveIntegerField(default=DEFAULT_MAX_ACTIVE_LOANS)

    class Meta:
        verbose_name_plural = "library settings"

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return self.library_name


class Book(models.Model):
    title = models.CharField(max_length=200)
    author = models.CharField(max_length=150)
    isbn = models.CharField(max_length=20, unique=True)
    category = models.CharField(max_length=60, blank=True)
    description = models.TextField(blank=True)
    total_copies = models.PositiveIntegerField(default=1)
    available_copies = models.PositiveIntegerField(default=1)
    added_on = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["title"]

    def __str__(self):
        return f"{self.title} by {self.author}"


class Member(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="member"
    )
    student_id = models.CharField(max_length=30, unique=True, null=True, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    joined_on = models.DateField(auto_now_add=True)

    class Meta:
        ordering = ["user__first_name", "user__username"]

    @property
    def name(self):
        return self.user.get_full_name() or self.user.username

    def __str__(self):
        return self.name


class Issue(models.Model):
    book = models.ForeignKey(Book, on_delete=models.PROTECT, related_name="issues")
    member = models.ForeignKey(Member, on_delete=models.PROTECT, related_name="issues")
    issued_on = models.DateField(default=timezone.localdate)
    due_on = models.DateField()
    returned_on = models.DateField(null=True, blank=True)
    # Money already collected (or waived) for this loan, in whole currency units.
    fine_paid = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-issued_on", "-id"]

    @property
    def days_overdue(self):
        end = self.returned_on or timezone.localdate()
        return max((end - self.due_on).days, 0)

    @property
    def status(self):
        if self.returned_on:
            return "returned"
        return "overdue" if self.days_overdue > 0 else "active"

    def fine_total(self, rate):
        """Everything this loan has cost in fines so far."""
        return self.days_overdue * rate

    def fine_due(self, rate):
        """What is still unpaid."""
        return max(self.fine_total(rate) - self.fine_paid, 0)

    def __str__(self):
        return f"{self.book.title} -> {self.member.name}"


class Notification(models.Model):
    """A message sent to a student (shown in the app, and also emailed/texted)."""

    member = models.ForeignKey(Member, on_delete=models.CASCADE, related_name="notifications")
    issue = models.ForeignKey(
        Issue, on_delete=models.CASCADE, null=True, blank=True, related_name="notifications"
    )
    message = models.TextField()
    sent_on = models.DateField(default=timezone.localdate)
    emailed = models.BooleanField(default=False)
    texted = models.BooleanField(default=False)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.member.name}: {self.message[:40]}"
