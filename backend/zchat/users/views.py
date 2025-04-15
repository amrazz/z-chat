from rest_framework.views import APIView
from rest_framework import generics, status
from django.contrib.auth.models import User
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.permissions import IsAuthenticated, AllowAny

from .models import UserMessage
from .serializers import (
    UserLoginSerializer,
    UserMessageSerializer,
    UserRegisterSerializers,
    UserSerializer,
)

# Create your views here.


class UserRegistrationView(generics.CreateAPIView):
    permission_classes = [AllowAny]

    queryset = User.objects.all()
    serializer_class = UserRegisterSerializers


class UserLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = UserLoginSerializer(data=request.data)

        if serializer.is_valid():
            user = serializer.validated_data["user"]
            refresh = RefreshToken.for_user(user)
            user_serializer = UserSerializer(user, context={"request": request})
            return Response(
                {
                    "message": "User login successful",
                    "access_token": str(refresh.access_token),
                    "refresh_token": str(refresh),
                    "user" : user_serializer.data
                },
                status=status.HTTP_200_OK,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserLogoutView(APIView):

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh_token")

            if not refresh_token:
                return Response(
                    {"error": "Refresh token in required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response(
                {"message": "User Logged Out."}, status=status.HTTP_205_RESET_CONTENT
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


# --------------------------------------------


class UserListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UserSerializer

    def get_queryset(self):
        return User.objects.exclude(id=self.request.user.id).order_by("username")


class UserMessageView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id):
        try:
            receiver = User.objects.get(id=user_id)
            messages = (
                UserMessage.objects.filter(sender=request.user, receiver=receiver) |
                UserMessage.objects.filter(sender=receiver, receiver=request.user)
            ).order_by("timestamp")
            serializer = UserMessageSerializer(messages, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SendMessageView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not request.data.get("message") or not request.data.get("message").strip():
            return Response({"error": "Message cannot be empty."}, status=status.HTTP_400_BAD_REQUEST)
        data = {
            "receiver_id": request.data.get("receiver_id"),
            "message": request.data.get("message"),
            "sender": request.user,
        }
        serializer = UserMessageSerializer(data=data, context={'request': request})
        if serializer.is_valid():
            serializer.save(sender=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)