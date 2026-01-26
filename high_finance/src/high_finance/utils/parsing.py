# src/high_finance/utils/parsing.py

from bs4 import BeautifulSoup
import lxml

def parse_html(content: str) -> BeautifulSoup:
    """Parse HTML content and return a BeautifulSoup object."""
    return BeautifulSoup(content, 'lxml')

def extract_text_from_html(soup: BeautifulSoup) -> str:
    """Extract text from a BeautifulSoup object."""
    return soup.get_text(separator=' ', strip=True)

def normalize_text(text: str) -> str:
    """Normalize text by stripping whitespace and converting to lowercase."""
    return text.strip().lower()

def parse_sec_filing(filing_html: str) -> dict:
    """Parse SEC filing HTML and extract relevant information."""
    soup = parse_html(filing_html)
    # Example extraction logic (to be customized based on actual filing structure)
    title = extract_text_from_html(soup.find('title'))
    content = extract_text_from_html(soup.find('body'))
    
    return {
        'title': normalize_text(title),
        'content': normalize_text(content),
    }