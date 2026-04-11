import os
from langchain_openai import ChatOpenAI
from tools import get_agricultural_tools
from dotenv import load_dotenv
from langgraph.prebuilt import create_react_agent

load_dotenv()

def create_chat_agent(auth_token: str):
    # Initialize the OpenAI model.
    llm = ChatOpenAI(model="gpt-3.5-turbo", temperature=0.2)
    
    tools = get_agricultural_tools(auth_token=auth_token)

    system_prompt = """You are an expert AI agricultural assistant designed to help farmers manage their crops.
You have access to tools that can fetch:
- Basic crop details like name, type, and sowing date for a given crop ID
- Fertilizer application history for a given crop ID
- Irrigation history for a given crop ID
- Historical weather data for the farm's location (requires latitude, longitude, and dates in YYYY-MM-DD format)

Use these tools to gather information contextually when the user asks questions about their farm.
Provide insights and actionable recommendations based on the retrieved data and your vast agricultural knowledge.
If you need a crop ID or specific dates to use a tool, you should infer them from the context if possible, or gracefully inform the user what necessary details are missing."""
    
    agent_executor = create_react_agent(
        model=llm,
        tools=tools,
        prompt=system_prompt
    )
    
    return agent_executor
