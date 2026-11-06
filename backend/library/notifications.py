"""Overdue reminders: in-app alert + email + optional SMS."""
import logging
import os

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from .models import Issue, LibrarySettings, Notification

log = logging.getLogger(__name__)


def build_message(issue, rules):
    days = issue.days_overdue
    fine = issue.fine_due(rules.fine_per_day)
    day_word = "day" if days == 1 else "days"
    return (
        f"Hello {issue.member.name}, the book \"{issue.book.title}\" was due on "
        f"{issue.due_on:%d %b %Y} and is now {days} {day_word} overdue. "
        f"Please return it to {rules.library_name} as soon as possible. "
        f"Fine so far: {rules.currency} {fine}."
    )


def send_sms(phone, text):
    """Sends an SMS through Twilio when TWILIO_* environment variables are set.

    Returns True if a text was sent. Without those variables (or without the
    `twilio` package) it quietly does nothing, so email + in-app still work.
    """
    sid = os.environ.get("TWILIO_ACCOUNT_SID")
    token = os.environ.get("TWILIO_AUTH_TOKEN")
    sender = os.environ.get("TWILIO_FROM_NUMBER")
    if not (sid and token and sender and phone):
        return False
    try:
        from twilio.rest import Client

        number = phone if phone.startswith("+") else f"+91{phone}"  # default: India
        Client(sid, token).messages.create(to=number, from_=sender, body=text)
        return True
    except Exception:  # never let an SMS problem stop the reminders
        log.exception("SMS to %s failed", phone)
        return False


def send_overdue_reminders(today=None):
    """Remind every student who still holds an overdue book. One reminder per loan per day.

    Returns a dict: {"sent": n, "skipped": n}.
    """
    today = today or timezone.localdate()
    rules = LibrarySettings.load()
    overdue = Issue.objects.filter(returned_on__isnull=True, due_on__lt=today).select_related(
        "book", "member__user"
    )
    sent = skipped = 0
    for issue in overdue:
        if Notification.objects.filter(issue=issue, sent_on=today).exists():
            skipped += 1  # already reminded today
            continue
        text = build_message(issue, rules)
        member = issue.member
        emailed = False
        if member.user.email:
            try:
                send_mail(
                    subject=f"Overdue book: {issue.book.title}",
                    message=text,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[member.user.email],
                )
                emailed = True
            except Exception:
                log.exception("Email to %s failed", member.user.email)
        texted = send_sms(member.phone, text)
        Notification.objects.create(
            member=member, issue=issue, message=text, sent_on=today,
            emailed=emailed, texted=texted,
        )
        sent += 1
    return {"sent": sent, "skipped": skipped}
