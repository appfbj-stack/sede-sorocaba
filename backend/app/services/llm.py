from openai import OpenAI
from typing import Callable
from app.core.config import settings

_client: OpenAI | None = None

def get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(
            base_url=settings.OPENROUTER_BASE_URL,
            api_key=settings.OPENROUTER_API_KEY,
            default_headers={
                "HTTP-Referer": settings.OPENROUTER_SITE_URL or "https://sede.fbautomacao.space",
                "X-Title": settings.OPENROUTER_SITE_NAME or "Kairos Sede Sorocaba",
            },
        )
    return _client

SYSTEM_PROMPT = """Voce e o Assistente Kairos, assistente oficial da OBPC Sorocaba.
Voce ajuda pastores, lideres e membros da igreja com:
- Analise de documentos eclesiasticos e ministeriais
- Consulta a dados de membros, congregacoes e obreiros
- Elaboracao de relatorios e estatisticas da igreja
- Estudo e interpretacao de temas teologicos e biblicos
- Organizacao de eventos, batismos e agenda pastoral
- Resposta a perguntas sobre doutrina, administracao e vida crista

Regras:
1. Responda em portugues formal e respeitoso
2. Sempre cite fontes biblicas quando aplicavel
3. Diferencie doutrina consolidada de opiniao teologica
4. Nao forneca aconselhamento psicologico ou medico
5. Informe quando nao souber a resposta
6. Seja objetivo e pastoral ao mesmo tempo
7. Inclua uma estimativa de tempo economizado ao final"""

def get_system_prompt(tenant_context: str | None = None) -> str:
    prompt = SYSTEM_PROMPT
    if tenant_context and tenant_context.strip():
        prompt += f"\n\nContexto especifico deste cliente:\n{tenant_context.strip()}"
    return prompt

MAX_TOOL_ITERATIONS = 5

async def chat_completion(
    messages: list[dict],
    model: str | None = None,
    tenant_context: str | None = None,
    tools: list[dict] | None = None,
    tool_executor: Callable[[str, dict], str] | None = None,
) -> tuple[str, int, int]:
    client = get_client()
    system = [{"role": "system", "content": get_system_prompt(tenant_context)}]
    full_messages = system + list(messages)
    used_model = model or settings.OPENROUTER_MODEL

    prompt_tokens = 0
    completion_tokens = 0

    for _ in range(MAX_TOOL_ITERATIONS):
        kwargs = {"model": used_model, "messages": full_messages}
        if tools:
            kwargs["tools"] = tools

        response = client.chat.completions.create(**kwargs)
        if response.usage:
            prompt_tokens += response.usage.prompt_tokens
            completion_tokens += response.usage.completion_tokens

        choice = response.choices[0]
        msg = choice.message
        tool_calls = getattr(msg, "tool_calls", None)

        if not tool_calls or not tool_executor:
            return msg.content or "", prompt_tokens, completion_tokens

        full_messages.append({
            "role": "assistant",
            "content": msg.content or "",
            "tool_calls": [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                }
                for tc in tool_calls
            ],
        })

        for tc in tool_calls:
            import json
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}
            result = tool_executor(tc.function.name, args)
            full_messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": result,
            })

    final = client.chat.completions.create(model=used_model, messages=full_messages)
    if final.usage:
        prompt_tokens += final.usage.prompt_tokens
        completion_tokens += final.usage.completion_tokens
    return final.choices[0].message.content or "", prompt_tokens, completion_tokens

def estimate_time_saved(content: str) -> int:
    words_per_minute = 200
    word_count = len(content.split())
    minutes = max(1, word_count // words_per_minute)
    return minutes * 60
