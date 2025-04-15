export let peerConnection = null;
let localStream = null;

const iceServers = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        { urls: "stun:stun4.l.google.com:19302" }
    ]
};

// Initialize media stream and return it
export const getLocalStream = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640, max: 1280 },
                height: { ideal: 480, max: 720 },
                frameRate: { max: 30 }
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true
            }
        });
        localStream = stream;
        return stream;
    } catch (error) {
        console.error("Error accessing media devices:", error);
        if (error.name === "NotAllowedError") {
            throw new Error("Camera or microphone access was denied. Please grant permission and try again.");
        }
        throw error;
    }
};

// Initialize a new RTCPeerConnection
export const createPeerConnection = () => {
    if (peerConnection) {
        peerConnection.close();
    }
    peerConnection = new RTCPeerConnection(iceServers);
    console.log("New peer connection created");
    return peerConnection;
};

// Add all tracks from a stream to the peer connection
export const addTracksToConnection = (connection, stream) => {
    if (!stream) {
        console.error("Cannot add tracks - stream is null");
        return;
    }
    
    try {
        stream.getTracks().forEach((track) => {
            console.log(`Adding ${track.kind} track to connection`);
            connection.addTrack(track, stream);
        });
        console.log("All tracks added to connection");
    } catch (error) {
        console.error("Error adding tracks to connection:", error);
    }
};

// Set up event handlers for the peer connection
export const setupPeerConnectionEventHandlers = (pc, socket, otherUser, remoteVideoRef, setConnectionQuality) => {
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            console.log("Generated ICE candidate for", otherUser);
            socket.send(
                JSON.stringify({
                    type: "ICEcandidate",
                    data: {
                        user: otherUser,
                        rtcMessage: event.candidate,
                    },
                })
            );
        }
    };

    pc.onconnectionstatechange = () => {
        console.log("Connection state changed to:", pc.connectionState);
        if (pc.connectionState === "connected") {
            setConnectionQuality("good");
        } else if (pc.connectionState === "disconnected") {
            setConnectionQuality("poor");
        }
    };

    // Modified track handler to ensure streams display properly
    pc.ontrack = (event) => {
        console.log("Received remote track", event.streams[0]);
        if (remoteVideoRef && remoteVideoRef.current) {
            // Ensure the stream is set regardless of previous content
            remoteVideoRef.current.srcObject = null;
            remoteVideoRef.current.srcObject = event.streams[0];
            
            // Force the video to play after setting the source
            remoteVideoRef.current.play().catch(err => {
                console.error("Error playing remote video:", err);
            });
            
            console.log("Remote video source object set and playing");
        } else {
            console.error("Remote video ref is not available");
        }
    };

    pc.oniceconnectionstatechange = () => {
        console.log("ICE connection state changed to:", pc.iceConnectionState);
        if (pc.iceConnectionState === "failed") {
            console.warn("ICE connection failed - attempting to restart ICE");
            // Restart ICE
            pc.restartIce();
        }
    };

    pc.onsignalingstatechange = () => {
        console.log("Signaling state changed to:", pc.signalingState);
    };
};


// Initiate a call to another user
export const initiateCall = async (socket, receiverName, localVideoRef, remoteVideoRef) => {
    try {
        console.log(`Initiating call to ${receiverName}`);
        const stream = await getLocalStream();
        
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
            console.log("Local video source set for caller");
        }
        
        const pc = createPeerConnection();
        addTracksToConnection(pc, stream);
        setupPeerConnectionEventHandlers(pc, socket, receiverName, remoteVideoRef);

        const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
        });
        console.log("Created offer:", offer);
        await pc.setLocalDescription(offer);

        socket.send(
            JSON.stringify({
                type: "call",
                data: {
                    name: receiverName,
                    rtcMessage: pc.localDescription,
                },
            })
        );
        console.log(`Offer sent to ${receiverName}`);
    } catch (error) {
        console.error("Error initiating call:", error);
        throw error;
    }
};

// Set up WebRTC for receiving a call (triggered upon Accept)
export const setupWebRTC = async (localVideoRef, remoteVideoRef, socket, rtcMessage, caller) => {
    try {
        console.log("Setting up WebRTC with stored offer:", rtcMessage);
        const stream = await getLocalStream();
        console.log("Local stream obtained for receiver:", stream);
        
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
            console.log("Local video source set for receiver");
        } else {
            console.error("Local video ref is not available");
        }

        const pc = createPeerConnection();
        addTracksToConnection(pc, stream);
        setupPeerConnectionEventHandlers(pc, socket, caller, remoteVideoRef);

        await pc.setRemoteDescription(new RTCSessionDescription(rtcMessage));
        console.log("Remote description set from offer");
        
        return pc;
    } catch (error) {
        console.error("Error setting up WebRTC:", error);
        throw error;
    }
};

// Answer an incoming call
export const answerCall = async (socket, callerName, localVideoRef, remoteVideoRef) => {
    try {
        console.log(`Answering call from ${callerName}`);
        
        if (!peerConnection || peerConnection.connectionState === "closed") {
            console.error("No peer connection available when trying to answer call");
            return;
        }

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        console.log("Created answer:", answer);

        socket.send(
            JSON.stringify({
                type: "answer_call",
                data: {
                    caller: callerName,
                    rtcMessage: peerConnection.localDescription,
                },
            })
        );
        console.log(`Answer sent to ${callerName}`);
    } catch (error) {
        console.error("Error answering call:", error);
        throw error;
    }
};

// Process an ICE candidate received from the other peer
export const handleICECandidate = async (rtcMessage) => {
    try {
        if (peerConnection && rtcMessage) {
            console.log("Adding received ICE candidate:", rtcMessage);
            await peerConnection.addIceCandidate(new RTCIceCandidate(rtcMessage));
            console.log("ICE candidate added successfully");
        } else {
            console.warn("Cannot add ICE candidate - peer connection not initialized");
        }
    } catch (error) {
        console.error("Error adding ICE candidate:", error);
    }
};

// End a call and clean up resources
export const endCall = (socket, localVideoRef, remoteVideoRef) => {
    console.log("Ending call and cleaning up resources");
    if (localStream) {
        localStream.getTracks().forEach((track) => {
            track.stop();
            console.log(`Stopped ${track.kind} track`);
        });
        localStream = null;
    }
    
    if (localVideoRef && localVideoRef.current) {
        localVideoRef.current.srcObject = null;
        console.log("Cleared local video source");
    }
    
    if (remoteVideoRef && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
        console.log("Cleared remote video source");
    }
    
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
        console.log("Closed peer connection");
    }
};