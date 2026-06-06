"""
Foundry IQ Client — Knowledge grounding layer for CertSense AI.
All agent recommendations are grounded through Foundry IQ to reduce hallucinations
and provide cited, authoritative Azure certification content.

Microsoft Foundry IQ Integration:
- Indexes: az_204, az_400, dp_203, security, study_patterns
- Knowledge sources: Microsoft Learn, Azure Architecture Center, Official Exam Study Guides
- Real-time retrieval for each agent's specific reasoning task
"""

import os
import asyncio
import aiohttp
from typing import List, Dict, Any, Optional
from datetime import datetime


class FoundryIQClient:
    """
    Foundry IQ Knowledge Grounding Client

    Provides retrieval-augmented context for all agents.
    Calls Microsoft Foundry IQ REST API for grounded knowledge retrieval.
    Falls back to curated KNOWLEDGE_BASE stubs if API is unavailable.
    """

    # Fallback knowledge base — used when API call fails
    KNOWLEDGE_BASE = {
        "AZ-204": {
            "frameworks": ["Azure App Service deployment slots", "Managed Identity + Key Vault pattern", "Event-driven architecture with Event Grid/Service Bus", "Azure API Management policy layers"],
            "best_practices": [
                "Use Managed Identity instead of connection strings — eliminates credential management",
                "Prefer Service Bus for guaranteed delivery; Event Grid for reactive event fan-out",
                "Deployment slots enable zero-downtime releases with swap + auto-swap triggers",
                "Store secrets in Key Vault and reference via App Service Key Vault references",
                "Use Azure Monitor + Application Insights for end-to-end distributed tracing"
            ],
            "sources": ["AZ-204 Official Exam Study Guide", "Microsoft Learn: Develop solutions for Microsoft Azure", "Azure Architecture Center"]
        },
        "AZ-400": {
            "frameworks": ["CI/CD pipeline stages: Build → Test → Release", "Shift-left testing strategy", "GitFlow vs trunk-based development", "Infrastructure as Code with Bicep/Terraform"],
            "best_practices": [
                "Gate releases with automated quality gates — coverage thresholds, security scans, performance benchmarks",
                "Use environment-specific variable groups and key vault references in pipelines",
                "Blue-green and canary deployments reduce blast radius of production releases",
                "Implement branch policies: require PR reviews, linked work items, and passing builds",
                "Monitor pipeline health with DORA metrics: deployment frequency, lead time, MTTR, change failure rate"
            ],
            "sources": ["AZ-400 Official Exam Study Guide", "Microsoft Learn: DevOps Engineer Expert", "Azure DevOps Documentation"]
        },
        "DP-203": {
            "frameworks": ["Lambda architecture: batch + speed + serving layers", "Medallion architecture: Bronze → Silver → Gold", "ELT vs ETL selection criteria", "Slowly Changing Dimensions (SCD) Types 1/2/3"],
            "best_practices": [
                "Partition large tables by date in Synapse dedicated pools to minimize data scanned",
                "Use Delta Lake format in Azure Databricks for ACID transactions on data lakes",
                "Choose ADLS Gen2 hierarchical namespace for fine-grained ACL control at folder level",
                "Optimize Synapse pipelines with parallel copy activities and staged copy for large datasets",
                "Stream Analytics windowing functions: tumbling, hopping, sliding — know when to use each"
            ],
            "sources": ["DP-203 Official Exam Study Guide", "Microsoft Learn: Azure Data Engineer Associate", "Azure Synapse Analytics Documentation"]
        },
        "security": {
            "frameworks": ["Zero Trust model", "Azure RBAC + Azure AD ABAC", "Defense in depth layers", "Microsoft Defender for Cloud recommendations"],
            "best_practices": [
                "Apply least-privilege RBAC — assign roles at resource group scope, not subscription",
                "Enable Microsoft Defender for Cloud and resolve high-severity recommendations before exam",
                "Use Private Endpoints to keep traffic off public internet for PaaS services",
                "Implement Conditional Access policies for identity-based access control",
                "Audit logs via Azure Monitor Diagnostic Settings → Log Analytics Workspace"
            ],
            "sources": ["Azure Security Benchmark", "Microsoft Learn: Security", "Azure AD Documentation"]
        },
        "study_patterns": {
            "frameworks": ["Spaced repetition for service limits and SKU differences", "Scenario-based practice over definition memorization", "Hands-on labs before attempting practice exams"],
            "best_practices": [
                "Do at least 200 practice questions before the exam — focus on scenario-based ones",
                "For each wrong answer, read the official Microsoft Learn module, not just the explanation",
                "Build the services you're studying — muscle memory reinforces conceptual understanding",
                "Focus on 'when to use X vs Y' questions — exams test decision-making, not recall",
                "Review exam skills outline weekly and self-rate confidence per topic area"
            ],
            "sources": ["Microsoft Certification Exam Policies", "MeasureUp Practice Tests", "Whizlabs AZ-204/AZ-400/DP-203"]
        }
    }

    def __init__(self):
        self.project_endpoint = os.getenv(
            "FOUNDRY_PROJECT_ENDPOINT",
            "https://CertSenseai-resource.services.ai.azure.com/api/projects/CertSenseai"
        )
        self.api_key = os.getenv("FOUNDRY_API_KEY", "")
        self.knowledge_base = os.getenv("FOUNDRY_KNOWLEDGE_BASE", "CertSense-kb")
        # Azure AI Search for session persistence
        self.search_endpoint = os.getenv(
            "AZURE_SEARCH_ENDPOINT",
            self.project_endpoint.rstrip("/") + "/search"
        )
        self._headers = {
            "Content-Type": "application/json",
            "api-key": self.api_key,
        }

    # ------------------------------------------------------------------ #
    #  Knowledge retrieval                                                 #
    # ------------------------------------------------------------------ #

    async def get_context(self, query: str, domains: List[str]) -> dict:
        """
        Retrieve grounding context from Foundry IQ knowledge base.

        Calls POST {FOUNDRY_PROJECT_ENDPOINT}/knowledge/search with the
        merged domain query. Falls back to KNOWLEDGE_BASE stubs on error.
        """
        domain_hint = " ".join(domains)
        enriched_query = f"{query} {domain_hint}".strip()

        try:
            url = f"{self.project_endpoint.rstrip('/')}/knowledge/search"
            payload = {
                "query": enriched_query,
                "knowledge_base": self.knowledge_base,
                "top": 5,
                "domains": domains,
            }

            async with aiohttp.ClientSession() as session:
                async with session.post(
                    url,
                    json=payload,
                    headers=self._headers,
                    timeout=aiohttp.ClientTimeout(total=10),
                ) as resp:
                    resp.raise_for_status()
                    data = await resp.json()

            # Normalise Foundry IQ response → internal schema
            context = {
                "query": query,
                "frameworks": [],
                "best_practices": [],
                "sources": [],
            }

            for hit in data.get("results", []):
                doc = hit.get("document", hit)  # handle flat or nested
                context["frameworks"].extend(doc.get("frameworks", []))
                context["best_practices"].extend(doc.get("best_practices", []))
                src = doc.get("source") or doc.get("citation") or doc.get("title")
                if src:
                    context["sources"].append(src)

            # Deduplicate and cap
            context["frameworks"] = list(dict.fromkeys(context["frameworks"]))[:4]
            context["best_practices"] = list(dict.fromkeys(context["best_practices"]))[:5]
            context["sources"] = list(dict.fromkeys(context["sources"]))[:4]

            # If the API returned nothing useful, fall through to stubs
            if not any([context["frameworks"], context["best_practices"]]):
                raise ValueError("Empty API response — using fallback")

            return context

        except Exception as exc:
            # Graceful fallback to in-process knowledge base
            return self._fallback_context(query, domains)

    def _fallback_context(self, query: str, domains: List[str]) -> dict:
        """Build context from the local KNOWLEDGE_BASE when the API is unavailable."""
        context = {
            "query": query,
            "frameworks": [],
            "best_practices": [],
            "sources": [],
        }
        for domain in domains:
            if domain in self.KNOWLEDGE_BASE:
                kb = self.KNOWLEDGE_BASE[domain]
                context["frameworks"].extend(kb.get("frameworks", [])[:2])
                context["best_practices"].extend(kb.get("best_practices", [])[:3])
                context["sources"].extend(kb.get("sources", [])[:2])

        context["frameworks"] = list(dict.fromkeys(context["frameworks"]))[:4]
        context["best_practices"] = list(dict.fromkeys(context["best_practices"]))[:5]
        context["sources"] = list(dict.fromkeys(context["sources"]))[:4]
        return context

    async def get_resources(self, topic: str, weakness_areas: List[str]) -> list:
        """Retrieve targeted learning resources for specific weakness areas."""
        resources = []

        kb = self.KNOWLEDGE_BASE.get(topic, {})

        for area in weakness_areas[:3]:
            area_lower = area.lower()
            if "storage" in area_lower or "blob" in area_lower:
                resources.append({
                    "title": "Azure Storage — Microsoft Learn",
                    "type": "module",
                    "url": "https://learn.microsoft.com/en-us/azure/storage/",
                    "relevance": "Blob, Queue, Table, File storage — SKUs, tiers, replication options",
                    "source": "Microsoft Learn"
                })
            elif "service bus" in area_lower or "event" in area_lower or "messaging" in area_lower:
                resources.append({
                    "title": "Azure Messaging Services — Microsoft Learn",
                    "type": "module",
                    "url": "https://learn.microsoft.com/en-us/azure/service-bus-messaging/",
                    "relevance": "Service Bus vs Event Grid vs Event Hubs — when to use each",
                    "source": "Microsoft Learn"
                })
            elif "security" in area_lower or "identity" in area_lower or "rbac" in area_lower:
                resources.append({
                    "title": "Azure Security & Identity — Microsoft Learn",
                    "type": "module",
                    "url": "https://learn.microsoft.com/en-us/azure/active-directory/",
                    "relevance": "Managed Identity, RBAC, Key Vault, Conditional Access",
                    "source": "Microsoft Learn"
                })
            elif "pipeline" in area_lower or "devops" in area_lower or "ci/cd" in area_lower:
                resources.append({
                    "title": "Azure DevOps Pipelines — Microsoft Learn",
                    "type": "module",
                    "url": "https://learn.microsoft.com/en-us/azure/devops/pipelines/",
                    "relevance": "CI/CD pipeline design, release gates, environment approvals",
                    "source": "Microsoft Learn"
                })
            elif "synapse" in area_lower or "data" in area_lower or "databricks" in area_lower:
                resources.append({
                    "title": "Azure Data Engineering — Microsoft Learn",
                    "type": "module",
                    "url": "https://learn.microsoft.com/en-us/azure/synapse-analytics/",
                    "relevance": "Synapse, Data Factory, Databricks, ADLS Gen2 patterns",
                    "source": "Microsoft Learn"
                })

        # Always include goal-specific primary resource
        sources = kb.get("sources", [])
        if sources:
            resources.append({
                "title": f"Official Reference: {sources[0]}",
                "type": "primary_source",
                "url": "https://learn.microsoft.com/en-us/certifications/",
                "relevance": "Official Microsoft certification study material",
                "source": sources[0]
            })

        return resources

    # ------------------------------------------------------------------ #
    #  Session persistence via Azure AI Search                            #
    # ------------------------------------------------------------------ #

    async def log_session(self, session_id: str, result: dict) -> bool:
        """
        Persist session result to Azure AI Search index.

        Index name: CertSense-sessions
        Falls back silently on error (non-blocking).
        """
        doc = {
            "session_id": session_id,
            "timestamp": datetime.now().isoformat(),
            "result": result,
            "goal": result.get("goal"),
            "overall_score": result.get("overall_score"),
            "user_id": result.get("user_id", ""),
        }

        try:
            url = f"{self.project_endpoint.rstrip('/')}/indexes/certsense-sessions/docs/index"
            payload = {"value": [{"@search.action": "mergeOrUpload", **doc}]}

            async with aiohttp.ClientSession() as session:
                async with session.post(
                    url,
                    json=payload,
                    headers=self._headers,
                    timeout=aiohttp.ClientTimeout(total=10),
                ) as resp:
                    resp.raise_for_status()

            return True

        except Exception:
            # Non-fatal — callers should not crash if logging fails
            return False

    async def get_session_history(self, user_id: str, limit: int = 10) -> list:
        """
        Retrieve past sessions for a user from Azure AI Search index.

        Falls back to empty list on error.
        """
        try:
            url = f"{self.project_endpoint.rstrip('/')}/indexes/certsense-sessions/docs/search"
            payload = {
                "search": "*",
                "filter": f"user_id eq '{user_id}'",
                "orderby": "timestamp desc",
                "top": limit,
            }

            async with aiohttp.ClientSession() as session:
                async with session.post(
                    url,
                    json=payload,
                    headers=self._headers,
                    timeout=aiohttp.ClientTimeout(total=10),
                ) as resp:
                    resp.raise_for_status()
                    data = await resp.json()

            return data.get("value", [])

        except Exception:
            return []