// WebRTC.js - Fixed Implementation

// Global variables
export let peerConnection = null;
let localStream = null;

// Configure ICE servers for better connectivity
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
            video: { width: 640, height: 480 },
            audio: true
        });
        localStream = stream;
        return stream;
    } catch (error) {
        console.error("Error accessing media devices:", error);
        throw error;
    }
};

// Initialize a new RTCPeerConnection
export const createPeerConnection = () => {
    if (peerConnection) {
        peerConnection.close();
    }
    peerConnection = new RTCPeerConnection(iceServers);
    return peerConnection;
};

// Add all tracks from a stream to the peer connection
export const addTracksToConnection = (connection, stream) => {
    stream.getTracks().forEach((track) => connection.addTrack(track, stream));
};

// Set up event handlers for the peer connection
export const setupPeerConnectionEventHandlers = (pc, socket, otherUser, remoteVideoRef) => {
    // Handle ICE candidates
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

    // Handle incoming tracks
    pc.ontrack = (event) => {
        console.log("Received remote track", event.streams[0]);
        if (remoteVideoRef && remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
        }
    };

    pc.oniceconnectionstatechange = () => {
        console.log("ICE connection state changed to:", pc.iceConnectionState);
        if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
            console.warn("ICE connection failed or disconnected");
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
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
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

// Answer an incoming call
export const answerCall = async (socket, callerName, localVideoRef, remoteVideoRef) => {
    try {
        console.log(`Answering call from ${callerName}`);
        const stream = await getLocalStream();
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        if (!peerConnection || peerConnection.connectionState === "closed") {
            const pc = createPeerConnection();
            addTracksToConnection(pc, stream);
            setupPeerConnectionEventHandlers(pc, socket, callerName, remoteVideoRef);
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

// Set up WebRTC for receiving a call (triggered upon Accept)
export const setupWebRTC = async (localVideoRef, remoteVideoRef, socket, rtcMessage, caller) => {
    try {
        console.log("Setting up WebRTC with stored offer:", rtcMessage);
        const stream = await getLocalStream();
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        const pc = createPeerConnection();
        addTracksToConnection(pc, stream);
        setupPeerConnectionEventHandlers(pc, socket, caller, remoteVideoRef);

        await pc.setRemoteDescription(new RTCSessionDescription(rtcMessage));
        console.log("Remote description set from offer");
    } catch (error) {
        console.error("Error setting up WebRTC:", error);
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
    if (localVideoRef && localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef && remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
        console.log("Closed peer connection");
    }
};
