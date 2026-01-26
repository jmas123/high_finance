from typing import List
from bs4 import BeautifulSoup
import requests

class HoldingsParser:
    def __init__(self, cik: str):
        self.cik = cik
        self.base_url = f"https://www.sec.gov/edgar/searchedgar/companysearch.html"

    def fetch_holdings_data(self) -> str:
        response = requests.get(self.base_url, params={'cik': self.cik})
        response.raise_for_status()
        return response.text

    def parse_holdings(self, html: str) -> List[dict]:
        soup = BeautifulSoup(html, 'lxml')
        holdings_data = []

        # Example parsing logic (this will need to be customized based on actual HTML structure)
        for row in soup.select('table#holdingsTable tr'):
            columns = row.find_all('td')
            if columns:
                holding = {
                    'institution': columns[0].get_text(strip=True),
                    'shares': columns[1].get_text(strip=True),
                    'value': columns[2].get_text(strip=True),
                    'date': columns[3].get_text(strip=True),
                }
                holdings_data.append(holding)

        return holdings_data

    def get_holdings(self) -> List[dict]:
        html = self.fetch_holdings_data()
        return self.parse_holdings(html)