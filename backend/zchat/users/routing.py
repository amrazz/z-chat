from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r"ws/chat/(?P<token>[^/]+)/$", consumers.ChatConsumer.as_asgi()),
    re_path(r"ws/call/$", consumers.CallConsumer.as_asgi()),
]