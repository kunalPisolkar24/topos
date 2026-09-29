"""gRPC service composition root.

AIService combines one mixin per bounded context (see src.application)
over shared constructor state. Transport-only: validation, metrics, and
error mapping live in the application layer's support module.
"""

from src.application.chat import ChatMixin
from src.application.generation import GenerationMixin
from src.application.post_workflow import PostWorkflowMixin
from src.application.profiles import ProfilesMixin
from src.application.search import SearchMixin
from src.embeddings import EmbeddingProvider
from src.generated import ai_service_pb2_grpc
from src.graphs.chat_graph import ChatGraphs
from src.graphs.feed_graph import FeedAgent
from src.llm import LLMProvider
from src.vector import SearchStore


class AIService(
    GenerationMixin,
    PostWorkflowMixin,
    SearchMixin,
    ProfilesMixin,
    ChatMixin,
    ai_service_pb2_grpc.AIServiceServicer,
):
    def __init__(
        self,
        llm: LLMProvider,
        search: SearchStore,
        embeddings: EmbeddingProvider,
        chat_graphs: ChatGraphs | None = None,
        post_generation_graph=None,
        feed_agent: FeedAgent | None = None,
    ) -> None:
        self._llm = llm
        self._search = search
        self._embeddings = embeddings
        self._chat_graphs = chat_graphs
        self._post_generation_graph = post_generation_graph
        self._feed_agent = feed_agent
