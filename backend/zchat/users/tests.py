from django.test import TestCase
from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from .models import UserMessage, Profile
import tempfile
from PIL import Image
import io


class UserRegistrationTests(APITestCase):
    def setUp(self):
        self.valid_payload = {
            "username": "testuser",
            "first_name": "Test",
            "last_name": "User",
            "password": "StrongPass123!",
            "password2": "StrongPass123!",
        }

    # User Registration test
    def test_valid_registration(self):
        url = reverse("signup")
        response = self.client.post(url, self.valid_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(User.objects.get().username, "testuser")

    # test profile needed to implement

    def test_valid_password(self):
        invalid_payload = self.valid_payload.copy()
        invalid_payload["password2"] = "DifferentPass123!"

        url = reverse("signup")
        response = self.client.post(url, invalid_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(User.objects.count(), 0)


class UserLoginTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="StrongPass123!"
        )
        Profile.objects.create(user=self.user)

        self.valid_payload = {"username": "testuser", "password": "StrongPass123!"}

    def test_valid_login(self):
        url = reverse("signin")
        response = self.client.post(url, self.valid_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access_token", response.data)
        self.assertIn("refresh_token", response.data)
        self.assertIn("user", response.data)

    def test_invalid_username(self):
        invalid_payload = self.valid_payload.copy()
        invalid_payload["username"] = "wronguser"

        url = reverse("signin")
        response = self.client.post(url, invalid_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_password(self):
        invalid_payload = self.valid_payload.copy()
        invalid_payload["password"] = "wrongpassword"

        url = reverse("signin")
        response = self.client.post(url, invalid_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class UserLogoutTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="StrongPass@123"
        )
        self.refresh_token = RefreshToken.for_user(self.user)

    def test_valid_logout(self):
        url = reverse("signout")
        response = self.client.post(
            url, {"refresh_token": str(self.refresh_token)}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_205_RESET_CONTENT)

    def test_missing_refresh_token(self):
        url = reverse("signout")
        response = self.client.post(url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class UserListTests(APITestCase):
    def setUp(self):
        self.user1 = User.objects.create_user(
            username="user1", password="StrongPass123!"
        )
        self.user2 = User.objects.create_user(
            username="user2", password="StrongPass123!"
        )
        User.objects.create_user(username="user3", password="StrongPass123!")

        self.client.force_authenticate(user=self.user1)

    def test_get_user_list(self):
        url = reverse("user-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        usernames = [user["username"] for user in response.data]
        self.assertIn("user2", usernames)
        self.assertIn("user3", usernames)
        self.assertNotIn("user1", usernames)

    def test_unauthorized_access(self):
        self.client.force_authenticate(user=None)

        url = reverse("user-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class UserMessageTests(APITestCase):
    def setUp(self):
        self.user1 = User.objects.create_user(
            username="user1", password="StrongPass123!"
        )
        self.user2 = User.objects.create_user(
            username="user2", password="StrongPass123!"
        )

        UserMessage.objects.create(
            sender=self.user1, receiver=self.user2, message="Hello from user1"
        )
        UserMessage.objects.create(
            sender=self.user2, receiver=self.user1, message="Hi back from user2"
        )

        self.client.force_authenticate(user=self.user1)

    def test_get_conversation(self):
        url = reverse("user-messages", args=[self.user2.id])
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            len(response.data), 2
        )  # Should include messages from both users

    def test_send_message(self):
        url = reverse("send_message")
        payload = {"receiver_id": self.user2.id, "message": "New test message send"}

        response = self.client.post(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(UserMessage.objects.count(), 3)
        self.assertEqual(response.data["message"], "New test message send")

    def test_send_empty_message(self):
        url = reverse("send_message")
        payload = {"receiver_id": self.user2.id, "message": ""}

        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_get_nonexistent_user_messages(self):
        url = reverse("user-messages", args=[999])
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
