# Architecture Overview

## Project Structure
The project is organized into several key directories and files, each serving a specific purpose:

- **src/**: Contains the main application code.
  - **main.py**: Entry point for the FastAPI application.
  - **high_finance/**: Core application package.
    - **api/**: Contains API-related code, including routes and schemas.
    - **core/**: Configuration and logging setup.
    - **db/**: Database models and session management.
    - **services/**: Business logic and data processing functions.
    - **ingestion/**: Data ingestion and parsing logic.
    - **workers/**: Background task processing.
    - **utils/**: Utility functions for various tasks.
    - **clients/**: External API clients for data retrieval.

- **alembic/**: Contains migration scripts for database schema changes.

- **docker/**: Docker-related files for containerization.

- **infra/**: Infrastructure configuration files for deployment.

- **scripts/**: Utility scripts for development and data management.

- **tests/**: Unit and integration tests for the application.

- **notebooks/**: Jupyter notebooks for exploratory data analysis.

- **docs/**: Documentation files for the project.

## Technology Stack
- **Backend Framework**: FastAPI for building the web API.
- **Database**: PostgreSQL for data storage, managed via SQLAlchemy ORM.
- **Caching**: Redis for caching and background job processing.
- **Data Ingestion**: SEC EDGAR API for retrieving public company filings.
- **Task Queue**: RQ for managing background tasks.
- **Containerization**: Docker for creating a consistent development and production environment.
- **Testing**: Pytest for unit and integration testing.

## Key Features
- **Company Search**: Users can search for public companies and view key fundamentals.
- **Price/Chart History**: Historical price data and charts for companies.
- **Ownership Information**: Details on top institutional investors and their holdings.
- **Leadership Information**: Information on board members and executives.

## Future Enhancements
- Implement user authentication for personalized features like watchlists.
- Add data validation and observability tools for improved reliability.
- Expand the API to include more financial metrics and insights.

This architecture is designed to provide a scalable and maintainable platform for everyday investors and finance students, enabling them to access critical financial information easily.