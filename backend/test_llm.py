import asyncio
from services.llm import LLM

async def main():
    llm = LLM()

    response = await llm.complete(
        "Reply with exactly: Gemini Working"
    )

    print(response)

asyncio.run(main())