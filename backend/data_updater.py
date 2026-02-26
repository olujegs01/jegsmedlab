"""
MedLab AI — Automatic Knowledge Base Updater
Fetches publicly available medical data from NIH, NLM, PubMed, and OpenFDA
and adds new content to the ChromaDB RAG collection daily.

Data sources (all free, no API key required):
  - MedlinePlus Connect API (NIH/NLM) — lab test info via LOINC codes
  - PubMed/NCBI Entrez API           — peer-reviewed research abstracts
  - MedlinePlus RSS Feeds            — health topic summaries
  - OpenFDA API                      — drug label information
"""

import httpx
import asyncio
import logging
import hashlib
import re
import json
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

# ── LOINC codes for the 40 most common lab tests ─────────────────────────────
LOINC_LAB_TESTS = {
    "2093-3":  "Total Cholesterol",
    "2085-9":  "HDL Cholesterol",
    "13457-7": "LDL Cholesterol (calculated)",
    "2571-8":  "Triglycerides",
    "2345-7":  "Glucose",
    "4548-4":  "Hemoglobin A1c (HbA1c)",
    "3016-3":  "TSH (Thyroid Stimulating Hormone)",
    "11579-0": "Free T4 (Thyroxine)",
    "3050-2":  "Free T3 (Triiodothyronine)",
    "718-7":   "Hemoglobin",
    "6690-2":  "WBC (White Blood Cell Count)",
    "777-3":   "Platelet Count",
    "789-8":   "RBC (Red Blood Cell Count)",
    "4544-3":  "Hematocrit",
    "787-2":   "MCV (Mean Corpuscular Volume)",
    "2160-0":  "Creatinine (Serum)",
    "3094-0":  "BUN (Blood Urea Nitrogen)",
    "33914-3": "eGFR (Estimated GFR)",
    "1920-8":  "AST (Aspartate Aminotransferase)",
    "1742-6":  "ALT (Alanine Aminotransferase)",
    "1975-2":  "Total Bilirubin",
    "1751-7":  "Albumin (Serum)",
    "2823-3":  "Potassium",
    "2951-2":  "Sodium",
    "2000-8":  "Calcium",
    "2075-0":  "Chloride",
    "1963-8":  "Bicarbonate (CO2)",
    "25428-4": "Vitamin D (25-OH)",
    "2132-9":  "Vitamin B12 (Cobalamin)",
    "2276-4":  "Ferritin",
    "10346-5": "Serum Iron",
    "2498-4":  "TIBC (Total Iron Binding Capacity)",
    "14959-1": "Microalbumin/Creatinine Ratio",
    "70204-3": "hsCRP (High-Sensitivity C-Reactive Protein)",
    "30341-2": "ESR (Erythrocyte Sedimentation Rate)",
    "6301-6":  "PT/INR (Prothrombin Time)",
    "3255-7":  "aPTT (Activated Partial Thromboplastin Time)",
    "2857-1":  "PSA (Prostate Specific Antigen)",
    "15067-2": "FSH (Follicle Stimulating Hormone)",
    "10334-1": "LH (Luteinizing Hormone)",
    "2986-8":  "Testosterone (Total)",
    "2243-4":  "Cortisol (AM)",
    "2484-4":  "Insulin (Fasting)",
    "13969-1": "Troponin I",
    "2157-6":  "CPK (Creatine Phosphokinase)",
    "13457-7": "LDL Direct",
    "35194-0": "Uric Acid",
    "5902-2":  "PT (Prothrombin Time)",
    "3802-4":  "Magnesium",
}

# PubMed search queries for lab interpretation research
PUBMED_QUERIES = [
    "complete blood count interpretation clinical significance",
    "lipid panel cholesterol cardiovascular risk guidelines",
    "thyroid function tests TSH reference range interpretation",
    "HbA1c diabetes diagnosis prediabetes guidelines",
    "liver function tests ALT AST hepatic disease",
    "kidney function eGFR creatinine chronic kidney disease",
    "vitamin D deficiency laboratory diagnosis treatment",
    "iron deficiency anemia ferritin diagnosis",
    "CBC anemia differential diagnosis laboratory",
    "metabolic panel electrolytes interpretation",
    "inflammatory markers CRP ESR clinical use",
    "coagulation tests PT INR aPTT interpretation",
    "cardiac biomarkers troponin BNP diagnosis",
    "hormone testing testosterone estrogen laboratory",
    "urinalysis interpretation clinical significance",
]

# MedlinePlus RSS health topic feeds
RSS_FEEDS = [
    ("https://medlineplus.gov/rss/healthtopics.xml", "Health Topics"),
    ("https://medlineplus.gov/rss/druginformation.xml", "Drug Information"),
]

# OpenFDA drug label search terms (common drugs affecting lab values)
FDA_DRUG_TERMS = [
    "warfarin", "metformin", "levothyroxine", "statins", "lisinopril",
    "metoprolol", "amlodipine", "omeprazole", "sertraline", "atorvastatin",
]


class MedicalDataUpdater:
    def __init__(self, rag_system):
        self.rag = rag_system
        self.http = httpx.AsyncClient(
            timeout=30.0,
            headers={"User-Agent": "MedLabAI/2.0 (educational research tool; contact: medlabai@example.com)"},
            follow_redirects=True,
        )

    async def close(self):
        await self.http.aclose()

    def _doc_id(self, prefix: str, key: str) -> str:
        return f"{prefix}_{hashlib.md5(key.encode()).hexdigest()[:10]}"

    def _strip_html(self, text: str) -> str:
        text = re.sub(r"<[^>]+>", " ", text or "")
        text = re.sub(r"\s+", " ", text)
        return text.strip()

    # ── Source 1: MedlinePlus Connect (LOINC lookup) ──────────────────────────

    async def fetch_medlineplus_loinc(self) -> list[dict]:
        """
        For each LOINC code, query MedlinePlus Connect and retrieve
        patient-friendly lab test summaries from NLM.
        """
        docs = []
        for loinc, test_name in LOINC_LAB_TESTS.items():
            try:
                resp = await self.http.get(
                    "https://connect.medlineplus.gov/service",
                    params={
                        "mainSearchCriteria.v.cs": "2.16.840.1.113883.6.1",
                        "mainSearchCriteria.v.c": loinc,
                        "mainSearchCriteria.v.dn": test_name,
                        "knowledgeResponseType": "application/json",
                        "informationRecipient.languageCode.c": "en",
                    },
                )
                if resp.status_code != 200:
                    continue

                data = resp.json()
                entries = data.get("feed", {}).get("entry", [])
                for entry in entries[:2]:
                    title = entry.get("title", {}).get("_value", test_name)
                    summary = self._strip_html(entry.get("summary", {}).get("_value", ""))
                    if len(summary) < 80:
                        continue
                    text = (
                        f"Lab Test: {test_name}\n"
                        f"LOINC Code: {loinc}\n"
                        f"Source: NIH MedlinePlus\n\n"
                        f"{summary[:1200]}"
                    )
                    docs.append({
                        "id": self._doc_id("mlp_loinc", f"{loinc}_{title}"),
                        "text": text,
                        "metadata": {
                            "source": "medlineplus_connect",
                            "category": "Lab Reference",
                            "test_name": test_name,
                            "loinc": loinc,
                            "updated": datetime.utcnow().date().isoformat(),
                        },
                    })
                await asyncio.sleep(0.2)  # Be a good API citizen
            except Exception as e:
                logger.debug(f"MedlinePlus LOINC {loinc} ({test_name}): {e}")
        logger.info(f"MedlinePlus LOINC: fetched {len(docs)} docs")
        return docs

    # ── Source 2: PubMed/NCBI Abstracts ──────────────────────────────────────

    async def fetch_pubmed_abstracts(self, max_per_query: int = 5) -> list[dict]:
        """
        Search PubMed for recent lab interpretation papers and fetch abstracts.
        Uses NCBI Entrez API (free, no key for <3 requests/sec).
        """
        docs = []
        one_year_ago = (datetime.utcnow() - timedelta(days=365)).strftime("%Y/%m/%d")

        for query in PUBMED_QUERIES:
            try:
                # Step 1: search
                search = await self.http.get(
                    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi",
                    params={
                        "db": "pubmed",
                        "term": query + "[Title/Abstract]",
                        "retmax": max_per_query,
                        "sort": "relevance",
                        "retmode": "json",
                        "mindate": one_year_ago,
                        "datetype": "pdat",
                    },
                )
                if search.status_code != 200:
                    continue
                ids = search.json().get("esearchresult", {}).get("idlist", [])
                if not ids:
                    continue

                # Step 2: fetch abstracts
                fetch = await self.http.get(
                    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi",
                    params={"db": "pubmed", "id": ",".join(ids), "retmode": "xml", "rettype": "abstract"},
                )
                if fetch.status_code != 200:
                    continue

                root = ET.fromstring(fetch.text)
                for article in root.findall(".//PubmedArticle"):
                    try:
                        title_el = article.find(".//ArticleTitle")
                        abstract_els = article.findall(".//AbstractText")
                        pmid_el = article.find(".//PMID")
                        year_el = article.find(".//PubDate/Year")

                        title = "".join(title_el.itertext()) if title_el is not None else ""
                        abstract = " ".join(
                            "".join(el.itertext()) for el in abstract_els
                        ).strip()
                        pmid = pmid_el.text if pmid_el is not None else ""
                        year = year_el.text if year_el is not None else ""

                        if abstract and len(abstract) > 150:
                            text = (
                                f"Medical Research ({year}): {title}\n"
                                f"PMID: {pmid} | Source: PubMed/NCBI\n"
                                f"Topic: {query}\n\n"
                                f"{abstract[:1800]}"
                            )
                            docs.append({
                                "id": f"pubmed_{pmid}",
                                "text": text,
                                "metadata": {
                                    "source": "pubmed",
                                    "category": "Research",
                                    "pmid": pmid,
                                    "year": year,
                                    "updated": datetime.utcnow().date().isoformat(),
                                },
                            })
                    except Exception:
                        continue

                await asyncio.sleep(0.35)  # NCBI rate limit: max 3/s without key
            except Exception as e:
                logger.debug(f"PubMed query '{query[:40]}': {e}")

        logger.info(f"PubMed: fetched {len(docs)} abstracts")
        return docs

    # ── Source 3: MedlinePlus Health Topic RSS ───────────────────────────────

    async def fetch_medlineplus_rss(self) -> list[dict]:
        """
        Fetch health topic and drug information summaries from MedlinePlus RSS feeds.
        """
        docs = []
        for feed_url, feed_label in RSS_FEEDS:
            try:
                resp = await self.http.get(feed_url)
                if resp.status_code != 200:
                    continue
                root = ET.fromstring(resp.content)
                items = root.findall(".//item")
                for item in items[:100]:
                    title_el = item.find("title")
                    desc_el = item.find("description")
                    title = title_el.text if title_el is not None else ""
                    desc = self._strip_html(desc_el.text if desc_el is not None else "")
                    if title and desc and len(desc) > 40:
                        text = (
                            f"{feed_label}: {title}\n"
                            f"Source: NIH MedlinePlus\n\n"
                            f"{desc[:900]}"
                        )
                        docs.append({
                            "id": self._doc_id("mlp_rss", title),
                            "text": text,
                            "metadata": {
                                "source": "medlineplus_rss",
                                "category": "Health Topics",
                                "title": title,
                                "updated": datetime.utcnow().date().isoformat(),
                            },
                        })
            except Exception as e:
                logger.debug(f"RSS feed {feed_url}: {e}")
        logger.info(f"MedlinePlus RSS: fetched {len(docs)} topics")
        return docs

    # ── Source 4: OpenFDA Drug Labels ─────────────────────────────────────────

    async def fetch_fda_drug_labels(self) -> list[dict]:
        """
        Fetch drug label information from OpenFDA — useful for knowing
        which drugs affect lab values.
        """
        docs = []
        for drug in FDA_DRUG_TERMS:
            try:
                resp = await self.http.get(
                    "https://api.fda.gov/drug/label.json",
                    params={
                        "search": f"openfda.generic_name:{drug}",
                        "limit": 1,
                    },
                )
                if resp.status_code != 200:
                    continue
                results = resp.json().get("results", [])
                for r in results:
                    name = drug.title()
                    # Extract relevant sections
                    sections = []
                    for field in ["warnings", "drug_interactions", "adverse_reactions",
                                  "clinical_pharmacology", "indications_and_usage"]:
                        val = r.get(field)
                        if val and isinstance(val, list):
                            sections.append(f"{field.replace('_', ' ').title()}:\n{val[0][:400]}")

                    if sections:
                        text = (
                            f"Drug Information: {name}\n"
                            f"Source: FDA Drug Label (OpenFDA)\n\n"
                            + "\n\n".join(sections)
                        )
                        docs.append({
                            "id": self._doc_id("fda", drug),
                            "text": text[:2000],
                            "metadata": {
                                "source": "openfda",
                                "category": "Drug Information",
                                "drug": drug,
                                "updated": datetime.utcnow().date().isoformat(),
                            },
                        })
                await asyncio.sleep(0.2)
            except Exception as e:
                logger.debug(f"OpenFDA {drug}: {e}")
        logger.info(f"OpenFDA: fetched {len(docs)} drug docs")
        return docs

    # ── Upsert into ChromaDB ──────────────────────────────────────────────────

    def _upsert_docs(self, new_docs: list[dict]) -> int:
        """Add only new documents to ChromaDB (skip duplicates by ID)."""
        if not new_docs:
            return 0
        try:
            existing_ids = set(self.rag.collection.get(include=[])["ids"])
        except Exception:
            existing_ids = set()

        to_add = [d for d in new_docs if d["id"] not in existing_ids]
        if not to_add:
            return 0

        added = 0
        for i in range(0, len(to_add), 50):
            batch = to_add[i:i + 50]
            try:
                self.rag.collection.add(
                    documents=[d["text"] for d in batch],
                    ids=[d["id"] for d in batch],
                    metadatas=[d["metadata"] for d in batch],
                )
                added += len(batch)
            except Exception as e:
                logger.error(f"ChromaDB batch add error: {e}")
        return added

    # ── Main entry point ──────────────────────────────────────────────────────

    async def run_full_update(self) -> dict:
        """
        Run a complete knowledge base update from all public data sources.
        Safe to run daily — deduplicates before inserting.
        """
        logger.info("=== Knowledge Base Update Starting ===")
        start = datetime.utcnow()
        results = {}

        # Fetch from all sources (run mostly in parallel)
        loinc_task = asyncio.create_task(self.fetch_medlineplus_loinc())
        rss_task = asyncio.create_task(self.fetch_medlineplus_rss())
        fda_task = asyncio.create_task(self.fetch_fda_drug_labels())

        loinc_docs, rss_docs, fda_docs = await asyncio.gather(
            loinc_task, rss_task, fda_task, return_exceptions=True
        )

        # PubMed runs separately (needs slower rate limit)
        try:
            pubmed_docs = await self.fetch_pubmed_abstracts(max_per_query=5)
        except Exception as e:
            logger.error(f"PubMed fetch error: {e}")
            pubmed_docs = []

        results["medlineplus_loinc"] = self._upsert_docs(loinc_docs if isinstance(loinc_docs, list) else [])
        results["medlineplus_rss"] = self._upsert_docs(rss_docs if isinstance(rss_docs, list) else [])
        results["openfda"] = self._upsert_docs(fda_docs if isinstance(fda_docs, list) else [])
        results["pubmed"] = self._upsert_docs(pubmed_docs)

        total_new = sum(results.values())
        collection_size = self.rag.collection.count()
        elapsed = (datetime.utcnow() - start).total_seconds()

        summary = {
            "status": "success",
            "new_documents_added": total_new,
            "breakdown": results,
            "total_collection_size": collection_size,
            "duration_seconds": round(elapsed, 1),
            "updated_at": datetime.utcnow().isoformat(),
        }
        logger.info(
            f"=== Update Complete: +{total_new} docs, "
            f"total={collection_size}, time={elapsed:.1f}s ==="
        )
        await self.close()
        return summary
