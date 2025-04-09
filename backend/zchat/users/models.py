from django.db import models
from django.contrib.auth.models import User
from django.core.validators import FileExtensionValidator
from django.core.exceptions import ValidationError

# Create your models here.

def validate_image_size(image):
    image_size = image.size
    image_size_limit = 5.0
    if image_size > image_size_limit * 1024 * 1024:
        raise ValidationError(f"Max file size is {image_size_limit}MB")

class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    profile_image = models.ImageField(upload_to="profile_images/",validators=[
            FileExtensionValidator(allowed_extensions=['jpg', 'jpeg', 'png']),
            validate_image_size,
        ], null=True, blank=True)

    def __str__(self):
        return f'{self.user.username} Profile'
    
    
class UserMessage(models.Model):
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name="send_message")
    receiver = models.ForeignKey(User, on_delete=models.CASCADE, related_name="received_messages")
    
    message = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    is_received  = models.BooleanField(default=False)
    is_read = models.BooleanField(default=False)
    
    def __str__(self):
        return f"{self.sender.username} to {self.receiver.username}: {self.message[:10]}"
    
    