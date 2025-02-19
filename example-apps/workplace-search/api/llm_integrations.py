from langchain.chat_models import ChatOpenAI, ChatVertexAI, AzureChatOpenAI, BedrockChat
import os
import google.auth
import boto3

LLM_TYPE = os.getenv("LLM_TYPE", "openai")

def init_openai_chat():
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    return ChatOpenAI(openai_api_key=OPENAI_API_KEY, streaming=True, temperature=0.2)
def init_vertex_chat():
    VERTEX_PROJECT_ID = os.getenv("VERTEX_PROJECT_ID")
    credentials, project = google.auth.default(project_id=VERTEX_PROJECT_ID)
    return ChatVertexAI(streaming=True, temperature=0.2)
def init_azure_chat():
    OPENAI_VERSION=os.getenv("OPENAI_VERSION", "2023-05-15")
    BASE_URL=os.getenv("OPENAI_BASE_URL")
    OPENAI_API_KEY=os.getenv("OPENAI_API_KEY")
    OPENAI_ENGINE=os.getenv("OPENAI_ENGINE")
    return AzureChatOpenAI(
        deployment_name=OPENAI_ENGINE,
        openai_api_base=BASE_URL,
        openai_api_version=OPENAI_VERSION,
        openai_api_key=OPENAI_API_KEY,
        streaming=True,
        temperature=0.2)
def init_bedrock():
    AWS_ACCESS_KEY=os.getenv("AWS_ACCESS_KEY")
    AWS_SECRET_KEY=os.getenv("AWS_SECRET_KEY")
    AWS_REGION=os.getenv("AWS_REGION")
    AWS_MODEL_ID=os.getenv("AWS_MODEL_ID", "anthropic.claude-v2")
    BEDROCK_CLIENT=boto3.client(service_name="bedrock-runtime", region_name=AWS_REGION, aws_access_key_id=AWS_ACCESS_KEY, aws_secret_access_key=AWS_SECRET_KEY)
    return BedrockChat(
        client=BEDROCK_CLIENT,
        model_id=AWS_MODEL_ID,
        streaming=True,
        model_kwargs={"temperature":0.2})

MAP_LLM_TYPE_TO_CHAT_MODEL = {
    "azure": init_azure_chat,
    "bedrock": init_bedrock,
    "openai": init_openai_chat,
#     "vertex": init_vertex_chat,
}

def get_llm():
    if not LLM_TYPE in MAP_LLM_TYPE_TO_CHAT_MODEL:
        raise Exception("LLM type not found. Please set LLM_TYPE to one of: " + ", ".join(MAP_LLM_TYPE_TO_CHAT_MODEL.keys()) + ".")

    return MAP_LLM_TYPE_TO_CHAT_MODEL[LLM_TYPE]()