from django.contrib import admin

from .models import Book, Issue, LibrarySettings, Member, Notification


@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = ("title", "author", "isbn", "category", "available_copies", "total_copies")
    search_fields = ("title", "author", "isbn")


@admin.register(Member)
class MemberAdmin(admin.ModelAdmin):
    list_display = ("name", "student_id", "phone", "email")
    search_fields = ("user__username", "user__first_name", "student_id")


    @admin.display(description="Email")
    def email(self, obj):
        return obj.user.email


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("member", "sent_on", "emailed", "texted", "is_read")
    list_filter = ("sent_on", "emailed", "texted")


@admin.register(Issue)
class IssueAdmin(admin.ModelAdmin):
    list_display = ("book", "member", "issued_on", "due_on", "returned_on", "fine_paid")
    list_filter = ("returned_on",)


@admin.register(LibrarySettings)
class LibrarySettingsAdmin(admin.ModelAdmin):
    list_display = ("library_name", "currency", "loan_days", "fine_per_day", "max_active_loans")
