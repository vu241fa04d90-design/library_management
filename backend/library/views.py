from datetime import timedelta

from django.db import transaction
from django.db.models import F, Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import filters, generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import Book, Issue, LibrarySettings, Member, Notification
from .notifications import send_overdue_reminders
from .permissions import IsStaffOrPublicRead, IsStaffOrReadOnly
from .serializers import (
    BookSerializer,
    IssueSerializer,
    LoginSerializer,
    MemberSerializer,
    MemberUpdateSerializer,
    NotificationSerializer,
    RegisterSerializer,
    SettingsSerializer,
    UserSerializer,
)


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class MeView(APIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)


class BookViewSet(viewsets.ModelViewSet):
    serializer_class = BookSerializer
    permission_classes = [IsStaffOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ["title", "author", "isbn", "category"]

    def get_queryset(self):
        qs = Book.objects.all()
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category__iexact=category)
        return qs

    def destroy(self, request, *args, **kwargs):
        book = self.get_object()
        if book.issues.filter(returned_on__isnull=True).exists():
            raise ValidationError(
                "Some copies of this book are on loan right now. "
                "Mark them returned before deleting the book."
            )
        with transaction.atomic():
            book.issues.all().delete()  # only returned loans are left at this point
            book.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"])
    def categories(self, request):
        names = (
            Book.objects.exclude(category="")
            .order_by("category")
            .values_list("category", flat=True)
            .distinct()
        )
        return Response(list(names))


class MemberViewSet(viewsets.ModelViewSet):
    """Students. Librarians can add, edit, delete them and clear their fines."""

    serializer_class = MemberSerializer
    permission_classes = [permissions.IsAdminUser]
    filter_backends = [filters.SearchFilter]
    search_fields = ["user__username", "user__first_name", "student_id"]
    http_method_names = ["get", "post", "patch", "put", "delete", "head", "options"]

    def get_queryset(self):
        return (
            Member.objects.filter(user__is_staff=False)
            .select_related("user")
            .prefetch_related("issues")
        )

    def create(self, request, *args, **kwargs):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        member = self.get_queryset().get(user=user)
        return Response(self.get_serializer(member).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        member = self.get_object()
        serializer = MemberUpdateSerializer(member, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(self.get_serializer(self.get_object()).data)

    def destroy(self, request, *args, **kwargs):
        member = self.get_object()
        if member.issues.filter(returned_on__isnull=True).exists():
            raise ValidationError(
                "This member still has books out. Mark them returned before deleting the account."
            )
        with transaction.atomic():
            member.issues.all().delete()  # returned loans only
            member.user.delete()          # also removes the Member row
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="clear-fines")
    def clear_fines(self, request, pk=None):
        member = self.get_object()
        rate = LibrarySettings.load().fine_per_day
        with transaction.atomic():
            for issue in Issue.objects.select_for_update().filter(member=member):
                owed = issue.fine_due(rate)
                if owed:
                    issue.fine_paid += owed
                    issue.save(update_fields=["fine_paid"])
        return Response(self.get_serializer(self.get_object()).data)


class IssueViewSet(viewsets.ModelViewSet):
    serializer_class = IssueSerializer
    permission_classes = [IsStaffOrReadOnly]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        qs = Issue.objects.select_related("book", "member__user")
        params = self.request.query_params
        user = self.request.user
        if not user.is_staff:
            qs = qs.filter(member__user=user)

        today = timezone.localdate()
        state = params.get("status")
        if state == "active":
            qs = qs.filter(returned_on__isnull=True, due_on__gte=today)
        elif state == "overdue":
            qs = qs.filter(returned_on__isnull=True, due_on__lt=today)
        elif state == "returned":
            qs = qs.filter(returned_on__isnull=False)

        term = params.get("search")
        if term:
            qs = qs.filter(
                Q(book__title__icontains=term)
                | Q(member__user__username__icontains=term)
                | Q(member__user__first_name__icontains=term)
            )
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        member = serializer.validated_data["member"]
        due_on = serializer.validated_data.get("due_on")
        rules = LibrarySettings.load()

        with transaction.atomic():
            book = Book.objects.select_for_update().get(pk=serializer.validated_data["book"].pk)
            if book.available_copies < 1:
                raise ValidationError({"book": "No copies of this book are available."})
            open_loans = Issue.objects.filter(member=member, returned_on__isnull=True)
            if open_loans.filter(book=book).exists():
                raise ValidationError({"member": "This member already has a copy of this book."})
            if open_loans.count() >= rules.max_active_loans:
                raise ValidationError(
                    {"member": f"This member already has {rules.max_active_loans} books out, which is the limit."}
                )
            today = timezone.localdate()
            if due_on and due_on < today:
                raise ValidationError({"due_on": "The due date can't be in the past."})
            issue = Issue.objects.create(
                book=book,
                member=member,
                due_on=due_on or today + timedelta(days=rules.loan_days),
            )
            book.available_copies -= 1
            book.save(update_fields=["available_copies"])

        return Response(self.get_serializer(issue).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="return")
    def return_book(self, request, pk=None):
        with transaction.atomic():
            issue = get_object_or_404(Issue.objects.select_for_update(), pk=pk)
            if issue.returned_on:
                raise ValidationError("This book has already been returned.")
            issue.returned_on = timezone.localdate()
            issue.save(update_fields=["returned_on"])
            Book.objects.filter(pk=issue.book_id).update(
                available_copies=F("available_copies") + 1
            )
        issue = Issue.objects.select_related("book", "member__user").get(pk=issue.pk)
        return Response(self.get_serializer(issue).data)

    @action(detail=True, methods=["post"], url_path="clear-fine")
    def clear_fine(self, request, pk=None):
        rate = LibrarySettings.load().fine_per_day
        with transaction.atomic():
            issue = get_object_or_404(Issue.objects.select_for_update(), pk=pk)
            owed = issue.fine_due(rate)
            if owed <= 0:
                raise ValidationError("There is no fine to clear on this loan.")
            issue.fine_paid += owed
            issue.save(update_fields=["fine_paid"])
        issue = Issue.objects.select_related("book", "member__user").get(pk=issue.pk)
        return Response(self.get_serializer(issue).data)


    @action(detail=False, methods=["post"], url_path="send-reminders",
            permission_classes=[permissions.IsAdminUser])
    def send_reminders(self, request):
        """Librarian button: remind every student who has an overdue book."""
        return Response(send_overdue_reminders())


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """A student's own notifications."""

    serializer_class = NotificationSerializer
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        return Notification.objects.filter(member__user=self.request.user)

    @action(detail=False, methods=["post"], url_path="mark-read")
    def mark_read(self, request):
        self.get_queryset().filter(is_read=False).update(is_read=True)
        return Response({"ok": True})


def fines_owed(issues, rate):
    """Unpaid fines across a set of loans (open overdue ones and returned-late ones)."""
    today = timezone.localdate()
    late = issues.filter(
        Q(returned_on__isnull=True, due_on__lt=today) | Q(returned_on__gt=F("due_on"))
    )
    return sum(i.fine_due(rate) for i in late)


class StatsView(APIView):
    """Numbers for the dashboard. Librarians see the whole library, students see their own."""

    def get(self, request):
        today = timezone.localdate()
        rate = LibrarySettings.load().fine_per_day
        if request.user.is_staff:
            open_loans = Issue.objects.filter(returned_on__isnull=True)
            return Response(
                {
                    "titles": Book.objects.count(),
                    "copies": Book.objects.aggregate(n=Sum("total_copies"))["n"] or 0,
                    "on_loan": open_loans.count(),
                    "overdue": open_loans.filter(due_on__lt=today).count(),
                    "members": Member.objects.filter(user__is_staff=False).count(),
                    "fines": fines_owed(Issue.objects.all(), rate),
                }
            )

        mine = Issue.objects.filter(member__user=request.user)
        open_loans = mine.filter(returned_on__isnull=True)
        return Response(
            {
                "on_loan": open_loans.count(),
                "overdue": open_loans.filter(due_on__lt=today).count(),
                "returned": mine.filter(returned_on__isnull=False).count(),
                "fines": fines_owed(mine, rate),
            }
        )


class SettingsView(APIView):
    """Library name, currency and the loan rules. Anyone can read; librarians can change."""

    permission_classes = [IsStaffOrPublicRead]

    def get(self, request):
        return Response(SettingsSerializer(LibrarySettings.load()).data)

    def patch(self, request):
        serializer = SettingsSerializer(LibrarySettings.load(), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    put = patch
