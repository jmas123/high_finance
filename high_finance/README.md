# User-Friendly Research Platform for Investors and Finance Students

Welcome to the User-Friendly Research Platform project! This application is designed to help everyday investors and finance students easily access key information about public companies, including their fundamentals, price history, top institutional investors, and leadership details.

## Features

- **Search Public Companies**: Quickly find any public company and view its essential data.
- **Key Fundamentals**: Access important financial metrics and ratios to evaluate company performance.
- **Price/Chart History**: View historical price data and charts for better investment decisions.
- **Top Institutional Investors**: Discover who owns the company through 13F ownership data.
- **Leadership Information**: Learn about the board members and executives running the company.

## Technology Stack

- **Backend**: FastAPI with Python
- **Database**: PostgreSQL (Neon, Supabase, or RDS)
- **ORM**: SQLAlchemy 2.0
- **Caching**: Redis
- **Data Ingestion**: SEC EDGAR API
- **Background Jobs**: RQ for task scheduling
- **Containerization**: Docker
- **Testing**: pytest

## Getting Started

1. **Clone the Repository**:
   ```bash
   git clone <repository-url>
   cd high_finance
   ```

2. **Set Up Environment**:
   Create a `.env` file based on the `.env.example` provided and fill in your configuration details.

3. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the Application**:
   For development:
   ```bash
   ./scripts/run_dev.sh
   ```

5. **Access the API**:
   Open your browser and navigate to `http://localhost:8000/docs` to view the interactive API documentation.

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.

## Acknowledgments

- FastAPI for the web framework
- SQLAlchemy for ORM
- Redis for caching
- SEC EDGAR API for financial data access

Happy investing and learning!