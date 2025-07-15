#!/usr/bin/env python3
"""
AutoGen Python Bridge Server

This server provides a WebSocket and HTTP API bridge between
TypeScript code and the Python AutoGen framework.
"""

import asyncio
import json
import logging
import os
import traceback
from typing import Dict, List, Any, Optional, Union
from dataclasses import dataclass, asdict
from datetime import datetime

import websockets
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from pydantic import BaseModel, Field

# AutoGen imports
try:
    import autogen
    from autogen import ConversableAgent, GroupChat, GroupChatManager
    from autogen.agentchat.contrib.capabilities import Teachability
    from autogen.coding import LocalCommandLineCodeExecutor
except ImportError as e:
    print(f"Error importing AutoGen: {e}")
    print("Please install AutoGen: pip install pyautogen")
    exit(1)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
BRIDGE_HOST = os.getenv("AUTOGEN_BRIDGE_HOST", "localhost")
BRIDGE_PORT = int(os.getenv("AUTOGEN_BRIDGE_PORT", "8765"))
HTTP_PORT = int(os.getenv("AUTOGEN_HTTP_PORT", "8766"))

class AgentConfig(BaseModel):
    """Agent configuration model"""
    name: str
    role: str = Field(default="assistant")
    system_message: str
    llm_config: Dict[str, Any]
    max_consecutive_auto_reply: int = Field(default=10)
    human_input_mode: str = Field(default="NEVER")
    code_execution_config: Optional[Dict[str, Any]] = None
    description: Optional[str] = None
    tools: Optional[List[Dict[str, Any]]] = None

class ConversationMessage(BaseModel):
    """Conversation message model"""
    role: str
    content: str
    name: Optional[str] = None
    timestamp: str
    agent_id: str

class GroupChatConfig(BaseModel):
    """Group chat configuration model"""
    agents: List[str]  # Agent names
    max_round: int = Field(default=10)
    admin_name: str = Field(default="Admin")
    speaker_selection_method: str = Field(default="auto")
    allow_repeat_speaker: bool = Field(default=True)

class AutoGenBridge:
    """Main bridge class for AutoGen integration"""
    
    def __init__(self):
        self.agents: Dict[str, ConversableAgent] = {}
        self.group_chats: Dict[str, GroupChat] = {}
        self.group_managers: Dict[str, GroupChatManager] = {}
        self.active_connections: Dict[str, WebSocket] = {}
        
        # Initialize FastAPI app
        self.app = FastAPI(title="AutoGen Bridge", version="1.0.0")
        self.setup_routes()
        self.setup_cors()
    
    def setup_cors(self):
        """Setup CORS middleware"""
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
    
    def setup_routes(self):
        """Setup HTTP API routes"""
        
        @self.app.post("/agents/create")
        async def create_agent(config: AgentConfig):
            """Create a new AutoGen agent"""
            try:
                agent = self.create_agent_internal(config.dict())
                return {
                    "success": True,
                    "agent_name": config.name,
                    "message": f"Agent {config.name} created successfully"
                }
            except Exception as e:
                logger.error(f"Error creating agent: {e}")
                raise HTTPException(status_code=500, detail=str(e))
        
        @self.app.get("/agents")
        async def list_agents():
            """List all created agents"""
            return {
                "agents": [
                    {
                        "name": name,
                        "role": getattr(agent, 'role', 'unknown'),
                        "description": getattr(agent, 'description', '')
                    }
                    for name, agent in self.agents.items()
                ]
            }
        
        @self.app.delete("/agents/{agent_name}")
        async def delete_agent(agent_name: str):
            """Delete an agent"""
            if agent_name in self.agents:
                del self.agents[agent_name]
                return {"success": True, "message": f"Agent {agent_name} deleted"}
            raise HTTPException(status_code=404, detail="Agent not found")
        
        @self.app.post("/conversations/start")
        async def start_conversation(data: Dict[str, Any]):
            """Start a conversation between agents"""
            try:
                result = await self.start_conversation_internal(data)
                return {"success": True, "conversation": result}
            except Exception as e:
                logger.error(f"Error starting conversation: {e}")
                raise HTTPException(status_code=500, detail=str(e))
        
        @self.app.post("/groupchats/create")
        async def create_group_chat(config: GroupChatConfig):
            """Create a group chat"""
            try:
                chat_id = await self.create_group_chat_internal(config.dict())
                return {
                    "success": True,
                    "chat_id": chat_id,
                    "message": "Group chat created successfully"
                }
            except Exception as e:
                logger.error(f"Error creating group chat: {e}")
                raise HTTPException(status_code=500, detail=str(e))
        
        @self.app.websocket("/ws/{client_id}")
        async def websocket_endpoint(websocket: WebSocket, client_id: str):
            """WebSocket endpoint for real-time communication"""
            await self.handle_websocket_connection(websocket, client_id)
    
    def create_agent_internal(self, config: Dict[str, Any]) -> ConversableAgent:
        """Create an AutoGen agent from configuration"""
        try:
            # Extract configuration
            name = config["name"]
            system_message = config["system_message"]
            llm_config = config["llm_config"]
            
            # Create the agent
            agent = ConversableAgent(
                name=name,
                system_message=system_message,
                llm_config=llm_config,
                max_consecutive_auto_reply=config.get("max_consecutive_auto_reply", 10),
                human_input_mode=config.get("human_input_mode", "NEVER"),
                code_execution_config=config.get("code_execution_config")
            )
            
            # Add role and description as attributes
            agent.role = config.get("role", "assistant")
            agent.description = config.get("description", "")
            
            # Add tools if provided
            if config.get("tools"):
                self.register_tools(agent, config["tools"])
            
            # Store the agent
            self.agents[name] = agent
            
            logger.info(f"Created agent: {name}")
            return agent
            
        except Exception as e:
            logger.error(f"Error creating agent: {e}")
            raise
    
    def register_tools(self, agent: ConversableAgent, tools: List[Dict[str, Any]]):
        """Register tools for an agent"""
        for tool in tools:
            try:
                # This is a simplified tool registration
                # In a full implementation, tools would be properly registered
                logger.info(f"Registering tool: {tool['function']['name']}")
            except Exception as e:
                logger.error(f"Error registering tool: {e}")
    
    async def start_conversation_internal(self, data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Start a conversation between two agents"""
        try:
            initiator_name = data["initiator"]
            recipient_name = data["recipient"] 
            message = data["message"]
            max_turns = data.get("max_turns", 10)
            
            if initiator_name not in self.agents:
                raise ValueError(f"Initiator agent {initiator_name} not found")
            
            if recipient_name not in self.agents:
                raise ValueError(f"Recipient agent {recipient_name} not found")
            
            initiator = self.agents[initiator_name]
            recipient = self.agents[recipient_name]
            
            # Start the conversation
            chat_result = initiator.initiate_chat(
                recipient=recipient,
                message=message,
                max_turns=max_turns
            )
            
            # Convert chat history to our format
            conversation = []
            if hasattr(chat_result, 'chat_history'):
                for msg in chat_result.chat_history:
                    conversation.append({
                        "role": msg.get("role", "unknown"),
                        "content": msg.get("content", ""),
                        "name": msg.get("name", ""),
                        "timestamp": datetime.now().isoformat(),
                        "agent_id": msg.get("name", "")
                    })
            
            return conversation
            
        except Exception as e:
            logger.error(f"Error in conversation: {e}")
            raise
    
    async def create_group_chat_internal(self, config: Dict[str, Any]) -> str:
        """Create a group chat"""
        try:
            agent_names = config["agents"]
            chat_agents = []
            
            for name in agent_names:
                if name not in self.agents:
                    raise ValueError(f"Agent {name} not found")
                chat_agents.append(self.agents[name])
            
            # Create group chat
            group_chat = GroupChat(
                agents=chat_agents,
                messages=[],
                max_round=config.get("max_round", 10),
                speaker_selection_method=config.get("speaker_selection_method", "auto"),
                allow_repeat_speaker=config.get("allow_repeat_speaker", True)
            )
            
            # Create group chat manager
            manager = GroupChatManager(groupchat=group_chat)
            
            # Generate unique ID for the chat
            chat_id = f"chat_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            
            # Store the group chat and manager
            self.group_chats[chat_id] = group_chat
            self.group_managers[chat_id] = manager
            
            logger.info(f"Created group chat: {chat_id}")
            return chat_id
            
        except Exception as e:
            logger.error(f"Error creating group chat: {e}")
            raise
    
    async def handle_websocket_connection(self, websocket: WebSocket, client_id: str):
        """Handle WebSocket connection for real-time communication"""
        await websocket.accept()
        self.active_connections[client_id] = websocket
        
        try:
            logger.info(f"WebSocket client {client_id} connected")
            
            while True:
                # Receive message from client
                data = await websocket.receive_text()
                message = json.loads(data)
                
                # Process the message
                response = await self.process_websocket_message(message)
                
                # Send response back to client
                await websocket.send_text(json.dumps(response))
                
        except WebSocketDisconnect:
            logger.info(f"WebSocket client {client_id} disconnected")
        except Exception as e:
            logger.error(f"WebSocket error for client {client_id}: {e}")
        finally:
            if client_id in self.active_connections:
                del self.active_connections[client_id]
    
    async def process_websocket_message(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """Process incoming WebSocket message"""
        try:
            message_type = message.get("type")
            
            if message_type == "create_agent":
                config = AgentConfig(**message["data"])
                agent = self.create_agent_internal(config.dict())
                return {
                    "type": "agent_created",
                    "success": True,
                    "data": {"agent_name": config.name}
                }
            
            elif message_type == "start_conversation":
                result = await self.start_conversation_internal(message["data"])
                return {
                    "type": "conversation_result",
                    "success": True,
                    "data": {"conversation": result}
                }
            
            elif message_type == "list_agents":
                agents = [
                    {
                        "name": name,
                        "role": getattr(agent, 'role', 'unknown'),
                        "description": getattr(agent, 'description', '')
                    }
                    for name, agent in self.agents.items()
                ]
                return {
                    "type": "agents_list",
                    "success": True,
                    "data": {"agents": agents}
                }
            
            else:
                return {
                    "type": "error",
                    "success": False,
                    "error": f"Unknown message type: {message_type}"
                }
                
        except Exception as e:
            logger.error(f"Error processing WebSocket message: {e}")
            return {
                "type": "error", 
                "success": False,
                "error": str(e),
                "traceback": traceback.format_exc()
            }
    
    async def broadcast_to_clients(self, message: Dict[str, Any]):
        """Broadcast message to all connected clients"""
        if not self.active_connections:
            return
        
        message_text = json.dumps(message)
        disconnected_clients = []
        
        for client_id, websocket in self.active_connections.items():
            try:
                await websocket.send_text(message_text)
            except Exception as e:
                logger.error(f"Error sending to client {client_id}: {e}")
                disconnected_clients.append(client_id)
        
        # Remove disconnected clients
        for client_id in disconnected_clients:
            del self.active_connections[client_id]

# Global bridge instance
bridge = AutoGenBridge()

async def start_websocket_server():
    """Start the WebSocket server"""
    logger.info(f"Starting WebSocket server on {BRIDGE_HOST}:{BRIDGE_PORT}")
    
    async def handle_client(websocket, path):
        client_id = f"client_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}"
        await bridge.handle_websocket_connection(websocket, client_id)
    
    start_server = websockets.serve(handle_client, BRIDGE_HOST, BRIDGE_PORT)
    await start_server

def start_http_server():
    """Start the HTTP API server"""
    logger.info(f"Starting HTTP server on {BRIDGE_HOST}:{HTTP_PORT}")
    uvicorn.run(
        bridge.app,
        host=BRIDGE_HOST,
        port=HTTP_PORT,
        log_level="info"
    )

async def main():
    """Main entry point"""
    logger.info("Starting AutoGen Bridge Server")
    logger.info(f"WebSocket: ws://{BRIDGE_HOST}:{BRIDGE_PORT}")
    logger.info(f"HTTP API: http://{BRIDGE_HOST}:{HTTP_PORT}")
    
    # Start both servers concurrently
    await asyncio.gather(
        start_websocket_server(),
        asyncio.create_task(asyncio.to_thread(start_http_server))
    )

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Bridge server stopped by user")
    except Exception as e:
        logger.error(f"Bridge server error: {e}")
        traceback.print_exc()