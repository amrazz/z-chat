from .models import Profile, UserMessage
from django.contrib.auth.models import User
from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth import authenticate


class UserRegisterSerializers(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True, required=True, validators=[validate_password]
    )
    password2 = serializers.CharField(write_only=True, required=True)
    profile_image = serializers.ImageField(required=False)

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "password", "password2", "profile_image"]
        extra_kwargs = {"password": {"write_only": True}}

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError({"password": "Password does not match."})

        return attrs
    

    def create(self, validated_data):
        profile_image = validated_data.pop("profile_image", None)
        user = User.objects.create(
            username=validated_data["username"],
            first_name=validated_data["first_name"],
            last_name=validated_data["last_name"],
        )
        user.set_password(validated_data["password"])
        user.save()
        
        Profile.objects.create(user=user, profile_image=profile_image)
        return user


class UserLoginSerializer(serializers.Serializer):
    username = serializers.CharField(required = True)
    password = serializers.CharField(required = True, write_only = True)
        
    
    def validate(self, attrs):
        errors = {}
        if not attrs.get("username"):
            errors["username"] = "Username is required."
        if not attrs.get("password"):
            errors["password"] = "Password is required."
        if errors:
            raise serializers.ValidationError(errors)
        
        try:
            user_object = User.objects.get(username=attrs["username"])
        except User.DoesNotExist:
            raise serializers.ValidationError({"username": "Username is incorrect."})
            
        user = authenticate(username=attrs["username"], password=attrs["password"])
        if not user:
            raise serializers.ValidationError({"password": "Password is incorrect."})
            
        attrs["user"] = user
        return attrs
        
        

class UserSerializer(serializers.ModelSerializer):
    profile_image = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "first_name", "last_name", "profile_image", "username"]

    def get_profile_image(self, obj):
        try:
            user_profile = Profile.objects.get(user=obj)
            request = self.context.get("request")
            if user_profile.profile_image and request:
                return request.build_absolute_uri(user_profile.profile_image.url)
            return None
        except Profile.DoesNotExist:
            return None
        
class UserMessageSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    receiver = UserSerializer(read_only=True)
    receiver_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source="receiver", write_only=True
    )

    class Meta:
        model = UserMessage
        fields = ["id", "sender", "receiver", "receiver_id", "message", "timestamp", "is_received", "is_read"]
        read_only_fields = ["id", "sender", "timestamp", "is_received", "is_read"]
