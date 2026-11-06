from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

router = DefaultRouter()
router.register("books", views.BookViewSet, basename="book")
router.register("members", views.MemberViewSet, basename="member")
router.register("issues", views.IssueViewSet, basename="issue")
router.register("notifications", views.NotificationViewSet, basename="notification")

urlpatterns = [
    path("auth/login/", views.LoginView.as_view()),
    path("auth/refresh/", TokenRefreshView.as_view()),
    path("auth/register/", views.RegisterView.as_view()),
    path("auth/me/", views.MeView.as_view()),
    path("stats/", views.StatsView.as_view()),
    path("settings/", views.SettingsView.as_view()),
    path("", include(router.urls)),
]
