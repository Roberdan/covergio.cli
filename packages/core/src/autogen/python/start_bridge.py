#!/usr/bin/env python3
"""
Start AutoGen Bridge Server

This script starts the AutoGen Python bridge server with proper configuration
and error handling.
"""

import os
import sys
import signal
import asyncio
import logging
from pathlib import Path

# Add the current directory to Python path
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def check_dependencies():
    """Check if required dependencies are installed"""
    required_packages = [
        'pyautogen',
        'fastapi',
        'uvicorn', 
        'websockets',
        'pydantic'
    ]
    
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package.replace('-', '_'))
        except ImportError:
            missing_packages.append(package)
    
    if missing_packages:
        logger.error(f"Missing required packages: {', '.join(missing_packages)}")
        logger.error("Please install them using:")
        logger.error(f"pip install {' '.join(missing_packages)}")
        return False
    
    return True

def setup_environment():
    """Setup environment variables"""
    # Default configuration
    env_vars = {
        'AUTOGEN_BRIDGE_HOST': '0.0.0.0',
        'AUTOGEN_BRIDGE_PORT': '8765',
        'AUTOGEN_HTTP_PORT': '8766',
        'OPENAI_API_KEY': '',
        'ANTHROPIC_API_KEY': '',
        'GOOGLE_API_KEY': ''
    }
    
    # Load from .env file if it exists
    env_file = current_dir / '.env'
    if env_file.exists():
        logger.info(f"Loading environment from {env_file}")
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    key, value = line.split('=', 1)
                    env_vars[key] = value
    
    # Set environment variables
    for key, value in env_vars.items():
        if key not in os.environ:
            os.environ[key] = value
    
    # Check for API keys
    api_keys = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_API_KEY']
    has_api_key = any(os.getenv(key) for key in api_keys)
    
    if not has_api_key:
        logger.warning("No API keys found. Please set at least one of:")
        for key in api_keys:
            logger.warning(f"  {key}")
        logger.warning("The bridge will start but agents may not function without proper API keys.")

async def start_server():
    """Start the AutoGen bridge server"""
    try:
        # Import here to ensure dependencies are checked first
        from autogen_bridge import main
        
        logger.info("Starting AutoGen Bridge Server...")
        logger.info(f"Host: {os.getenv('AUTOGEN_BRIDGE_HOST')}")
        logger.info(f"WebSocket Port: {os.getenv('AUTOGEN_BRIDGE_PORT')}")
        logger.info(f"HTTP Port: {os.getenv('AUTOGEN_HTTP_PORT')}")
        
        await main()
        
    except KeyboardInterrupt:
        logger.info("Received shutdown signal")
    except Exception as e:
        logger.error(f"Server error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

def handle_signal(signum, frame):
    """Handle shutdown signals"""
    logger.info(f"Received signal {signum}")
    sys.exit(0)

def main():
    """Main entry point"""
    # Setup signal handlers
    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)
    
    # Check dependencies
    if not check_dependencies():
        sys.exit(1)
    
    # Setup environment
    setup_environment()
    
    # Start server
    try:
        asyncio.run(start_server())
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
    except Exception as e:
        logger.error(f"Failed to start server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()