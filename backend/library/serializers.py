from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Book, Issue, LibrarySettings, Member, Notification

User = get_user_model()


def clean_phone(value):
    """Accepts 9876543210, +91 98765 43210, 98765-43210 ... returns digits (with optional +)."""
    raw = value.strip()
    plus = raw.startswith("+")
    digits = "".join(ch for ch in raw if ch.isdigit())
    if not 10 <= len(digits) <= 15:
        raise serializers.ValidationError("Enter a valid mobile number (10 to 15 digits).")
    return ("+" if plus else "") + digits


class UserSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "name", "is_staff"]

    def get_name(self, obj):
        return obj.get_full_name() or obj.username


class LoginSerializer(TokenObtainPairSerializer):
    """Normal JWT login, plus the user's profile so the frontend knows their role."""

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data


class RegisterSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=60)
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, min_length=6)
    email = serializers.EmailField()
    student_id = serializers.CharField(max_length=30, required=False, allow_blank=True)
    phone = serializers.CharField(max_length=20)

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("This username is taken.")
        return value

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("This email is already registered.")
        return value

    def validate_phone(self, value):
        return clean_phone(value)

    def validate_student_id(self, value):
        if value and Member.objects.filter(student_id=value).exists():
            raise serializers.ValidationError("This student ID is already registered.")
        return value

    def create(self, validated_data):
        with transaction.atomic():
            user = User.objects.create_user(
                username=validated_data["username"],
                password=validated_data["password"],
                first_name=validated_data["first_name"],
                email=validated_data.get("email", ""),
            )
            Member.objects.create(
                user=user,
                student_id=validated_data.get("student_id") or None,
                phone=validated_data.get("phone", ""),
            )
        return user


class BookSerializer(serializers.ModelSerializer):
    class Meta:
        model = Book
        fields = [
            "id", "title", "author", "isbn", "category",
            "description", "total_copies", "available_copies",
        ]
        read_only_fields = ["available_copies"]
        extra_kwargs = {"total_copies": {"min_value": 1}}

    def create(self, validated_data):
        validated_data["available_copies"] = validated_data.get("total_copies", 1)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        new_total = validated_data.get("total_copies", instance.total_copies)
        on_loan = instance.total_copies - instance.available_copies
        if new_total < on_loan:
            raise serializers.ValidationError(
                {"total_copies": f"{on_loan} copies are on loan right now, so the total can't go below that."}
            )
        validated_data["available_copies"] = new_total - on_loan
        return super().update(instance, validated_data)


class MemberSerializer(serializers.ModelSerializer):
    name = serializers.CharField(read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.CharField(source="user.email", read_only=True)
    active_loans = serializers.SerializerMethodField()
    fines_due = serializers.SerializerMethodField()

    class Meta:
        model = Member
        fields = [
            "id", "name", "username", "email", "student_id", "phone",
            "active_loans", "fines_due",
        ]

    def get_active_loans(self, obj):
        return sum(1 for i in obj.issues.all() if i.returned_on is None)

    def get_fines_due(self, obj):
        rate = fine_rate(self.context)
        return sum(i.fine_due(rate) for i in obj.issues.all())


class MemberUpdateSerializer(serializers.Serializer):
    """Edit a member. Every field is optional; the username can't be changed."""

    first_name = serializers.CharField(max_length=60, required=False)
    email = serializers.EmailField(required=False)
    student_id = serializers.CharField(max_length=30, required=False, allow_blank=True)
    phone = serializers.CharField(max_length=20, required=False)
    password = serializers.CharField(
        write_only=True, min_length=6, required=False, allow_blank=True
    )

    def validate_email(self, value):
        taken = User.objects.filter(email__iexact=value).exclude(pk=self.instance.user_id)
        if taken.exists():
            raise serializers.ValidationError("This email is already registered.")
        return value

    def validate_phone(self, value):
        return clean_phone(value)

    def validate_student_id(self, value):
        taken = Member.objects.filter(student_id=value).exclude(pk=self.instance.pk)
        if value and taken.exists():
            raise serializers.ValidationError("This student ID is already registered.")
        return value

    def update(self, member, data):
        user = member.user
        if "first_name" in data:
            user.first_name = data["first_name"]
        if "email" in data:
            user.email = data["email"]
        if data.get("password"):
            user.set_password(data["password"])
        user.save()
        if "student_id" in data:
            member.student_id = data["student_id"] or None
        if "phone" in data:
            member.phone = data["phone"]
        member.save()
        return member


def fine_rate(context):
    """Fine per day, read once per request and kept in the serializer context."""
    if "fine_rate" not in context:
        context["fine_rate"] = LibrarySettings.load().fine_per_day
    return context["fine_rate"]


class IssueSerializer(serializers.ModelSerializer):
    book_title = serializers.CharField(source="book.title", read_only=True)
    member_name = serializers.CharField(source="member.name", read_only=True)
    status = serializers.CharField(read_only=True)
    days_overdue = serializers.IntegerField(read_only=True)
    fine = serializers.SerializerMethodField()        # still unpaid
    fine_total = serializers.SerializerMethodField()  # everything charged so far

    class Meta:
        model = Issue
        fields = [
            "id", "book", "member", "book_title", "member_name",
            "issued_on", "due_on", "returned_on", "status", "days_overdue",
            "fine", "fine_total", "fine_paid",
        ]
        read_only_fields = ["issued_on", "returned_on", "fine_paid"]
        extra_kwargs = {"due_on": {"required": False}}

    def get_fine(self, obj):
        return obj.fine_due(fine_rate(self.context))

    def get_fine_total(self, obj):
        return obj.fine_total(fine_rate(self.context))


class SettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = LibrarySettings
        fields = ["library_name", "currency", "loan_days", "fine_per_day", "max_active_loans"]
        extra_kwargs = {
            "loan_days": {"min_value": 1, "max_value": 365},
            "fine_per_day": {"min_value": 0, "max_value": 100000},
            "max_active_loans": {"min_value": 1, "max_value": 100},
        }


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "message", "sent_on", "emailed", "texted", "is_read", "created_at"]
