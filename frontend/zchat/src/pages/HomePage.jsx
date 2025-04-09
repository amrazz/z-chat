import React, { useEffect, useRef, useState } from "react";
import api from "../api";
import { toast, Toaster } from "react-hot-toast";
import {
  peerConnection,
  initiateCall,
  answerCall,
  setupWebRTC,
  handleICECandidate,
  endCall,
} from "./WebRTC";
import { PhoneCall, Send, VideoIcon } from "lucide-react";
import EmojiPicker from "emoji-picker-react";

const Home = () => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [error, setError] = useState(null);
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [callSocket, setCallSocket] = useState(null);
  const [isCalling, setIsCalling] = useState(false);
  const [callReceived, setCallReceived] = useState(false);
  const [inCall, setInCall] = useState(false); // NEW: Flag when call is active
  const [offer, setOffer] = useState(null);
  const [callerName, setCallerName] = useState("");
  const messagesEndRef = useRef(null);
  const selectedUserRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");

  // Fetch users on component mount
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await api.get("users/list/");
        if (response.status === 200) setUsers(response.data);
      } catch (error) {
        toast.error(error.message || "Failed to fetch users");
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  // Setup chat WebSocket connection
  useEffect(() => {
    if (!currentUser.id) {
      console.error("Current user ID not found");
      return;
    }

    const initializeWebSocket = () => {
      const token = localStorage.getItem("access_token");
      if (!token) {
        console.error("No access token found");
        setConnectionStatus("disconnected");
        return null;
      }
      const wsUrl = `ws://localhost:8000/ws/chat/${token}/`;
      console.log("Connecting to:", wsUrl);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("WebSocket Connected Successfully");
        setConnectionStatus("connected");
      };

      ws.onerror = (error) => {
        console.error("WebSocket Error:", error);
        setConnectionStatus("error");
      };

      ws.onclose = (event) => {
        console.log("WebSocket Closed:", event.code, event.reason);
        setConnectionStatus("disconnected");
        if (event.code !== 1000) {
          console.log("Reconnecting in 3 seconds...");
          setTimeout(() => {
            const newSocket = initializeWebSocket();
            if (newSocket) setSocket(newSocket);
          }, 3000);
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.error) {
            toast.error(data.error);
            return;
          }

          console.log("Received WS message:", data);

          const currentSelectedUser = selectedUserRef.current;
          const senderId = parseInt(data.sender_id, 10);
          const receiverId = parseInt(data.receiver_id, 10);
          const currentUserId = parseInt(currentUser.id, 10);
          const selectedUserId = currentSelectedUser
            ? parseInt(currentSelectedUser.id, 10)
            : null;

          const isCurrentConversation =
            selectedUserId !== null &&
            ((senderId === currentUserId && receiverId === selectedUserId) ||
              (senderId === selectedUserId && receiverId === currentUserId));

          if (isCurrentConversation) {
            setMessages((prevMessages) => {
              const existingIndex = prevMessages.findIndex(
                (msg) => msg.isOptimistic && msg.message === data.message
              );

              if (existingIndex !== -1) {
                const updatedMessages = [...prevMessages];
                updatedMessages[existingIndex] = {
                  id: data.message_id,
                  sender: { id: senderId },
                  receiver: { id: receiverId },
                  message: data.message,
                  timestamp: data.timestamp,
                  isOptimistic: false,
                };
                return updatedMessages;
              }

              return [
                ...prevMessages,
                {
                  id: data.message_id,
                  sender: { id: senderId },
                  receiver: { id: receiverId },
                  message: data.message,
                  timestamp: data.timestamp,
                },
              ];
            });
          } else {
            // Show notification if message not in current conversation
            if (receiverId === currentUserId) {
              const sender = users.find((u) => parseInt(u.id, 10) === senderId);
              toast.info(`New message from ${sender?.first_name || "Unknown"}`);
            }
          }
        } catch (error) {
          console.error("Error parsing message:", error);
        }
      };

      return ws;
    };

    const newSocket = initializeWebSocket();
    if (newSocket) {
      setSocket(newSocket);
    }

    return () => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close(1000, "Component unmounting");
      }
    };
  }, [currentUser.id, users]);

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  useEffect(() => {
    if (!selectedUser) return;

    const fetchMessages = async () => {
      try {
        const response = await api.get(`users/messages/${selectedUser.id}/`);
        if (response.status === 200) {
          const normalizedMessages = response.data.map((msg) => ({
            id: msg.id,
            sender: { id: msg.sender.id || msg.sender },
            receiver: { id: msg.receiver.id || msg.receiver },
            message: msg.message,
            timestamp: msg.timestamp,
          }));
          setMessages(normalizedMessages);
        }
      } catch (err) {
        setError("Failed to load messages");
      }
    };
    fetchMessages();
  }, [currentUser, selectedUser]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedUser, messages.length]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    if (!selectedUser) {
      toast.error("Please select a user to chat with");
      return;
    }
    if (!socket || connectionStatus !== "connected") {
      toast.error("Unable to send message: Not connected to server");
      return;
    }

    // Create optimistic message
    const optimisticMessage = {
      id: `temp-${Date.now()}`,
      sender: { id: currentUser.id },
      receiver: { id: selectedUser.id },
      message: newMessage,
      timestamp: new Date().toISOString(),
      isOptimistic: true,
    };
    setMessages((prev) => [...prev, optimisticMessage]);

    socket.send(
      JSON.stringify({
        message: newMessage,
        receiver_id: selectedUser.id,
        receiver: selectedUser.username,
        sender_id: currentUser.id,
        sender_username: currentUser.username,
      })
    );
    setNewMessage("");
    setShowEmojiPicker(false);
  };

  // Set up Call WebSocket connection
  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:8000/ws/call/`);
    ws.onopen = () => {
      console.log("Call WebSocket connected");
      ws.send(
        JSON.stringify({
          type: "login",
          data: { name: currentUser.username },
        })
      );
    };
    ws.onerror = (error) => {
      console.error("Call WebSocket error:", error);
      toast.error("Call WebSocket connection failed");
    };
    ws.onclose = (event) => {
      console.log("Call WebSocket closed:", event.code, event.reason);
      if (event.code !== 1000) {
        toast.error("Call connection closed. Reconnecting...");
      }
    };

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      console.log("Call WS message:", data);

      switch (data.type) {
        case "call_received":
          // Store the incoming offer and caller, then show modal
          setOffer(data.data.rtcMessage);
          setCallerName(data.data.caller);
          setCallReceived(true);
          break;
        case "call_answered":
          // When caller gets answer, set remote description and mark the call active
          peerConnection.setRemoteDescription(data.data.rtcMessage);
          setInCall(true);
          break;
        case "ICEcandidate":
          console.log("ICE candidate received");
          handleICECandidate(data.data.rtcMessage);
          break;
        case "call_ended":
          console.log("Call ended by remote user");
          endCall(ws, localVideoRef, remoteVideoRef);
          setIsCalling(false);
          setCallReceived(false);
          setInCall(false);
          toast.info("Call ended");
          break;
        default:
          console.log("Unknown message type:", data.type);
          break;
      }
    };

    setCallSocket(ws);

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        console.log("Closing call WebSocket");
        ws.close();
      }
    };
  }, [currentUser.username]);

  const handleStartCall = () => {
    if (!callSocket || callSocket.readyState !== WebSocket.OPEN) {
      toast.error("Call server not connected");
      return;
    }
    if (!selectedUser) {
      toast.error("Please select a user to call");
      return;
    }
    console.log(`Attempting to call user ${selectedUser.username}`);
    setIsCalling(true);
    initiateCall(
      callSocket,
      selectedUser.username,
      localVideoRef,
      remoteVideoRef
    );
  };

  const handleAnswerCall = async () => {
    if (!callSocket || !offer || !callerName) return;
    // When the receiver clicks "Accept", set up the connection and send an answer
    await setupWebRTC(
      localVideoRef,
      remoteVideoRef,
      callSocket,
      offer,
      callerName
    );
    await answerCall(callSocket, callerName, localVideoRef, remoteVideoRef);
    setCallReceived(false);
    setInCall(true);
  };

  const handleEndCall = () => {
    if (!callSocket || callSocket.readyState !== WebSocket.OPEN) {
      toast.error("Call server not connected");
      return;
    }
    if (selectedUser && isCalling) {
      callSocket.send(
        JSON.stringify({
          type: "end_call",
          data: { user: selectedUser.username },
        })
      );
    } else {
      callSocket.send(JSON.stringify({ type: "end_call" }));
    }
    endCall(callSocket, localVideoRef, remoteVideoRef);
    setIsCalling(false);
    setCallReceived(false);
    setInCall(false);
  };

  const toggleEmojiPicker = () => setShowEmojiPicker((prev) => !prev);
  const handleEmojiClick = (emojiObject) => {
    setNewMessage((prev) => prev + emojiObject.emoji);
  };

  return (
    <div className="flex h-screen">
      <Toaster />
      <div className="w-1/4 bg-white border-r p-4 border-b">
        <h2 className="text-2xl font-mono font-bold mb-4">Chats</h2>
        <div className="flex">
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-2 mb-4 border rounded"
          />
        </div>
        <ul>
          {users
            ?.filter(
              (user) =>
                user.first_name
                  .toLowerCase()
                  .includes(searchTerm.toLowerCase()) ||
                user.last_name.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .map((user) => (
              <li
                key={user.id}
                onClick={() => setSelectedUser(user)}
                className={`p-2 cursor-pointer hover:bg-gray-100 font-mono ${
                  selectedUser?.id === user.id ? "bg-gray-200" : ""
                }`}
              >
                {user.first_name} {user.last_name}
              </li>
            ))}
        </ul>
      </div>
      <div className="flex-1 flex flex-col">
        {selectedUser ? (
          <>
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold font-mono">
                  {selectedUser.first_name} {selectedUser.last_name}
                </h2>
                <p className="text-sm text-gray-500">
                  Status: {connectionStatus}
                </p>
              </div>
              <div className="mr-10 cursor-pointer gap-5 flex justify-between">
                <PhoneCall size={20} />
                <VideoIcon size={20} onClick={handleStartCall} />
              </div>
            </div>
            <div className="flex-1 p-4 overflow-y-auto">
              {messages?.map((msg) => (
                <div
                  key={msg.id}
                  className={`mb-4 ${
                    parseInt(msg.sender.id, 10) === parseInt(currentUser.id, 10)
                      ? "text-right"
                      : "text-left"
                  }`}
                >
                  <div
                    className={`inline-block p-2 rounded-lg ${
                      parseInt(msg.sender.id, 10) ===
                      parseInt(currentUser.id, 10)
                        ? "bg-blue-500 text-white"
                        : "bg-gray-200"
                    } ${msg.isOptimistic ? "opacity-70" : ""}`}
                  >
                    <p>{msg.message}</p>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(msg.timestamp).toLocaleTimeString("en-US", {
                      timeZone: "Asia/Kolkata",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Modal for Incoming Call on Receiver Side */}
            {callReceived && (
              <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
                <div className="bg-white p-6 rounded-lg shadow-lg text-center">
                  <h3 className="text-xl font-bold mb-4">
                    Incoming call from {callerName}
                  </h3>
                  <div className="flex justify-center space-x-4 mt-4">
                    <button
                      onClick={handleAnswerCall}
                      className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition"
                    >
                      Accept
                    </button>
                    <button
                      onClick={handleEndCall}
                      className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Overlay for Active Call (after acceptance) */}
            {inCall && (
              <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
                <div className="relative w-full max-w-4xl">
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full rounded bg-black"
                  />
                  <div className="absolute bottom-4 right-4 w-1/4">
                    <video
                      ref={localVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full rounded"
                    />
                  </div>
                </div>
                <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                  <button onClick={handleEndCall} className="bg-red-500 p-2">
                    End Call
                  </button>
                </div>
              </div>
            )}

            <form
              onSubmit={handleSendMessage}
              className="p-4 border-t bg-white flex items-center space-x-2 relative"
            >
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 p-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={toggleEmojiPicker}
                className="text-gray-500"
              >
                😊
              </button>
              <button type="submit" className="text-indigo-500">
                <Send />
              </button>
              {showEmojiPicker && (
                <div className="absolute bottom-16 right-16">
                  <EmojiPicker onEmojiClick={handleEmojiClick} />
                </div>
              )}
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-500 text-lg font-mono">
              Select a user to start chatting.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
