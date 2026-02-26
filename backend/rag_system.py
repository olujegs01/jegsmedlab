"""
RAG system using ChromaDB for semantic retrieval of medical knowledge.
Provides context-aware, evidence-based responses for lab interpretation.
"""

import chromadb
from chromadb.utils import embedding_functions
import os
from knowledge_base import get_all_documents
import logging

logger = logging.getLogger(__name__)

CHROMA_PATH = os.getenv("CHROMA_DB_PATH", "./chroma_db")
COLLECTION_NAME = "medical_knowledge"


class RAGSystem:
    def __init__(self):
        self.client = chromadb.PersistentClient(path=CHROMA_PATH)
        # Use ChromaDB's default embedding function (all-MiniLM-L6-v2)
        self.ef = embedding_functions.DefaultEmbeddingFunction()
        self.collection = self._get_or_create_collection()

    def _get_or_create_collection(self):
        """Get existing collection or create and populate it."""
        try:
            collection = self.client.get_collection(
                name=COLLECTION_NAME,
                embedding_function=self.ef,
            )
            count = collection.count()
            logger.info(f"Loaded existing collection with {count} documents")
            if count == 0:
                self._populate_collection(collection)
            return collection
        except Exception:
            collection = self.client.create_collection(
                name=COLLECTION_NAME,
                embedding_function=self.ef,
                metadata={"hnsw:space": "cosine"},
            )
            self._populate_collection(collection)
            return collection

    def _populate_collection(self, collection):
        """Seed the collection with medical knowledge base."""
        docs, ids, metadatas = get_all_documents()
        # Add in batches to avoid memory issues
        batch_size = 50
        for i in range(0, len(docs), batch_size):
            collection.add(
                documents=docs[i:i + batch_size],
                ids=ids[i:i + batch_size],
                metadatas=metadatas[i:i + batch_size],
            )
        logger.info(f"Populated collection with {len(docs)} medical knowledge documents")

    def retrieve(self, query: str, n_results: int = 5, category_filter: str = None) -> str:
        """
        Retrieve the most relevant medical knowledge for a query.
        Returns a formatted context string for use in AI prompts.
        """
        where = {"category": category_filter} if category_filter else None

        results = self.collection.query(
            query_texts=[query],
            n_results=n_results,
            where=where,
        )

        if not results["documents"] or not results["documents"][0]:
            return "No specific medical reference found."

        context_parts = []
        for i, doc in enumerate(results["documents"][0]):
            distance = results["distances"][0][i] if results.get("distances") else None
            relevance = f" (relevance: {(1 - distance):.0%})" if distance is not None else ""
            context_parts.append(f"[Reference {i+1}{relevance}]\n{doc}")

        return "\n\n".join(context_parts)

    def retrieve_for_labs(self, test_names: list[str]) -> str:
        """Retrieve knowledge for specific lab test names."""
        query = "lab test reference range interpretation " + " ".join(test_names)
        return self.retrieve(query, n_results=min(len(test_names) + 3, 10))

    def retrieve_for_symptoms(self, symptoms: list[str]) -> str:
        """Retrieve knowledge relevant to reported symptoms."""
        query = "symptoms " + " ".join(symptoms) + " diagnosis blood test"
        return self.retrieve(query, n_results=6)
