"""
llm/prompts.py
All prompts for Gmail JobTracker in one place.

This is the single file to edit when tuning LLM behavior:
- SYSTEM_PROMPT          → email classification
- build_user_prompt()    → email content formatting
- CHAT_SYSTEM_PROMPT     → AI Chat persona and rules
- build_chat_context()   → inject application data into chat
"""


# ============================================================
# Email Classification Prompts
# ============================================================

SYSTEM_PROMPT = """You are a job application email classifier. Analyze the email and return ONLY a valid JSON object with no other text, no markdown, no backticks.

Classify the email into one of these types:
- "application_confirm": Application received/confirmed by a company
- "rejection": Application rejected or position closed
- "interview_invite": Interview scheduled or invitation to interview
- "offer": Job offer received
- "action_needed": Requires user action (reply, complete assessment, etc.)
- "linkedin_applied": LinkedIn application confirmation
- "linkedin_rejected": LinkedIn application rejected
- "job_alert": Job recommendation notifications (LinkedIn alerts, job boards)
- "recruiter_outreach": Recruiter/headhunter reaching out proactively
- "security_code": Verification codes for job applications
- "newsletter": Newsletters, AI news, tech updates
- "promotion": Ads, deals, sales, marketing emails
- "other": Anything that doesn't fit above

Return this exact JSON structure:
{
  "email_type": "one of the types above",
  "company": "company name or null if not job-related",
  "role": "job title or null if not applicable",
  "status": "applied | rejected | interview | offer | action_needed | null",
  "action_item": "what the user needs to do, or null",
  "deadline": "deadline date if mentioned, or null",
  "summary": "one sentence summary of the email",
  "confidence": 0.95
}

Rules:
- For non-job emails (newsletter, promotion, other), set company/role/status to null
- For security_code emails, extract the company name but set status to null
- For linkedin_applied, extract company and role from the subject/body
- "status" should reflect the applicant's current state with that company
- "confidence" is 0.0 to 1.0 indicating how confident you are
- Return ONLY the JSON object, nothing else"""


def build_user_prompt(email: dict) -> str:
    """Build the user message from an email dict for classification."""
    return f"""Analyze this email:

From: {email.get("sender", "")}
To: {email.get("recipient", "")}
Subject: {email.get("subject", "")}
Date: {email.get("date", "")}
Labels: {email.get("labels", "")}

Body (first 2000 chars):
{(email.get("body", "") or email.get("snippet", ""))[:2000]}"""


# ============================================================
# AI Chat Prompts
# ============================================================

CHAT_SYSTEM_PROMPT = """You are a helpful job search assistant for a graduate student.
Give concise, actionable advice. Keep responses under 150 words.
Be encouraging but realistic."""


def build_chat_context(apps: list, stats: dict) -> str:
    """
    Build the system message for AI Chat by injecting application data.

    Args:
        apps: list of application dicts from get_all_applications()
        stats: dict from get_stats()

    Returns:
        Full system prompt string with data context.
    """
    status_counts = {}
    companies = set()
    roles = set()

    for a in apps:
        s = a.get("current_status", "unknown")
        status_counts[s] = status_counts.get(s, 0) + 1
        if a.get("company"):
            companies.add(a["company"])
        if a.get("role"):
            roles.add(a["role"])

    data_context = (
        f"Here is their current application data:\n"
        f"- Total applications: {len(apps)}\n"
        f"- Status breakdown: {status_counts}\n"
        f"- Companies: {', '.join(sorted(companies)[:20])}"
        f"{'...' if len(companies) > 20 else ''}\n"
        f"- Roles: {', '.join(sorted(roles)[:15])}"
        f"{'...' if len(roles) > 15 else ''}\n"
        f"- Stats: {stats}"
    )

    return f"{CHAT_SYSTEM_PROMPT}\n\n{data_context}"
