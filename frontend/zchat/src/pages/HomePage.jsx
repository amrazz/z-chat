import React, { useEffect, useRef, useState, useCallback } from "react";
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
import { PhoneCall, Send, VideoIcon, Mic, MicOff, Video, VideoOff, X, Phone, LogOut } from "lucide-react";
import EmojiPicker from "emoji-picker-react";
import { useNavigate } from "react-router-dom";

const Home = () => {

  const navigate = useNavigate()
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
  const [inCall, setInCall] = useState(false);
  const [offer, setOffer] = useState(null);
  const [callerName, setCallerName] = useState("");
  const [audioMuted, setAudioMuted] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);
  const [callStatus, setCallStatus] = useState(""); 
  const [connectionQuality, setConnectionQuality] = useState("Good")
  
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

  const handleWebSocketMessage = useCallback((event) => {
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
  }, [currentUser.id, users]);

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

      ws.onmessage = handleWebSocketMessage;

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

  // Setup Call WebSocket connection
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
          setCallStatus("Connected");
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
          setCallStatus("");
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
    setCallStatus("Calling...");
    initiateCall(
      callSocket,
      selectedUser.username,
      localVideoRef,
      remoteVideoRef
    );
  };

  const handleAnswerCall = async () => {
    if (!callSocket || !offer || !callerName) return;
    setCallStatus("Connecting...");
    try {
        await setupWebRTC(
            localVideoRef,
            remoteVideoRef,
            callSocket,
            offer,
            callerName
        );
        await answerCall(callSocket, callerName, localVideoRef, remoteVideoRef);
        
        // Add this code to ensure videos are displayed after answer
        if (localVideoRef.current && localVideoRef.current.srcObject) {
            // Ensure local video is playing
            localVideoRef.current.play().catch(err => {
                console.error("Error playing local video:", err);
            });
        }
        
        // Give a little time for the connection to establish
        setTimeout(() => {
            if (remoteVideoRef.current && !remoteVideoRef.current.srcObject && peerConnection) {
                console.log("Attempting to recover remote video display");
                // Try to get any existing remote tracks
                const remoteStreams = peerConnection.getReceivers()
                    .filter(receiver => receiver.track.kind === 'video')
                    .map(receiver => new MediaStream([receiver.track]));
                
                if (remoteStreams.length > 0) {
                    remoteVideoRef.current.srcObject = remoteStreams[0];
                    remoteVideoRef.current.play().catch(err => {
                        console.error("Error playing recovered remote video:", err);
                    });
                }
            }
        }, 1000);
        
        setCallReceived(false);
        setInCall(true);
        setCallStatus("Connected");
    } catch (error) {
        console.error("Error answering call:", error);
        toast.error("Failed to connect to call");
        setCallStatus("");
        setCallReceived(false);
    }
};

  const handleEndCall = () => {
    if (!callSocket || callSocket.readyState !== WebSocket.OPEN) {
      toast.error("Call server not connected");
      return;
    }
    if (selectedUser && (isCalling || inCall)) {
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
    setCallStatus("");
  };

  const toggleMicrophone = () => {
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      const audioTrack = localVideoRef.current.srcObject
        .getAudioTracks()
        .find((track) => track.kind === "audio");
      
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      const videoTrack = localVideoRef.current.srcObject
        .getVideoTracks()
        .find((track) => track.kind === "video");
      
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoMuted(!videoTrack.enabled);
      }
    }
  };

  const toggleEmojiPicker = () => setShowEmojiPicker((prev) => !prev);
  const handleEmojiClick = (emojiObject) => {
    setNewMessage((prev) => prev + emojiObject.emoji);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Toaster />
      <div className="w-1/4 bg-white border-r p-4 shadow-sm">
        <div className="flex items-center justify-between">
        <h2 className="text-2xl font-mono font-bold mb-4 text-indigo-600">Chats</h2>
        <button
        onClick={() => navigate("/logout")}
        className="mb-4 rounded-full bg-indigo-400 p-2 cursor-pointer">{<LogOut color="white" size={15} />}</button>
        </div>
        <div className="flex">
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-2 mb-4 border rounded focus:ring-2 focus:ring-indigo-300 focus:outline-none transition"
          />
        </div>
        <ul className="divide-y divide-gray-100">
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
                className={`p-3 cursor-pointer hover:bg-gray-50 font-mono rounded-md transition duration-150 ${
                  selectedUser?.id === user.id ? "bg-indigo-50 text-indigo-600" : ""
                }`}
              >
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-500 font-semibold mr-3">
                    {user.first_name.charAt(0)}{user.last_name.charAt(0)}
                  </div>
                  <span>{user.first_name} {user.last_name}</span>
                </div>
              </li>
            ))}
        </ul>
      </div>
      <div className="flex-1 flex flex-col">
        {selectedUser ? (
          <>
            <div className="p-4 border-b flex items-center justify-between bg-white shadow-sm">
              <div>
                <h2 className="text-xl font-bold font-mono text-gray-800">
                  {selectedUser.first_name} {selectedUser.last_name}
                </h2>
                <p className="text-sm text-gray-500">
                  {connectionStatus === "connected" ? (
                    <span className="text-green-500">Online</span>
                  ) : (
                    <span className="text-red-500">Offline</span>
                  )}
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <button 
                  className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 transition"
                  onClick={() => toast.info("Audio call coming soon!")}
                >
                  <PhoneCall size={18} className="text-gray-700" />
                </button>
                <button 
                  className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-100 hover:bg-indigo-200 transition"
                  onClick={handleStartCall}
                >
                  <VideoIcon size={18} className="text-indigo-600" />
                </button>
              </div>
            </div>
            <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
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
                    className={`inline-block p-3 rounded-lg max-w-xs md:max-w-md ${
                      parseInt(msg.sender.id, 10) ===
                      parseInt(currentUser.id, 10)
                        ? "bg-indigo-500 text-white"
                        : "bg-white shadow-sm"
                    } ${msg.isOptimistic ? "opacity-70" : ""}`}
                  >
                    <p>{msg.message}</p>
                  </div>
                  <div className="text-xs text-gray-500 mt-1 mx-1">
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
                <div className="bg-white p-8 rounded-xl shadow-2xl text-center w-96 relative">
                  <div className="absolute top-4 right-4">
                    <button 
                      onClick={handleEndCall} 
                      className="text-gray-400 hover:text-gray-600 transition"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  
                  <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <VideoIcon size={40} className="text-indigo-600" />
                  </div>
                  
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">
                    Incoming Video Call
                  </h3>
                  <p className="text-gray-600 mb-8">
                    {callerName} is calling you
                  </p>
                  
                  <div className="flex justify-center space-x-4">
                    <button
                      onClick={handleEndCall}
                      className="flex items-center justify-center w-12 h-12 bg-red-500 text-white rounded-full hover:bg-red-600 transition shadow-md"
                    >
                      <X size={24} />
                    </button>
                    <button
                      onClick={handleAnswerCall}
                      className="flex items-center justify-center w-12 h-12 bg-green-500 text-white rounded-full hover:bg-green-600 transition shadow-md"
                    >
                      <Phone size={24} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Overlay for Call in Progress (Connecting/Calling) */}
            {isCalling && !inCall && (
              <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
                <div className="text-center">
                  <div className="w-24 h-24 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-6 animate-pulse">
                    <VideoIcon size={40} className="text-indigo-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-4">
                    {callStatus}
                  </h3>
                  <p className="text-gray-300 mb-8">
                    {selectedUser?.first_name} {selectedUser?.last_name}
                  </p>
                  <button
                    onClick={handleEndCall}
                    className="flex items-center justify-center w-16 h-16 bg-red-500 text-white rounded-full mx-auto hover:bg-red-600 transition shadow-lg"
                  >
                    <X size={32} />
                  </button>
                </div>
              </div>
            )}

           {/* Overlay for Active Call (after acceptance) */}
{inCall && (
  <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50">
    <div className="relative w-full max-w-4xl h-full max-h-[80vh] p-4">
      {/* Remote Video (Large) */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover rounded-lg"
      />
      
     
      
      {/* Call Controls */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
        <button
          onClick={toggleMicrophone}
          className={`flex items-center justify-center w-12 h-12 rounded-full shadow-lg transition ${
            audioMuted ? "bg-red-500" : "bg-gray-700 hover:bg-gray-600"
          }`}
        >
          {audioMuted ? <MicOff size={20} className="text-white" /> : <Mic size={20} className="text-white" />}
        </button>
        
        <button
          onClick={toggleVideo}
          className={`flex items-center justify-center w-12 h-12 rounded-full shadow-lg transition ${
            videoMuted ? "bg-red-500" : "bg-gray-700 hover:bg-gray-600"
          }`}
        >
          {videoMuted ? <VideoOff size={20} className="text-white" /> : <Video size={20} className="text-white" />}
        </button>
        
        <button
          onClick={handleEndCall}
          className="flex items-center justify-center w-12 h-12 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition"
        >
          <Phone size={20} className="transform rotate-135" />
        </button>
      </div>
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