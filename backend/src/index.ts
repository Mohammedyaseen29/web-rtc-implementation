import {WebSocketServer,WebSocket} from "ws";


const wss = new WebSocketServer({port:8080});

const client = new Map<string,WebSocket>();

wss.on("connection",(ws)=>{
    console.log("Client connected");
    ws.on("error",(err)=>{
        console.log(err);
    })
    ws.on("message", (data:any)=>{
        try {
            const message = JSON.parse(data);
            const { type, id, sdp, targetId, candidate } = message;
            if(type === "register"){
                client.set(id,ws);
                console.log("Client registered with id: ", id);
            }
            else if( type === "createOffer" || type === "createAnswer" || type === "iceCandidate"){
                const target = client.get(targetId);
                if(!target){
                    console.log(`Target not found with id: ${targetId}`);
                    return;
                }
                target.send(JSON.stringify({type,sdp, candidate}));
            }    
        } catch (error) {
            console.log(error);
        }

    })
    ws.on("close",()=>{
        for(let [key,socket] of client.entries()){
            if(socket === ws){
                client.delete(key);
                console.log("Client disconnected with id: ", key);
                break;
            }   
        }
    })

    ws.send("Hello from server");
})