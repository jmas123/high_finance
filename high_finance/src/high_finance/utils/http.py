from httpx import AsyncClient, Response

async def fetch_data(url: str) -> dict:
    async with AsyncClient() as client:
        response: Response = await client.get(url)
        response.raise_for_status()
        return response.json()

def build_url(base: str, endpoint: str, params: dict = None) -> str:
    url = f"{base}/{endpoint}"
    if params:
        url += "?" + "&".join(f"{key}={value}" for key, value in params.items())
    return url