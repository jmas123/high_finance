from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)

def test_get_company_info():
    response = client.get("/api/v1/companies/AAPL")
    assert response.status_code == 200
    assert "name" in response.json()
    assert "symbol" in response.json()
    assert response.json()["symbol"] == "AAPL"

def test_get_company_fundamentals():
    response = client.get("/api/v1/companies/AAPL/fundamentals")
    assert response.status_code == 200
    assert "revenue" in response.json()
    assert "net_income" in response.json()

def test_get_company_ownership():
    response = client.get("/api/v1/companies/AAPL/ownership")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_get_company_leadership():
    response = client.get("/api/v1/companies/AAPL/leadership")
    assert response.status_code == 200
    assert isinstance(response.json(), list)