from typing import List
from bs4 import BeautifulSoup
import requests

class FilingsParser:
    def __init__(self, cik: str):
        self.cik = cik
        self.base_url = f"https://www.sec.gov/cgi-bin/browse-edgar?CIK={self.cik}&action=getcompany"

    def fetch_filings(self) -> str:
        response = requests.get(self.base_url)
        response.raise_for_status()
        return response.text

    def parse_filings(self, html: str) -> List[dict]:
        soup = BeautifulSoup(html, 'lxml')
        filings = []
        
        for row in soup.find_all('tr')[1:]:  # Skip header row
            cols = row.find_all('td')
            if len(cols) < 5:
                continue
            
            filing = {
                'date': cols[0].text.strip(),
                'type': cols[1].text.strip(),
                'description': cols[2].text.strip(),
                'link': f"https://www.sec.gov{cols[2].find('a')['href']}",
                'file_number': cols[3].text.strip(),
                'size': cols[4].text.strip(),
            }
            filings.append(filing)
        
        return filings

    def get_filings(self) -> List[dict]:
        html = self.fetch_filings()
        return self.parse_filings(html)