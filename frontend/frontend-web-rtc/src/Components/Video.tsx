import { useEffect, useRef, useState } from "react"

export default function Video() {
    const localRef = useRef<HTMLVideoElement>(null);
    const remoteRef = useRef<HTMLVideoElement>(null);
    const socket = useRef<WebSocket | null>(null);
    const peerConnection = useRef<RTCPeerConnection | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [targetId, setTargetId] = useState<string>("");
    const [clientId, setClientId] = useState<string>("");

    useEffect(() => {
        socket.current = new WebSocket("ws://localhost:8080");
        socket.current.onopen = () => {
            console.log("Connected to server");
            const id = Math.random().toString(36).substring(2, 9);
            setClientId(id);
            socket.current?.send(JSON.stringify({ type: "register", id }));
        }

        socket.current.onmessage = async (message) => {
            const data = JSON.parse(message.data);
            console.log("Received message:", data);

            if (data.type === "createOffer") {
                // CRITICAL FIX: Extract the sender's ID from the message
                const callerId = data.senderId;
                console.log("Received offer from:", callerId);

                if (!callerId) {
                    console.error("Received offer without sender ID");
                    return;
                }

                await peerConnection.current?.setRemoteDescription(new RTCSessionDescription(data.sdp));
                const answer = await peerConnection.current?.createAnswer();
                await peerConnection.current?.setLocalDescription(answer);

                // Use the caller's ID as the target when sending back the answer
                socket.current?.send(JSON.stringify({
                    type: "createAnswer",
                    sdp: answer,
                    targetId: callerId, // THIS IS THE KEY FIX
                    senderId: clientId
                }));

                // Set this person as our target for ICE candidates
                setTargetId(callerId);
                setIsConnected(true);
            }

            if (data.type === "createAnswer") {
                await peerConnection.current?.setRemoteDescription(new RTCSessionDescription(data.sdp));
                setIsConnected(true);
            }

            if (data.type === "iceCandidate") {
                await peerConnection.current?.addIceCandidate(new RTCIceCandidate(data.candidate));
            }
        }

        return () => socket.current?.close();
    }, []);

    useEffect(() => {
        async function StartPeerConnection() {
            peerConnection.current = new RTCPeerConnection({
                iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
            });

            peerConnection.current.onicecandidate = (event) => {
                if (event.candidate && targetId) {
                    console.log("Sending ICE candidate to:", targetId);

                    socket.current?.send(JSON.stringify({
                        type: "iceCandidate",
                        candidate: event.candidate,
                        targetId: targetId,  // Using the current targetId
                        senderId: clientId
                    }));
                }
            }

            peerConnection.current.ontrack = (event) => {
                if (remoteRef.current) {
                    remoteRef.current.srcObject = event.streams[0];
                }
            }

            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                if (localRef.current) {
                    localRef.current.srcObject = stream;
                }
                stream.getTracks().forEach(track => peerConnection.current?.addTrack(track, stream));
            } catch (error) {
                console.error("Error accessing media devices:", error);
            }
        }

        StartPeerConnection();
    }, [clientId, targetId]); // Added dependencies

    async function startCall() {
        if (!targetId || !socket.current || !peerConnection.current) {
            alert("Enter targetId to call");
            return;
        }

        try {
            const offer = await peerConnection.current.createOffer();
            await peerConnection.current.setLocalDescription(offer);

            //we're sending both our ID and the target ID
            socket.current.send(JSON.stringify({
                type: "createOffer",
                sdp: offer,
                targetId: targetId,
                senderId: clientId
            }));

            console.log("Sending offer to:", targetId, "from:", clientId);
        } catch (error) {
            console.error("Error creating offer:", error);
        }
    }

    return (
        <div className="flex flex-col items-center gap-4 p-4">
            <h1 className="text-2xl font-bold">WebRTC Video Chat</h1>
            <div className="flex flex-col gap-4">
                <p className="text-xl">Your ID: <span className="font-bold text-2xl">{clientId}</span></p>
                <input
                    type="text"
                    placeholder="Enter TargetId to call"
                    onChange={(e) => setTargetId(e.target.value)}
                    className="border-2 border-gray-800 p-2"
                />
            </div>
            <div className="flex gap-4">
                <video ref={localRef} autoPlay playsInline muted className="w-1/2 h-1/2 border-2 border-gray-800"></video>
                <video ref={remoteRef} autoPlay playsInline className="w-1/2 h-1/2 border-2 border-gray-800"></video>
            </div>
            <button
                className="bg-blue-500 text-white px-4 py-2 rounded mt-4"
                onClick={startCall}
                disabled={isConnected}>
                {isConnected ? "Connected" : "Start Call"}
            </button>
        </div>
    )
}