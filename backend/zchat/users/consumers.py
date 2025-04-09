import json
from channels.generic.websocket import AsyncJsonWebsocketConsumer, WebsocketConsumer
from .models import UserMessage
from django.contrib.auth import get_user_model
from asgiref.sync import sync_to_async, async_to_sync

User = get_user_model()

class ChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.room_name = self.scope["url_route"]["kwargs"]["token"]
        self.room_group_name = f"chat_{self.scope['user'].id}"
        print(f"WebSocket connected for user: {self.scope['user']}, token: {self.room_name}")
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        print(f"WebSocket disconnected: {close_code}")
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        text_data_json = json.loads(text_data)
        print("Received chat data", text_data_json)

        if "message" not in text_data_json:
            print("Not a chat message, ignoring")
            await self.send(text_data=json.dumps({"error": "Invalid message format: 'message' key required"}))
            return

        message = text_data_json["message"]
        sender_id = text_data_json["sender_id"]
        sender_username = text_data_json["sender_username"]
        receiver_id = text_data_json.get("receiver_id")
        receiver_username = text_data_json.get("receiver")

        if not receiver_id and not receiver_username:
            print("No receiver specified in message")
            await self.send(text_data=json.dumps({"error": "Receiver not specified"}))
            return

        print(f"Received message from {sender_username}: {message}, receiver_id: {receiver_id}, receiver_username: {receiver_username}")

        @sync_to_async
        def save_message():
            try:
                sender_instance = User.objects.get(pk=sender_id)
                if receiver_id:
                    receiver = User.objects.get(id=receiver_id)
                else:
                    receiver = User.objects.get(username=receiver_username)
                msg_obj = UserMessage.objects.create(
                    sender=sender_instance, receiver=receiver, message=message
                )
                print(f"Message saved: ID={msg_obj.id}, Sender={sender_instance}, Receiver={receiver}")
                return msg_obj.id, msg_obj.timestamp, receiver.id
            except User.DoesNotExist as e:
                print(f"User lookup failed: {str(e)}")
                raise
            except Exception as e:
                print(f"Failed to save message: {str(e)}")
                raise

        try:
            message_id, timestamp, receiver_id = await save_message()
        except Exception as e:
            print(f"Error in save_message: {str(e)}")
            await self.send(text_data=json.dumps({"error": f"Failed to save message: {str(e)}"}))
            return

        # Send message to sender and receiver groups
        await self.channel_layer.group_send(
            f"chat_{sender_id}",
            {
                "type": "chat_message",
                "message": message,
                "sender_id": sender_id,
                "receiver_id": receiver_id,
                "timestamp": timestamp.isoformat(),
                "message_id": message_id,
            },
        )
        await self.channel_layer.group_send(
            f"chat_{receiver_id}",
            {
                "type": "chat_message",
                "message": message,
                "sender_id": sender_id,
                "receiver_id": receiver_id,
                "timestamp": timestamp.isoformat(),
                "message_id": message_id,
            },
        )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            "message": event["message"],
            "sender_id": event["sender_id"],
            "receiver_id": event["receiver_id"],
            "timestamp": event["timestamp"],
            "message_id": event["message_id"],
        }))

class CallConsumer(WebsocketConsumer):
    def connect(self):
        self.accept()
        print("Call WebSocket connected")
        self.send(text_data=json.dumps({"type": "connection", "data": {"message": "connected"}}))

    def disconnect(self, code):
        print(f"Call WebSocket disconnected with code {code}")
        if hasattr(self, "my_name"):
            print(f"Removing {self.my_name} from call groups")
            async_to_sync(self.channel_layer.group_discard)(self.my_name, self.channel_name)

    def receive(self, text_data):
        try:
            text_data_json = json.loads(text_data)
            print("CallConsumer received:", text_data_json)
            event_type = text_data_json["type"]
            print(f"CallConsumer received {event_type} event")

            if event_type == "login":
                self.my_name = text_data_json["data"]["name"]
                print(f"User {self.my_name} logged in to call service")
                async_to_sync(self.channel_layer.group_add)(self.my_name, self.channel_name)
                self.send(text_data=json.dumps({"type": "login_success", "data": {"name": self.my_name}}))
            elif event_type == "call":
                name = text_data_json["data"]["name"]
                print(f"User {self.my_name} is calling {name}")
                rtc_message = text_data_json["data"]["rtcMessage"]
                async_to_sync(self.channel_layer.group_send)(
                    name,
                    {
                        "type": "call_received",
                        "data": {
                            "caller": self.my_name,
                            "rtcMessage": rtc_message,
                        },
                    },
                )
                self.send(text_data=json.dumps({"type": "call_sent", "data": {"to": name}}))
            elif event_type == "answer_call":
                caller = text_data_json["data"]["caller"]
                print(f"User {self.my_name} is answering call from {caller}")
                rtc_message = text_data_json["data"]["rtcMessage"]
                async_to_sync(self.channel_layer.group_send)(
                    caller,
                    {
                        "type": "call_answered",
                        "data": {"rtcMessage": rtc_message},
                    },
                )
            elif event_type == "ICEcandidate":
                user = text_data_json["data"]["user"]
                print(f"Sending ICE candidate from {self.my_name} to {user}")
                rtc_message = text_data_json["data"]["rtcMessage"]
                async_to_sync(self.channel_layer.group_send)(
                    user,
                    {
                        "type": "ICEcandidate",
                        "data": {"rtcMessage": rtc_message},
                    },
                )
            elif event_type == "end_call":
                if "data" in text_data_json and "user" in text_data_json["data"]:
                    user = text_data_json["data"]["user"]
                    print(f"User {self.my_name} is ending call with {user}")
                    async_to_sync(self.channel_layer.group_send)(
                        user,
                        {"type": "call_ended", "data": {"from": self.my_name}},
                    )
                else:
                    print(f"User {self.my_name} is ending all calls")
                    async_to_sync(self.channel_layer.group_send)(
                        self.my_name,
                        {"type": "call_ended", "data": {}},
                    )
        except KeyError as e:
            print("Error in CallConsumer:", str(e))

    def call_received(self, event):
        data = event["data"]
        print(f"Call received from {data['caller']}")
        self.send(text_data=json.dumps({
            "type": "call_received",
            "data": {
                "caller": data["caller"],
                "rtcMessage": data["rtcMessage"],
            },
        }))

    def call_answered(self, event):
        data = event["data"]
        print(f"Call answered, received RTC message: {data['rtcMessage']}")
        self.send(text_data=json.dumps({
            "type": "call_answered",
            "data": {
                "rtcMessage": data["rtcMessage"],
            },
        }))

    def ICEcandidate(self, event):
        data = event["data"]
        print(f"Received ICE candidate: {data['rtcMessage']}")
        self.send(text_data=json.dumps({
            "type": "ICEcandidate",
            "data": {
                "rtcMessage": data["rtcMessage"],
            },
        }))

    def call_ended(self, event):
        data = event["data"]
        print(f"Call ended, data: {data}")
        self.send(text_data=json.dumps({
            "type": "call_ended",
            "data": data,
        }))
