from django.urls import path
from .views import SendMessageView, UserListView, UserLoginView, UserLogoutView, UserMessageView, UserRegistrationView

urlpatterns = [
    path("signup/", UserRegistrationView.as_view(), name="signup"),
    path("signin/", UserLoginView.as_view(), name="signin"),
    path("signout/", UserLogoutView.as_view(), name="signout"),
    path("list/", UserListView.as_view(), name="user-list"),
    path("messages/<int:user_id>/", UserMessageView.as_view(), name="user-messages"),
    path("send/", SendMessageView.as_view(), name="send_message"),
]
